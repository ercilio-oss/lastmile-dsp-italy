#!/usr/bin/env python3
"""
set_password.py — cambia la contraseña de acceso (front-end) del dashboard.

  python3 scripts/set_password.py            # la pide por teclado sin mostrarla
  python3 scripts/set_password.py "Nueva-Clave-1234"

Guarda en src/Dashboard.jsx el hash SHA-256 de "<ACCESS_SALT>:<contraseña>".
Después: git commit + git push (Netlify redespliega). Los dispositivos ya
autenticados tendrán que volver a introducir la contraseña.
"""
import hashlib, re, sys, getpass, pathlib

jsx = pathlib.Path(__file__).resolve().parent.parent / "src" / "Dashboard.jsx"
pw = sys.argv[1] if len(sys.argv) > 1 else getpass.getpass("Nueva contraseña: ")
if len(pw) < 8:
    sys.exit("Mínimo 8 caracteres.")
src = jsx.read_text(encoding="utf-8")
salt = re.search(r'const ACCESS_SALT = "([^"]+)"', src).group(1)
h = hashlib.sha256(f"{salt}:{pw}".encode()).hexdigest()
new = re.sub(r'(const ACCESS_HASH = ")[0-9a-f]*(")', lambda m: m.group(1) + h + m.group(2), src)
if new == src:
    sys.exit("No se encontró ACCESS_HASH en Dashboard.jsx (o la contraseña es la misma).")
jsx.write_text(new, encoding="utf-8")
print(f"ACCESS_HASH actualizado en {jsx}. Haz commit + push para desplegar.")
