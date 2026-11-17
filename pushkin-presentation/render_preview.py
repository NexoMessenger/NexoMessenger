#!/usr/bin/env python3
"""Грубый рендер PPTX в PNG (PIL) — только для проверки вёрстки на переполнение."""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from pptx import Presentation
from pptx.util import Emu

ROOT = Path(__file__).resolve().parent
SERIF = "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf"
SERIF_B = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"
SANS = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
SCALE = 110  # px на дюйм
_f = {}


def fnt(path, pt):
    key = (path, round(pt * 4))
    if key not in _f:
        _f[key] = ImageFont.truetype(path, max(6, int(pt / 72 * SCALE)))
    return _f[key]


def px(v):
    return int(Emu(v).inches * SCALE)


def color_of(shape, default=None):
    try:
        if shape.fill.type == 1:
            c = shape.fill.fore_color.rgb
            return "#" + str(c)
    except Exception:
        pass
    return default


def line_color(shape):
    try:
        if shape.line.color and shape.line.color.type is not None:
            return "#" + str(shape.line.color.rgb)
    except Exception:
        pass
    return None


problems = []


def draw_text(dr, shape, img):
    tf = shape.text_frame
    x, y = px(shape.left), px(shape.top)
    w, h = px(shape.width), px(shape.height)
    cy = y
    for p in tf.paragraphs:
        # собрать runs
        runs = [(r.text, r.font.size.pt if r.font.size else 12,
                 r.font.bold if r.font.bold is not None else False) for r in p.runs if r.text]
        if not runs:
            continue
        total_pt = max(r[1] for r in runs)
        ls = p.line_spacing or 1.2
        lh = total_pt / 72 * SCALE * ls
        # перенос по словам (простая модель: режем по ширине)
        words = []
        for txt, pt, bold in runs:
            for wd in txt.split(" "):
                words.append((wd, pt, bold))
        line, cur_w = [], 0
        lines = []
        space_w = fnt(SERIF, total_pt).getlength(" ")
        for wd, pt, bold in words:
            f = fnt(SANS, pt)
            ww = f.getlength(wd + " ")
            if cur_w + ww > w and line:
                lines.append(line); line, cur_w = [], 0
            line.append((wd, pt, bold)); cur_w += ww
        lines.append(line)
        align = p.alignment
        for ln in lines:
            lw = sum(fnt(SANS, pt).getlength(wd + " ") for wd, pt, bold in ln)
            cx = x
            if align is not None and str(align).startswith("CENTER"):
                cx = x + (w - lw) / 2
            elif align is not None and str(align).startswith("RIGHT"):
                cx = x + w - lw - 4
            for wd, pt, bold in ln:
                f = fnt(SERIF, pt)
                dr.text((cx, cy), wd + " ", font=f, fill="#F0EAE0")
                cx += f.getlength(wd + " ")
            cy += lh
        cy += (p.space_after.pt if p.space_after else 0) / 72 * SCALE * 1.4
    if cy - y > h + 6:
        problems.append(f"OVERFLOW text: {shape.text_frame.text[:40]!r} need {int(cy-y)}px, box {h}px")


def render(pptx_path, outdir):
    prs = Presentation(str(pptx_path))
    W, H = px(prs.slide_width), px(prs.slide_height)
    outdir.mkdir(exist_ok=True)
    files = []
    for i, slide in enumerate(prs.slides, 1):
        img = Image.new("RGB", (W, H), "#0d0d13")
        dr = ImageDraw.Draw(img)
        for sh in slide.shapes:
            if sh.shape_type == 13:  # picture
                try:
                    pic = Image.open(sh.image.blob and __import__("io").BytesIO(sh.image.blob))
                    pic = pic.convert("RGBA").resize((max(1, px(sh.width)), max(1, px(sh.height))), Image.LANCZOS)
                    img.paste(pic, (px(sh.left), px(sh.top)), pic)
                except Exception as e:
                    dr.rectangle([px(sh.left), px(sh.top), px(sh.left) + px(sh.width), px(sh.top) + px(sh.height)],
                                 outline="#663")
                continue
            fill = color_of(sh)
            lc = line_color(sh)
            if sh.has_text_frame and not sh.text_frame.text.strip():
                fill = fill or None
            if fill or lc:
                r = min(px(sh.height) / 2, 26)
                try:
                    dr.rounded_rectangle([px(sh.left), px(sh.top), px(sh.left) + px(sh.width),
                                          px(sh.top) + px(sh.height)], radius=r, fill=fill, outline=lc)
                except Exception:
                    pass
            if sh.has_text_frame and sh.text_frame.text.strip():
                draw_text(dr, sh, img)
        f = outdir / f"slide{i:02d}.png"
        img.save(f)
        files.append(f)
    return files


if __name__ == "__main__":
    files = render(ROOT / "Пушкин — жизнь и творчество.pptx", ROOT / "preview")
    print("\n".join(str(f) for f in files))
    print("\n".join(problems) if problems else "no overflow")
