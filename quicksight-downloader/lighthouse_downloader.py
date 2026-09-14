#!/usr/bin/env python3
"""
lighthouse_downloader.py
========================
Descarga diaria (Playwright) del dashboard QuickSight "AGL DSP Lighthouse" y,
opcionalmente, fusiona los datos en src/Dashboard.jsx.

Exporta 4 CSV en  downloads/lighthouse/<YYYY-MM-DD>/ :
  quality_metrics_by_station_<rango>.csv   pivot de métricas de calidad, Show By = 4. By Station Code (semanal)
  quality_metrics_network_<rango>.csv      misma pivot con Show By = 5. By DSP Company (red LSRL)
  business_metrics_by_station_<rango>.csv  pivot Business Metrics (Orders / Routes) por estación
  order_level_defects_<rango>.csv          tabla "Order Level Data" (una fila por defecto de pedido)

Uso:
  python3 lighthouse_downloader.py                 # últimas 12 semanas, con navegador visible
  python3 lighthouse_downloader.py --headless      # sin UI (cron / launchd)
  python3 lighthouse_downloader.py --weeks 6 --merge --commit
  python3 lighthouse_downloader.py --from 2026-06-28 --to 2026-09-13

Credenciales: variables de entorno QS_USERNAME / QS_PASSWORD (o fichero .env cargado por run.sh).
La sesión del navegador se guarda en .qs_state.json para no volver a hacer login cada día.

Requisitos: pip install playwright && playwright install chromium
"""
import argparse, datetime as dt, json, os, re, subprocess, sys, time
from pathlib import Path

try:
    from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout
except ImportError:
    sys.exit("Playwright no instalado:  pip install playwright && playwright install chromium")

HERE = Path(__file__).resolve().parent
REPO = HERE.parent if (HERE.parent / "src" / "Dashboard.jsx").exists() else HERE
ACCOUNT = os.environ.get("QS_ACCOUNT", "agl-iris-qs-ext")
BASE = "https://us-east-1.quicksight.aws.amazon.com"
DASHBOARD_ID = os.environ.get("QS_LIGHTHOUSE_ID", "8274a68c-035d-4b8c-99b9-cc2438a5c9cd")
DASH_URL = f"{BASE}/sn/account/{ACCOUNT}/dashboards/{DASHBOARD_ID}"
LOGIN_URL = (f"{BASE}/sn/auth/signin?enable-sso=0&redirect_uri="
             f"https%3A%2F%2Fus-east-1.quicksight.aws.amazon.com%2Fsn%2Fstart%3Fdirectory-alias%3D{ACCOUNT}"
             f"%26enable-sso%3D0%26state%3DhashArgs%2523%26isauthcode%3Dtrue")
STATE_FILE = HERE / ".qs_state.json"
W1_2026 = dt.date(2025, 12, 28)  # semana Amazon: domingo → sábado


def log(msg, lvl="INFO"):
    print(f"[{dt.datetime.now():%H:%M:%S}] [{lvl}] {msg}", flush=True)


def amazon_week(d: dt.date):
    n = (d - W1_2026).days // 7 + 1
    return f"W{n}"


# ─── Login ────────────────────────────────────────────────────────────
def is_logged_in(page):
    url = page.url.lower()
    return ("/dashboards/" in url or "/start" in url) and "signin" not in url and "midway" not in url


def login(page, user, pwd):
    """Login por usuario/contraseña de Quick (enable-sso=0 evita la redirección a Midway)."""
    log(f"Login QuickSight (cuenta {ACCOUNT}) …")
    page.goto(LOGIN_URL, wait_until="networkidle")
    time.sleep(2)
    # Paso 0: nombre de cuenta (sólo si lo pide)
    if page.locator("input[type=text]").count() and ACCOUNT not in page.content():
        page.locator("input[type=text]").first.fill(ACCOUNT)
        page.locator("button[type=submit], button:has-text('Next')").first.click()
        page.wait_for_load_state("networkidle")
    # Paso 1: usuario
    page.locator("input[type=text]").first.wait_for(timeout=15000)
    page.locator("input[type=text]").first.fill(user)
    page.locator("button[type=submit]").first.click()
    # Paso 2: contraseña (página us-east-1.signin.aws)
    page.locator("input[type=password]").wait_for(timeout=30000)
    page.locator("input[type=password]").fill(pwd)
    page.locator("button[type=submit]").first.click()
    page.wait_for_load_state("networkidle")
    time.sleep(3)
    if "midway" in page.url.lower():
        raise RuntimeError("Redirigido a Midway: la cuenta exige SSO. Revisa ACCOUNT / usuario.")
    if not is_logged_in(page):
        page.screenshot(path=str(HERE / "login_error.png"))
        raise RuntimeError(f"Login fallido, URL: {page.url} (ver login_error.png)")
    log("Login OK")


