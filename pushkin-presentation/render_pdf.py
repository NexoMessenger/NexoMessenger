#!/usr/bin/env python3
"""Рендер PPTX в PNG и PDF (PIL) — чтобы презентацию можно было посмотреть
и распечатать без PowerPoint."""
from pathlib import Path
from io import BytesIO

from PIL import Image, ImageDraw, ImageFont
from pptx import Presentation
from pptx.util import Emu

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "preview"
SCALE = 200  # px на дюйм

SERIF = "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf"
SERIF_B = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"
SANS = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
SANS_B = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FF = {}

P = "http://schemas.openxmlformats.org/presentationml/2006/main"
A = "http://schemas.openxmlformats.org/drawingml/2006/main"


def fnt(name, pt, bold=False):
    family = SERIF if (name or "").lower().startswith(("georgia", "times", "cormorant", "playfair")) else SANS
    if bold:
        family = SERIF_B if family == SERIF else SANS_B
    key = (family, round(pt * 4))
    if key not in FF:
        FF[key] = ImageFont.truetype(family, max(6, int(round(pt / 72 * SCALE))))
    return FF[key]


def px(emu):
    return int(round(Emu(emu).inches * SCALE))


def hx(rgb):
    return "#" + str(rgb)


def shape_fill(sh):
    try:
        if sh.fill.type == 1:  # solid
            return hx(sh.fill.fore_color.rgb)
    except Exception:
        pass
    return None


def shape_grad(sh):
    """Вернёт (top, bottom) для градиентного фона или None."""
    el = sh._element
    grad = el.find(f".//{{{A}}}gradFill")
    if grad is None:
        return None
    stops = []
    for gs in grad.findall(f"{{{A}}}gs"):
        clr = gs.find(f"{{{A}}}srgbClr")
        if clr is not None:
            stops.append((int(gs.get("pos", "0")), "#" + clr.get("val")))
    if len(stops) < 2:
        return None
    stops.sort()
    return stops[0][1], stops[-1][1]


def shape_line(sh):
    try:
        lt = sh.line.width
        col = sh.line.color
        if col is not None and col.type is not None:
            return hx(col.rgb), max(1, int(px(lt)) if lt else 1)
    except Exception:
        pass
    return None, 0


def gradient_bg(size, top, bottom):
    w, h = size
    img = Image.new("RGB", (1, h))
    dr = ImageDraw.Draw(img)
    t = tuple(int(top[i:i + 2], 16) for i in (1, 3, 5))
    b = tuple(int(bottom[i:i + 2], 16) for i in (1, 3, 5))
    for y in range(h):
        k = y / max(1, h - 1)
        dr.point((0, y), tuple(int(t[i] + (b[i] - t[i]) * k) for i in range(3)))
    return img.resize((w, h), Image.BILINEAR)


def para_runs(p):
    out = []
    for r in p.runs:
        if not r.text:
            continue
        f = r.font
        pt = f.size.pt if f.size else 12
        try:
            col = hx(f.color.rgb) if f.color and f.color.type is not None else "#F3ECE0"
        except Exception:
            col = "#F3ECE0"
        spc = 0
        rPr = r._r.find(f"{{{A}}}rPr")
        if rPr is not None and rPr.get("spc"):
            spc = int(rPr.get("spc")) / 100.0  # pt
        out.append(dict(text=r.text, pt=pt, bold=bool(f.bold), italic=bool(f.italic),
                        name=f.name, color=col, spc=spc))
    return out


def layout_text(shape):
    """Разбивает текст на строки с учётом ширины и возвращает список строк-сегментов."""
    tf = shape.text_frame
    width_px = px(shape.width)
    lines = []
    for p in tf.paragraphs:
        runs = para_runs(p)
        if not runs:
            continue
        base_pt = max(r["pt"] for r in runs)
        wrap_pt = base_pt
        ls = p.line_spacing if isinstance(p.line_spacing, float) else 1.18
        cur, cur_w = [], 0
        for r in runs:
            f = fnt(r["name"], r["pt"], r["bold"])
            words = r["text"].split(" ")
            for i, w in enumerate(words):
                piece = w + ("" if i == len(words) - 1 else " ")
                wpx = f.getlength(piece) + r["spc"] / 72 * SCALE * len(piece)
                if cur_w + wpx > width_px and cur:
                    lines.append(dict(segs=cur, pt=base_pt, ls=ls, align=p.alignment,
                                      after=(p.space_after.pt if p.space_after else 0),
                                      before=(p.space_before.pt if p.space_before else 0)))
                    cur, cur_w = [], 0
                    # пробел в начале новой строки не нужен
                seg = {k: v for k, v in r.items() if k != "text"}
                seg["text"] = piece
                cur.append(seg)
                cur_w += wpx
        lines.append(dict(segs=cur, pt=wrap_pt, ls=ls, align=p.alignment,
                          after=(p.space_after.pt if p.space_after else 0),
                          before=(p.space_before.pt if p.space_before else 0)))
    return lines


