"""Reescribe los marcadores (outline) del PDF del manual con los títulos reales de los encabezados.

Chromium arma el outline desde el texto ya partido en renglones y, cuando un título ocupa dos líneas,
pierde el espacio del salto ("Manual deusuario"). Acá se vuelve a poner cada título tal como está en el HTML.

  python scripts/manual/outline.py <pdf> <titulos.json>

<titulos.json> es una lista de textos de encabezados. Necesita PyMuPDF (`pip install pymupdf`); si no está,
generar.mjs avisa y deja el PDF como lo hizo Chromium (el resto del manual no cambia).
"""
import json
import re
import sys

import pymupdf

pdf, titulos_json = sys.argv[1], sys.argv[2]
clave = lambda t: re.sub(r"\s+", "", t)
reales = {clave(t): t for t in json.load(open(titulos_json, encoding="utf8"))}

doc = pymupdf.open(pdf)
toc = doc.get_toc(simple=True)
arreglado, sin_par = [], []
for nivel, titulo, pagina in toc:
    real = reales.get(clave(titulo))
    if real is None:
        sin_par.append(titulo)
        real = titulo
    arreglado.append([nivel, real, pagina])
doc.set_toc(arreglado)
doc.saveIncr()
doc.close()

# Se vuelve a leer para comprobar.
leido = pymupdf.open(pdf).get_toc(simple=True)
mal = [t for _, t, _ in leido if clave(t) in reales and reales[clave(t)] != t]
print(f"outline: {len(leido)} marcadores, {len(sin_par)} sin título conocido, {len(mal)} distintos del HTML")
sys.exit(1 if mal else 0)