# ─── Helpers de UI ────────────────────────────────────────────────────
def open_sheet(page, name):
    tab = page.get_by_role("tab", name=re.compile(re.escape(name)))
    tab.first.click()
    page.wait_for_timeout(6000)
    log(f"Hoja «{name}» abierta")


def expand_controls(page):
    """El panel de controles va plegado; lo desplegamos si no vemos los combos."""
    if page.get_by_label("Start Date").count() or page.get_by_role("combobox").count() > 3:
        return
    btn = page.get_by_role("button", name=re.compile(r"^Controls$"))
    if btn.count():
        btn.first.click(); page.wait_for_timeout(1500)


def select_combo(page, current_pattern, option_text):
    """Abre el combobox cuyo texto actual cumple current_pattern y elige option_text."""
    combo = page.get_by_role("combobox", name=re.compile(current_pattern))
    if not combo.count():
        log(f"Combobox {current_pattern!r} no encontrado (¿ya está en {option_text!r}?)", "WARN"); return
    if re.fullmatch(re.escape(option_text), combo.first.get_attribute("aria-label") or ""):
        return
    combo.first.click(); page.wait_for_timeout(800)
    page.get_by_text(option_text, exact=True).last.click()
    page.wait_for_timeout(5000)
    log(f"Control → {option_text}")


def set_metrics_date_range(page, start: dt.date, end: dt.date):
    """Hoja 'DSP Lighthouse metrics': inputs Start Date / End Date + calendario + Apply."""
    s, e = page.get_by_label("Start Date"), page.get_by_label("End Date")
    s.fill(f"{start:%Y/%m/%d} 00:00:00"); s.press("Enter")
    e.fill(f"{end:%Y/%m/%d} 00:00:00"); e.press("Enter")
    page.wait_for_timeout(800)
    # El picker exige «Apply»: abrimos el calendario (botón "Calendar") y pulsamos Apply
    cal = page.get_by_role("button", name="Calendar")
    (cal.first if cal.count() else s).click(); page.wait_for_timeout(1000)
    apply = page.get_by_role("button", name="Apply")
    if apply.count():
        apply.first.click()
    else:
        log("No aparece el botón Apply del calendario; el rango puede no haberse aplicado", "WARN")
        page.keyboard.press("Escape")
    page.wait_for_timeout(8000)
    heading = page.get_by_role("heading", name=re.compile("delivery_date between")).first
    log(f"Rango métricas: {heading.text_content() if heading.count() else '?'}")


def set_orders_date_range(page, start: dt.date, end: dt.date):
    """Hoja 'Order Level View': control único 'YYYY/MM/DD - YYYY/MM/DD' con popover Start date / End date."""
    box = page.get_by_role("textbox", name=re.compile(r"^\d{4}/\d{2}/\d{2} .* - \d{4}/\d{2}/\d{2}"))
    box.first.click(); page.wait_for_timeout(1000)
    page.get_by_label("Start date").fill(f"{start:%Y/%m/%d} 00:00:00"); page.get_by_label("Start date").press("Enter")
    page.wait_for_timeout(500)
    page.get_by_label("End date").fill(f"{end:%Y/%m/%d} 00:00:00"); page.get_by_label("End date").press("Enter")
    page.wait_for_timeout(1000)
    page.keyboard.press("Escape")
    page.wait_for_timeout(8000)
    log(f"Rango pedidos: {box.first.get_attribute('aria-label') or box.first.input_value()}")


def export_visual(page, menu_name_pattern, out_path: Path):
    """Menú (⋮) del visual → Export to CSV → guarda la descarga."""
    btn = page.get_by_role("button", name=re.compile(menu_name_pattern))
    if not btn.count():
        # los botones aparecen al pasar el ratón por el visual
        page.mouse.move(400, 600); page.wait_for_timeout(500)
    btn = page.get_by_role("button", name=re.compile(menu_name_pattern))
    btn.first.scroll_into_view_if_needed(); btn.first.hover(); btn.first.click()
    page.wait_for_timeout(700)
    with page.expect_download(timeout=120000) as dl:
        page.get_by_role("menuitem", name="Export to CSV").click()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    dl.value.save_as(str(out_path))
    page.keyboard.press("Escape")
    size = out_path.stat().st_size
    log(f"Guardado {out_path.name} ({size:,} bytes)")
    if size < 200:
        log(f"{out_path.name} parece vacío", "WARN")


