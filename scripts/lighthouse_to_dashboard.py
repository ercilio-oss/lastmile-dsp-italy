#!/usr/bin/env python3
"""
lighthouse_to_dashboard.py
==========================
Convierte las exportaciones CSV del dashboard QuickSight "AGL DSP Lighthouse"
en las constantes de datos de src/Dashboard.jsx y las fusiona en el fichero.

Entradas (carpeta data/lighthouse/<fecha>/):
  quality_metrics_by_station_*.csv   pivot "Metric by Show By..." con Show By = 4. By Station Code, granularidad semanal
  quality_metrics_network_*.csv      misma pivot con Show By = 5. By DSP Company
  business_metrics_by_station_*.csv  pivot "Business Metrics" (Orders / Routes) por estación y semana
  order_level_defects_*.csv          tabla "Order Level Data" (una fila por defecto de pedido)

Uso:
  python3 scripts/lighthouse_to_dashboard.py data/lighthouse/2026-09-14 [--jsx src/Dashboard.jsx] [--dry-run]

Convenciones:
  * Semana Amazon = domingo→sábado. W1/2026 empieza el 28/12/2025. En 2026 coincide con la
    numeración ISO para lun–sáb; el domingo se cuenta en la semana siguiente.
  * NCC  = ior_attribution == "Not call compliant"
  * Late (tabla de conductores) = ior_attribution == "Late Batch Ops Controllable" (class_late + class_late_gt15)
  * pondFP / pondPP = recuento de attribution que contiene "FTPDF FP" / "FTPDF PP" ÷ Orders de la semana
  * Sólo se añaden semanas que aún no existen en el JSX (idempotente).
"""
import csv, json, re, sys, glob, os, datetime as dt, argparse
from collections import defaultdict, OrderedDict

W1_2026 = dt.date(2025, 12, 28)
STATIONS = ["UIT4", "UIT1", "UIT7", "UBA1", "UIL7"]
CITY = {"UIT4": "Roma", "UIT1": "Milano", "UIT7": "Milano", "UBA1": "Bologna", "UIL7": "Milano"}
DEPOT_METRICS = {  # campo JSX -> metric_name QuickSight
    "late": "~ % Late > 15", "fondCtrl": "~ % FOND Ops controllable", "ftfdf": "% FTFDF",
    "pdnr": "% PDNR", "fdnr": "% FDNR", "ftdc": "% FTDC", "ftpdf": "% FTPDF",
}
NET_METRICS = {"late": "~ % Late > 15", "fond": "~ % FOND Ops controllable", "pdnr": "% PDNR",
               "ftfdf": "% FTFDF", "ftfdfOC": "~ % FOND Ops controllable"}

def week_of(datestr):
    d = dt.datetime.strptime(datestr[:10], "%Y-%m-%d").date()
    n = (d - W1_2026).days // 7 + 1
    year = 2026
    while n > 52:  # W1/2027 empezaría el 27/12/2026 (aprox.) — ajustar si hace falta
        n -= 52; year += 1
    return year, n

def wkey(y, n): return f"{y}-W{n}"
def pct(v): return round(float(v) * 100, 2) if v not in ("", None) else None

def one(pattern, folder):
    f = sorted(glob.glob(os.path.join(folder, pattern)))
    if not f: sys.exit(f"Falta fichero {pattern} en {folder}")
    return f[-1]

def read(f): return list(csv.DictReader(open(f, encoding="utf-8-sig")))

def js_obj_to_json(txt):
    """Convierte literales JS ({name:"x",w:{"2025-W1":1}}) a JSON válido."""
    txt = re.sub(r'([{,]\s*)([A-Za-z_]\w*)\s*:', r'\1"\2":', txt)
    txt = re.sub(r',\s*,', ',', txt)          # elisiones ",," en arrays
    txt = re.sub(r',\s*([\]}])', r'\1', txt)  # comas finales
    return json.loads(txt)