def draw_line(img, x, y, segs, align, box_w):
    """Рисует одну строку, возвращает её высоту."""
    height = max(int(s["pt"] / 72 * SCALE * 1.32) for s in segs)
    widths = []
    for s in segs:
        f = fnt(s["name"], s["pt"], s["bold"])
        widths.append(f.getlength(s["text"]) + s["spc"] / 72 * SCALE * len(s["text"]))
    total = sum(widths)
    a = str(align)
    if "CENTER" in a:
        cx = x + (box_w - total) / 2
    elif "RIGHT" in a:
        cx = x + box_w - total
    else:
        cx = x
    italic = any(s["italic"] for s in segs)
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    dr = ImageDraw.Draw(layer)
    for s, w in zip(segs, widths):
        f = fnt(s["name"], s["pt"], s["bold"])
        if abs(s["spc"]) > 0.01:
            for ch in s["text"]:
                dr.text((cx, y), ch, font=f, fill=s["color"])
                cx += f.getlength(ch) + s["spc"] / 72 * SCALE
        else:
            dr.text((cx, y), s["text"], font=f, fill=s["color"])
            cx += w
    if italic:
        layer = layer.transform(layer.size, Image.AFFINE, (1, 0.19, -0.19 * y, 0, 1, 0), resample=Image.BICUBIC)
    img.alpha_composite(layer) if img.mode == "RGBA" else img.paste(layer, (0, 0), layer)
    return height


def render_text(img, sh):
    lines = layout_text(sh)
    if not lines:
        return
    x, y = px(sh.left), px(sh.top)
    w, h = px(sh.width), px(sh.height)
    sizes = []
    for ln in lines:
        lh = max(s["pt"] for s in ln["segs"]) / 72 * SCALE * ln["ls"]
        sizes.append(lh + (ln["after"] + ln["before"]) / 72 * SCALE)
    total = sum(sizes)
    anchor = str(sh.text_frame.vertical_anchor)
    if "MIDDLE" in anchor:
        cy = y + (h - total) / 2
    elif "BOTTOM" in anchor:
        cy = y + h - total
    else:
        cy = y
    for ln, lh in zip(lines, sizes):
        cy += ln["before"] / 72 * SCALE
        draw_line(img, x, cy, ln["segs"], ln["align"], w)
        cy += lh


def render_shape(img, sh):
    x, y = px(sh.left), px(sh.top)
    w, h = max(1, px(sh.width)), max(1, px(sh.height))
    grad = shape_grad(sh)
    fill = shape_fill(sh)
    lcol, lw = shape_line(sh)
    if grad:
        bg = gradient_bg((w, h), *grad)
        img.paste(bg, (x, y))
        return
    if fill is None and lcol is None:
        return
    radius = 0
    try:
        if sh.adjustments and len(sh.adjustments):
            radius = int(min(w, h) * float(sh.adjustments[0]))
    except Exception:
        radius = 0
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    dr = ImageDraw.Draw(layer)
    box = [x, y, x + w, y + h]
    if radius > 1:
        dr.rounded_rectangle(box, radius=radius, fill=fill, outline=lcol,
                             width=max(1, lw) if lcol else 0)
    else:
        dr.rectangle(box, fill=fill, outline=lcol, width=max(1, lw) if lcol else 0)
    img.alpha_composite(layer)


def render_slide(slide, size):
    W, H = size
    img = Image.new("RGBA", (W, H), "#0d0d13")
    for sh in slide.shapes:
        if sh.shape_type == 13:  # PICTURE
            try:
                pic = Image.open(BytesIO(sh.image.blob)).convert("RGBA")
                pic = pic.resize((max(1, px(sh.width)), max(1, px(sh.height))), Image.LANCZOS)
                img.alpha_composite(pic, (px(sh.left), px(sh.top)))
            except Exception:
                pass
            continue
        render_shape(img, sh)
        if sh.has_text_frame and sh.text_frame.text.strip():
            render_text(img, sh)
    return img.convert("RGB")


def main():
    prs = Presentation(str(ROOT / "Pushkin-prezentaciya.pptx"))
    W, H = px(prs.slide_width), px(prs.slide_height)
    OUT.mkdir(exist_ok=True)
    pages, files = [], []
    for i, slide in enumerate(prs.slides, 1):
        img = render_slide(slide, (W, H))
        f = OUT / f"slide{i:02d}.png"
        img.save(f)
        files.append(f)
        pages.append(img)
    pdf = ROOT / "Pushkin-prezentaciya.pdf"
    pages[0].save(pdf, "PDF", resolution=SCALE, save_all=True, append_images=pages[1:])
    print(f"PNG: {len(files)} -> {OUT}")
    print(f"PDF: {pdf} ({pdf.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
