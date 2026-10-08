"""Setzt den Basis-Pfad für GitHub Pages (/<repo>/) in HTML, CSS und JS."""
import pathlib
import re
import sys

root, base = pathlib.Path(sys.argv[1]), sys.argv[2]

for f in root.rglob("*"):
    if f.suffix not in {".html", ".css", ".js"}:
        continue
    s = f.read_text(encoding="utf-8")
    s = re.sub(r'((?:href|src|action|srcset)=")/(?!/)', rf"\1{base}", s)
    s = re.sub(r"(srcset=\"[^\"]*?, )/", rf"\1{base}", s)
    s = re.sub(r"url\(/(?!/)", f"url({base}", s)
    s = re.sub(r"`/(hero/|api/)", rf"`{base}\1", s)
    s = s.replace("return`/`+e", f"return`{base}`+e")
    f.write_text(s, encoding="utf-8")
