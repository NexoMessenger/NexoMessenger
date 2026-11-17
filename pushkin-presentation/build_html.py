#!/usr/bin/env python3
"""Собирает автономный HTML: подставляет картинки из assets/ как base64 в template.html."""
import base64
from pathlib import Path

ROOT = Path(__file__).resolve().parent
VARS = {
    "{{KIPRENSKY}}": "kiprensky.jpg",
    "{{LICEY}}": "licey.jpg",
    "{{MIHAILOVSKOE}}": "mihailovskoe.jpg",
    "{{GONCHAROVA}}": "goncharova.jpg",
    "{{DUEL}}": "duel.jpg",
}

html = (ROOT / "template.html").read_text()
for key, name in VARS.items():
    data = base64.b64encode((ROOT / "assets" / name).read_bytes()).decode()
    mime = "image/png" if name.endswith(".png") else "image/jpeg"
    html = html.replace(key, f"data:{mime};base64,{data}")

out = ROOT / "Pushkin-prezentaciya.html"
out.write_text(html)
print("saved", out, round(len(html.encode()) / 1024 / 1024, 2), "MB")