# ─── Main ─────────────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--weeks", type=int, default=12, help="semanas hacia atrás (por defecto 12)")
    ap.add_argument("--from", dest="date_from", help="YYYY-MM-DD (domingo de inicio); anula --weeks")
    ap.add_argument("--to", dest="date_to", help="YYYY-MM-DD (por defecto hoy)")
    ap.add_argument("--out", default=str(REPO / "data" / "lighthouse"), help="carpeta de salida")
    ap.add_argument("--headless", action="store_true")
    ap.add_argument("--merge", action="store_true", help="ejecuta scripts/lighthouse_to_dashboard.py al terminar")
    ap.add_argument("--commit", action="store_true", help="git add + commit (sin push) tras el merge")
    ap.add_argument("--push", action="store_true", help="git push tras el commit (dispara el deploy de Netlify)")
    a = ap.parse_args()

    user = os.environ.get("QS_USERNAME"); pwd = os.environ.get("QS_PASSWORD")
    if not (user and pwd):
        sys.exit("Faltan QS_USERNAME / QS_PASSWORD en el entorno (usa run.sh o exporta las variables).")

    today = dt.date.today()
    end = dt.date.fromisoformat(a.date_to) if a.date_to else today
    if a.date_from:
        start = dt.date.fromisoformat(a.date_from)
    else:
        last_sunday = end - dt.timedelta(days=(end.weekday() + 1) % 7)
        start = last_sunday - dt.timedelta(weeks=a.weeks - 1)
    rng = f"{amazon_week(start)}-{amazon_week(end)}"
    out_dir = Path(a.out) / f"{today:%Y-%m-%d}"
    log(f"Rango {start} → {end} ({rng}); salida {out_dir}")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=a.headless)
        ctx_kwargs = {"accept_downloads": True, "viewport": {"width": 1500, "height": 1000}}
        if STATE_FILE.exists():
            ctx_kwargs["storage_state"] = str(STATE_FILE)
        ctx = browser.new_context(**ctx_kwargs)
        page = ctx.new_page()
        page.set_default_timeout(30000)

        page.goto(DASH_URL, wait_until="networkidle"); time.sleep(3)
        if not is_logged_in(page):
            login(page, user, pwd)
            page.goto(DASH_URL, wait_until="networkidle"); time.sleep(5)
        ctx.storage_state(path=str(STATE_FILE))

        # ── Hoja 1: métricas semanales ──
        open_sheet(page, "DSP Lighthouse metrics")
        expand_controls(page)
        select_combo(page, r"^\d\. (Daily|Weekly|Monthly|Quarterly)$", "2. Weekly")
        select_combo(page, r"^\d\. By ", "4. By Station Code")
        set_metrics_date_range(page, start, end)
        export_visual(page, r"^Menu options, Business Metrics", out_dir / f"business_metrics_by_station_{rng}.csv")
        export_visual(page, r"^Menu options, Metric by Show By", out_dir / f"quality_metrics_by_station_{rng}.csv")
        select_combo(page, r"^\d\. By ", "5. By DSP Company")
        export_visual(page, r"^Menu options, Metric by Show By", out_dir / f"quality_metrics_network_{rng}.csv")
        select_combo(page, r"^\d\. By ", "4. By Station Code")  # dejamos la vista como estaba

        # ── Hoja 2: defectos a nivel de pedido ──
        open_sheet(page, "Order Level View")
        expand_controls(page)
        set_orders_date_range(page, start, end)
        export_visual(page, r"^Menu options, Order Level Data", out_dir / f"order_level_defects_{rng}.csv")

        ctx.storage_state(path=str(STATE_FILE))
        browser.close()

    (out_dir / "manifest.json").write_text(json.dumps({
        "downloaded_at": dt.datetime.now().isoformat(timespec="seconds"),
        "range": {"from": start.isoformat(), "to": end.isoformat(), "weeks": rng},
        "dashboard": DASH_URL}, indent=2))
    log("Descarga completa")

    if a.merge:
        script = REPO / "scripts" / "lighthouse_to_dashboard.py"
        log(f"Fusionando en Dashboard.jsx …")
        subprocess.run([sys.executable, str(script), str(out_dir), "--jsx", str(REPO / "src" / "Dashboard.jsx")], check=True)
        if a.commit:
            subprocess.run(["git", "add", "src/Dashboard.jsx", str(out_dir.relative_to(REPO))], cwd=REPO, check=True)
            r = subprocess.run(["git", "commit", "-m", f"data: Lighthouse {rng} ({today})"], cwd=REPO)
            if r.returncode == 0 and a.push:
                subprocess.run(["git", "push"], cwd=REPO, check=True)
                log("Push hecho → Netlify desplegará la nueva versión")


if __name__ == "__main__":
    try:
        main()
    except PWTimeout as e:
        log(f"Timeout de Playwright: {e}", "ERROR"); sys.exit(2)