def dump_js(obj):
    """JSON compacto con claves sin comillas cuando son identificadores (estilo del JSX)."""
    s = json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
    return re.sub(r'"([A-Za-z_]\w*)":', r'\1:', s)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("folder"); ap.add_argument("--jsx", default="src/Dashboard.jsx"); ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    # ── 1. Métricas semanales por estación ─────────────────────────────
    depot = defaultdict(dict)   # (stn, wk) -> {field: val}
    for r in read(one("quality_metrics_by_station_*.csv", a.folder)):
        stn = r["Show 4. By Station Code"]; y, n = week_of(r["Time Granularity (2. Weekly)"])
        for fld, mname in DEPOT_METRICS.items():
            if r["metric_name"] == mname:
                depot[(stn, (y, n))][fld] = pct(r["Metric (CUSTOM)"])
    network = defaultdict(dict)
    for r in read(one("quality_metrics_network_*.csv", a.folder)):
        y, n = week_of(r["Time Granularity (2. Weekly)"])
        for fld, mname in NET_METRICS.items():
            if r["metric_name"] == mname:
                network[(y, n)][fld] = pct(r["Metric (CUSTOM)"])
    orders = {}
    for r in read(one("business_metrics_by_station_*.csv", a.folder)):
        orders[(r["Show 4. By Station Code"], week_of(r["Time Granularity"]))] = int(r["Orders"] or 0)

    # ── 2. Defectos a nivel de pedido ──────────────────────────────────
    rows = read(one("order_level_defects_*.csv", a.folder))
    pond = defaultdict(lambda: {"FP": 0, "PP": 0})
    ncc_stn = defaultdict(lambda: defaultdict(int)); ncc_drv = defaultdict(lambda: {"stations": set(), "w": defaultdict(int)})
    late_stn = defaultdict(lambda: defaultdict(int)); gt15_stn = defaultdict(lambda: defaultdict(int))
    late_drv = defaultdict(lambda: {"s": set(), "l": 0, "g": 0, "w": defaultdict(int)})
    weeks = set()
    for r in rows:
        stn = r["delivery_station_code"]; y, n = week_of(r["delivery_date"]); wk = wkey(y, n); weeks.add((y, n))
        attr = r["ior_attribution"]; tid = r["transporter_id"]
        if "FTPDF FP" in attr: pond[(stn, (y, n))]["FP"] += 1
        if "FTPDF PP" in attr: pond[(stn, (y, n))]["PP"] += 1
        if attr == "Not call compliant":
            ncc_stn[stn][wk] += 1; ncc_drv[tid]["stations"].add(stn); ncc_drv[tid]["w"][wk] += 1
        if attr == "Late Batch Ops Controllable":
            late_stn[stn][wk] += 1; late_drv[tid]["s"].add(stn); late_drv[tid]["w"][wk] += 1
            if r["ior_defect"] == "class_late_gt15": gt15_stn[stn][wk] += 1; late_drv[tid]["g"] += 1
            else: late_drv[tid]["l"] += 1
    for (stn, w), o in orders.items():  # 0 cuando hay pedidos pero ningún defecto FTPDF
        if o and (stn, w) in depot:
            c = pond.get((stn, w), {"FP": 0, "PP": 0})
            depot[(stn, w)]["pondFP"] = round(100 * c["FP"] / o, 2); depot[(stn, w)]["pondPP"] = round(100 * c["PP"] / o, 2)
    weeks = sorted(weeks | set(w for _, w in depot))
    print(f"Semanas en los datos: {[wkey(*w) for w in weeks]}")

    # ── 3. Fusionar en Dashboard.jsx ───────────────────────────────────
    src = open(a.jsx, encoding="utf-8").read()
    orig = src
    def existing_weeks(block):  # devuelve {(year, n)} presentes en un bloque de datos
        return set((int(y), int(n)) for y, n in re.findall(r'year:(\d{4}),week:"W(\d+)"', block))

    # 3a. ALL_DEPOT_DATA
    for stn in STATIONS:
        m = re.search(r'(\n  %s: \[\n)(.*?)(\n  \],)' % stn, src, re.S)
        if not m: print(f"AVISO: no encuentro el bloque {stn} en ALL_DEPOT_DATA"); continue
        have = existing_weeks(m.group(2)); new_lines = []
        for w in weeks:
            d = depot.get((stn, w))
            if not d or w in have: continue
            row = OrderedDict([("year", w[0]), ("week", f"W{w[1]}")])
            for fld in ["late", "fondCtrl", "ftfdf", "pdnr", "fdnr", "ftdc", "pondFP", "pondPP", "ftpdf"]:
                row[fld] = d.get(fld)
            new_lines.append("    " + dump_js(row) + ",")
        if new_lines:
            marker = f"    // {weeks[0][0]} — Lighthouse export {os.path.basename(a.folder.rstrip('/'))}"
            src = src.replace(m.group(0), m.group(1) + m.group(2) + "\n" + marker + "\n" + "\n".join(new_lines) + m.group(3))
            print(f"{stn}: +{len(new_lines)} semanas")
        else: print(f"{stn}: sin semanas nuevas")

    # 3b. NETWORK
    m = re.search(r'(const NETWORK = \[\n)(.*?)(\n\];)', src, re.S)
    have = existing_weeks(m.group(2)); new_lines = []
    for w in weeks:
        d = network.get(w)
        if not d or w in have: continue
        row = OrderedDict([("year", w[0]), ("week", f"W{w[1]}")])
        for fld in ["late", "fond", "pdnr", "ftfdf", "ftfdfOC"]: row[fld] = d.get(fld)
        new_lines.append("  " + dump_js(row) + ",")
    if new_lines:
        src = src.replace(m.group(0), m.group(1) + m.group(2) + "\n" + "\n".join(new_lines) + m.group(3)); print(f"NETWORK: +{len(new_lines)} semanas")

    # 3c. Semanas de defectos + tablas por estación (JSON en una línea)
    def merge_json_const(name, newdata, src):
        m = re.search(r'const %s = (\{.*?\});' % name, src)
        cur = json.loads(m.group(1))
        for stn, wks in newdata.items():
            cur.setdefault(stn, {})
            for wk, v in wks.items(): cur[stn][wk] = v
        for stn in cur:  # rellenar con 0 las semanas nuevas sin defectos
            for w in weeks: cur[stn].setdefault(wkey(*w), 0)
        return src.replace(m.group(0), f"const {name} = {json.dumps(cur, separators=(',', ':'))};")
    for name in ["NCC_WEEKS", "LATE_WEEKS"]:
        m = re.search(r'const %s = (\[.*?\]);' % name, src); cur = json.loads(m.group(1))
        for w in weeks:
            if wkey(*w) not in cur: cur.append(wkey(*w))
        src = src.replace(m.group(0), f"const {name} = {json.dumps(cur, separators=(',', ':'))};")
    src = merge_json_const("NCC_STATION_WEEKLY", ncc_stn, src)
    src = merge_json_const("LATE_STN_WEEKLY", late_stn, src)
    src = merge_json_const("LATE_GT15_STN", gt15_stn, src)

    # 3d. TID -> nombre (para NCC usamos nombre cuando lo conocemos)
    m = re.search(r'const TID_NAME = \{(.*?)\n\};', src, re.S)
    tid_name = dict(re.findall(r'"([A-Z0-9]+)":"([^"]+)"', m.group(1)))
    def drv_name(tid): return tid_name.get(tid, f"ID:{tid[:12]}")

    # 3e. NCC_DRIVERS (fusión por nombre)
    m = re.search(r'const NCC_DRIVERS = \[\n(.*?)\n\];', src, re.S)
    ncc_list = js_obj_to_json("[" + m.group(1) + "]"); ncc_list = [d for d in ncc_list if d]
    by_name = {d["name"]: d for d in ncc_list}
    new_weeks = [wkey(*w) for w in weeks]
    for tid, info in ncc_drv.items():
        name = drv_name(tid); stns = sorted(info["stations"])
        d = by_name.get(name)
        if not d:
            loc = CITY.get(stns[0], "?") if len(stns) == 1 else ("Roma" if "UIT4" in stns else "Milano")
            d = {"name": name, "loc": loc, "stations": stns, "total": 0, "w": {}}; ncc_list.append(d); by_name[name] = d
        for s in stns:
            if s not in d["stations"]: d["stations"].append(s)
        for wk, v in info["w"].items(): d["w"][wk] = v
        d["total"] = sum(d["w"].values())
    ncc_list.sort(key=lambda d: -d["total"])
    src = src.replace(m.group(0), "const NCC_DRIVERS = [\n" + ",\n".join("  " + dump_js(d) for d in ncc_list) + "\n];")
    # actualizar NCC_TID_MAP con los nuevos nombres conocidos
    m2 = re.search(r'(const NCC_TID_MAP = \{)(.*?)(\n\};)', src, re.S)
    have_map = set(re.findall(r'"([^"]+)":"[A-Z0-9]+"', m2.group(2))); add = []
    for tid in ncc_drv:
        nm = drv_name(tid)
        if nm not in have_map: add.append(f'"{nm}":"{tid}"'); have_map.add(nm)
    if add: src = src.replace(m2.group(0), m2.group(1) + m2.group(2) + "\n  " + ",".join(add) + "," + m2.group(3))

    # 3f. LATE_DRIVERS (fusión por TID)
    m = re.search(r'const LATE_DRIVERS = \[\n(.*?)\n\];', src, re.S)
    late_list = js_obj_to_json("[" + m.group(1) + "]"); late_list = [d for d in late_list if d]
    by_tid = {d["tid"]: d for d in late_list}
    for tid, info in late_drv.items():
        d = by_tid.get(tid)
        if not d: d = {"tid": tid, "s": sorted(info["s"]), "l": 0, "g": 0, "t": 0, "w": {}}; late_list.append(d); by_tid[tid] = d
        for s in info["s"]:
            if s not in d["s"]: d["s"].append(s)
        for wk, v in info["w"].items(): d["w"][wk] = v
        d["l"] += info["l"]; d["g"] += info["g"]; d["t"] = d["l"] + d["g"]
    late_list.sort(key=lambda d: -d["t"])
    src = src.replace(m.group(0), "const LATE_DRIVERS = [\n" + ",\n".join("  " + dump_js(d) for d in late_list) + "\n];")

    # 3g. cabecera de rango en el comentario de datos
    last = weeks[-1]; src = src.replace("(Order-Level, W47/25–W7/26)", f"(Order-Level, W47/25–W{last[1]}/{str(last[0])[2:]})")

    if a.dry_run: print("--dry-run: no se escribe nada"); return
    if src != orig:
        open(a.jsx, "w", encoding="utf-8").write(src); print(f"Escrito {a.jsx} ({len(src)} bytes)")
    else: print("Sin cambios")

if __name__ == "__main__": main()
