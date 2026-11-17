#!/usr/bin/env python3
"""Генератор PPTX-презентации «А. С. Пушкин — жизнь и творчество»."""
import os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor as _RGBColor


def RGBColor(*a):
    """RGBColor(0xRRGGBB) или RGBColor(r, g, b)."""
    if len(a) == 1:
        return _RGBColor.from_string('%06X' % a[0])
    return _RGBColor(*a)
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE
from pptx.oxml.ns import qn
from pptx.oxml import parse_xml
import copy

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "assets"
CACHE = ROOT / "pptx-assets"
CACHE.mkdir(exist_ok=True)

# ── палитра ────────────────────────────────────────────────
INK      = RGBColor(0x0B, 0x0B, 0x10)
INK2     = RGBColor(0x12, 0x12, 0x1A)
CARD     = RGBColor(0x18, 0x18, 0x21)
CARD_HI  = RGBColor(0x26, 0x22, 0x1A)
GOLD     = RGBColor(0xD9, 0xB8, 0x74)
GOLD_SOFT= RGBColor(0xE8, 0xD5, 0xA8)
PAPER    = RGBColor(0xF3, 0xEC, 0xE0)
MUTED    = RGBColor(0xA9, 0xA2, 0x95)
DIMLINE  = RGBColor(0x3B, 0x33, 0x24)

SERIF = "Georgia"
SANS  = "Trebuchet MS"

W, H = 13.3333, 7.5
M = 0.9          # левое поле
CW = W - 2 * M   # ширина контента

# ── измерение текста (DejaVu — шире Georgia, даёт запас) ───
FONT_BODY = "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"
_fcache = {}


def font(path, px):
    key = (path, px)
    if key not in _fcache:
        _fcache[key] = ImageFont.truetype(path, px)
    return _fcache[key]


def text_width_in(text, pt, bold=False):
    f = font(FONT_BOLD if bold else FONT_BODY, int(pt * 4))
    return f.getlength(text) / 4 / 72


def wrap(text, max_w_in, pt, bold=False):
    words, lines, cur = text.split(), [], ""
    for w in words:
        trial = (cur + " " + w).strip()
        if text_width_in(trial, pt, bold) <= max_w_in or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


# ── подготовка изображений ────────────────────────────────
def rounded(src, out, w, h, radius=48):
    """Кроп под нужные пропорции + скруглённые углы + прозрачный фон."""
    im = Image.open(src).convert("RGB")
    tr = w / h
    sw, sh = im.size
    if sw / sh > tr:
        nw = int(sh * tr)
        im = im.crop(((sw - nw) // 2, 0, (sw + nw) // 2, sh))
    else:
        nh = int(sw / tr)
        im = im.crop((0, (sh - nh) // 2, sw, (sh + nh) // 2))
    im = im.resize((w, h), Image.LANCZOS)
    mask = Image.new("L", (w * 4, h * 4), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, w * 4 - 1, h * 4 - 1], radius=radius * 4, fill=255)
    mask = mask.resize((w, h), Image.LANCZOS)
    im = im.convert("RGBA")
    im.putalpha(mask)
    im.save(out)
    return out


def circle_soft(src, out, size=900, feather=34):
    im = Image.open(src).convert("RGB")
    side = min(im.size)
    im = im.crop(((im.width - side) // 2, max(0, int((im.height - side) * 0.08)),
                  (im.width + side) // 2, max(0, int((im.height - side) * 0.08)) + side))
    im = im.resize((size, size), Image.LANCZOS).convert("RGBA")
    mask = Image.new("L", (size * 2, size * 2), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, size * 2 - 1, size * 2 - 1], fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(feather)).resize((size, size), Image.LANCZOS)
    im.putalpha(mask)
    im.save(out)
    return out


IMG = {
    "kiprensky": circle_soft(ASSETS / "kiprensky.jpg", CACHE / "portrait.png"),
    "licey": rounded(ASSETS / "licey.jpg", CACHE / "licey.png", 1200, 800),
    "mihail": rounded(ASSETS / "mihailovskoe.jpg", CACHE / "mihail.png", 1100, 750),
    "gonch": rounded(ASSETS / "goncharova.jpg", CACHE / "gonch.png", 760, 980),
    "duel": rounded(ASSETS / "duel.jpg", CACHE / "duel.png", 1200, 800),
}

# ── презентация ───────────────────────────────────────────
prs = Presentation()
prs.slide_width = Inches(W)
prs.slide_height = Inches(H)
BLANK = prs.slide_layouts[6]

# тёмный фон-градиент для всех слайдов
BG_XML = parse_xml(
    '<p:sp xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" '
    'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">'
    '<p:nvSpPr><p:cNvPr id="2" name="bg"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>'
    '<p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="%d" cy="%d"/></a:xfrm>'
    '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>'
    '<a:gradFill rotWithShape="1"><a:gsLst>'
    '<a:gs pos="0"><a:srgbClr val="1C1A24"/></a:gs>'
    '<a:gs pos="100000"><a:srgbClr val="06060A"/></a:gs>'
    '</a:gsLst><a:lin ang="5400000" scaled="0"/></a:gradFill>'
    '<a:ln><a:noFill/></a:ln></p:spPr></p:sp>' % (int(Inches(W)), int(Inches(H)))
)


def new_slide():
    s = prs.slides.add_slide(BLANK)
    spTree = s.shapes._spTree
    spTree.insert(2, copy.deepcopy(BG_XML))
    return s


def box(slide, x, y, w, h, fill=None, line=None, lw=0.75, radius=0.06, dash=None):
    shp = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(x), Inches(y), Inches(w), Inches(h))
    shp.adjustments[0] = radius
    if fill is None:
        shp.fill.background()
    else:
        shp.fill.solid()
        shp.fill.fore_color.rgb = fill
    if line is None:
        shp.line.fill.background()
    else:
        shp.line.color.rgb = line
        shp.line.width = Pt(lw)
    shp.shadow.inherit = False
    return shp


def tb(slide, x, y, w, h, anchor=MSO_ANCHOR.TOP):
    t = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = t.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    tf.vertical_anchor = anchor
    return tf


def para(tf, first=False, space_before=0, space_after=0, align=PP_ALIGN.LEFT, line=None):
    p = tf.paragraphs[0] if first else tf.add_paragraph()
    p.alignment = align
    p.space_before = Pt(space_before)
    p.space_after = Pt(space_after)
    if line:
        p.line_spacing = line
    return p


def run(p, text, size, color=PAPER, bold=False, italic=False, font_name=SERIF, spc=None):
    r = p.add_run()
    r.text = text
    f = r.font
    f.size = Pt(size)
    f.bold = bold
    f.italic = italic
    f.name = font_name
    f.color.rgb = color
    if spc is not None:
        r._r.get_or_add_rPr().set("spc", str(int(spc * 100)))
    return r


def kicker(slide, text, y=0.62):
    tf = tb(slide, M, y, CW, 0.3)
    p = para(tf, first=True)
    run(p, "—  ", 11, GOLD, font_name=SANS)
    run(p, text.upper(), 11, GOLD, font_name=SANS, spc=3.2)


def title(slide, parts, y=0.95, size=40, width=None):
    """parts: [(text, highlight)] — highlight рисуется золотом."""
    tf = tb(slide, M, y, width or (CW * 0.92), size / 72 * 3.2)
    first = True
    lines = parts if isinstance(parts[0], list) else [parts]
    for line in lines:
        p = para(tf, first=first, line=0.98)
        first = False
        for txt, hi in line:
            run(p, txt, size, GOLD if hi else PAPER, bold=False)
    return tf


def body(slide, x, y, w, txt, size=14, color=PAPER, italic=False, line=1.35, bold=False, font_name=SERIF):
    lines = wrap(txt, w, size, bold)
    tf = tb(slide, x, y, w, len(lines) * size * 1.35 / 72 + 0.1)
    p = para(tf, first=True, line=line)
    run(p, txt, size, color, italic=italic, bold=bold, font_name=font_name)
    return tf, len(lines) * size * line / 72


def card(slide, x, y, w, h, head=None, years=None, text=None, hi=False, head_size=17, txt_size=11.5, pad=0.28):
    box(slide, x, y, w, h, fill=CARD_HI if hi else CARD, line=GOLD if hi else DIMLINE, lw=0.9, radius=0.07)
    tf = tb(slide, x + pad, y + pad * 0.85, w - 2 * pad, h - pad)
    first = True
    if years:
        p = para(tf, first=True, space_after=4)
        first = False
        run(p, years, 12, GOLD, bold=True, font_name=SERIF)
    if head:
        p = para(tf, first=first, space_after=5, line=1.0)
        first = False
        run(p, head, head_size, GOLD_SOFT if not hi else RGBColor(0xF6, 0xE7, 0xC4), font_name=SERIF)
    if text:
        p = para(tf, first=first, line=1.32)
        run(p, text, txt_size, RGBColor(0xC9, 0xC2, 0xB4), font_name=SERIF)


def photo(slide, path, x, y, w, h, caption=None):
    slide.shapes.add_picture(str(path), Inches(x), Inches(y), Inches(w), Inches(h))
    if caption:
        box(slide, x, y + h - 0.42, w, 0.42, fill=RGBColor(0x08, 0x08, 0x0C), line=None, radius=0.0)
        tf = tb(slide, x + 0.22, y + h - 0.36, w - 0.44, 0.3)
        p = para(tf, first=True)
        run(p, caption, 8.5, MUTED, font_name=SANS)


def quote(slide, x, y, w, text, source, size=19):
    n_lines = text.count("\n") + 1 + 1.2
    bar = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(x), Inches(y), Pt(1.6),
                                Inches(size / 72 * 1.3 * n_lines))
    bar.fill.solid(); bar.fill.fore_color.rgb = GOLD; bar.line.fill.background(); bar.shadow.inherit = False
    tf = tb(slide, x + 0.32, y, w - 0.32, size / 72 * 4)
    for i, chunk in enumerate(text.split("\n")):
        p = para(tf, first=(i == 0), line=1.25)
        run(p, chunk, size, RGBColor(0xFB, 0xF4, 0xE6), italic=True)
    p2 = para(tf, space_before=7)
    run(p2, source.upper(), 9.5, GOLD, font_name=SANS, spc=2.6)


def chips(slide, x, y, items, size=9.5):
    cx = x
    for it in items:
        w = text_width_in(it, size) + 0.5
        if cx + w > W - M:
            break
        box(slide, cx, y, w, 0.32, fill=RGBColor(0x20, 0x1C, 0x14), line=RGBColor(0x4A, 0x3E, 0x27), radius=0.5)
        tf = tb(slide, cx, y + 0.065, w, 0.22)
        p = para(tf, first=True, align=PP_ALIGN.CENTER)
        run(p, it, size, GOLD_SOFT, font_name=SANS)
        cx += w + 0.14
    return cx


def footer(slide, n, total):
    ln = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(M), Inches(H - 0.62), Inches(CW), Pt(0.75))
    ln.fill.solid(); ln.fill.fore_color.rgb = RGBColor(0x24, 0x20, 0x18); ln.line.fill.background(); ln.shadow.inherit = False
    tf = tb(slide, M, H - 0.5, CW * 0.7, 0.25)
    p = para(tf, first=True)
    run(p, "А. С. Пушкин · жизнь и творчество", 8.5, RGBColor(0x6E, 0x68, 0x5E), font_name=SANS, spc=1.6)
    tf2 = tb(slide, W - M - 1.2, H - 0.5, 1.2, 0.25)
    p2 = para(tf2, first=True, align=PP_ALIGN.RIGHT)
    run(p2, f"{n:02d} / {total:02d}", 8.5, GOLD, font_name=SANS, spc=1.6)


TOTAL = 12

# ───────────────────────────────────────────── 1. Титул
s = new_slide()
# портрет справа
pic = s.shapes.add_picture(str(IMG["kiprensky"]), Inches(7.9), Inches(1.05), Inches(4.6), Inches(4.6))
kicker(s, "Русская литература · 9 класс")
tf = tb(s, M, 1.35, 6.6, 2.6)
p = para(tf, first=True, line=0.92)
run(p, "Александр Сергеевич", 25, RGBColor(0xDDD5C6))
p = para(tf, line=0.92)
run(p, "Пушкин", 62, GOLD)
tf = tb(s, M, 3.45, 6.0, 0.5)
p = para(tf, first=True)
run(p, "1799 — 1837", 20, GOLD_SOFT, font_name=SANS, spc=4.5)
ln = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(M), Inches(4.12), Inches(2.6), Pt(1))
ln.fill.solid(); ln.fill.fore_color.rgb = GOLD; ln.line.fill.background(); ln.shadow.inherit = False
tf, _ = body(s, M, 4.45, 5.9,
             "Жизнь и творчество: от лицейских стихов до «Евгения Онегина». Поэт, "
             "который создал современный русский литературный язык.", size=15, color=RGBColor(0xD7, 0xCF, 0xBF), line=1.5)
chips(s, M, 5.72, ["поэт", "драматург", "прозаик", "критик"], size=10)
tf = tb(s, W - M - 2.2, H - 0.5, 2.2, 0.25)
p = para(tf, first=True, align=PP_ALIGN.RIGHT)
run(p, "01 / 12", 8.5, GOLD, font_name=SANS, spc=1.6)

# ─────────────────────────────────── 2. Почему Пушкин — «наше всё»
s = new_slide(); kicker(s, "Значение")
title(s, [[("Почему Пушкин — ", False), ("«наше всё»", True)]])
cards = [
    ("01", "Создатель языка", "Соединил живой разговорный русский с книжным. Его язык лёг в основу современной литературной нормы."),
    ("02", "Мастер всех жанров", "Роман в стихах, трагедия, поэма, повесть, сказка, эпиграмма — везде он был первым."),
    ("03", "«Евгений Онегин»", "Первый русский реалистический роман в стихах и энциклопедия русской жизни."),
]
cy, ch = 2.28, 1.92
cw = (CW - 0.5) / 3
for i, (num, head, txt) in enumerate(cards):
    x = M + i * (cw + 0.25)
    card(s, x, cy, cw, ch, years=num, head=head, text=txt, head_size=18, txt_size=12)
quote(s, M, 4.42, 9.2, "«Пушкин — наше всё: Пушкин — представитель всего нашего душевного, особенного…»",
      "Аполлон Григорьев, 1859", size=16)
# полоса цифр
stats = [("37", "лет жизни"), ("≈ 800", "стихотворений"), ("12", "лет работы над «Онегиным»")]
sx = M
sw_ = (CW - 0.6) / 3
for i, (num, label) in enumerate(stats):
    t = tb(s, sx, 5.62, sw_, 0.45)
    p_ = para(t, first=True)
    run(p_, num, 27, GOLD)
    run(p_, "   " + label, 11, RGBColor(0x9C, 0x95, 0x88), font_name=SANS)
    if i < 2:
        vl = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(sx + sw_ + 0.05), Inches(5.68), Pt(0.9), Inches(0.5))
        vl.fill.solid(); vl.fill.fore_color.rgb = DIMLINE; vl.line.fill.background(); vl.shadow.inherit = False
    sx += sw_ + 0.3

footer(s, 2, TOTAL)

# ───────────────────────────────────────── 3. Детство и Лицей
s = new_slide(); kicker(s, "1799 — 1817")
title(s, [[("Детство и ", False), ("Царское Село", True)]], size=34)
cw2 = 6.2
card(s, M, 2.05, cw2, 1.45, years="1799", head="Москва", head_size=16, txt_size=11.5,
     text="26 мая (6 июня) в старинной дворянской семье. Правнук Абрама Ганнибала — «арапа Петра Великого».")
card(s, M, 3.66, cw2, 1.78, years="1811 — 1817", head="Царскосельский лицей", head_size=16, txt_size=11.5,
     text="Одно из лучших учебных заведений России. Друзья — Пущин, Кюхельбекер, Дельвиг; Державин "
          "услышал его стихи на экзамене и предсказал большое будущее.")
chips(s, M, 5.72, ["«Воспоминания в Царском Селе»", "1815", "лицейское братство"], size=9.5)
photo(s, IMG["licey"], 7.05, 2.05, 5.4, 3.6,
      "И. Е. Репин. «Пушкин на экзамене в Царском Селе», 1911")
footer(s, 3, TOTAL)

# ──────────────────────────────── 4. Петербург и южная ссылка
s = new_slide(); kicker(s, "1817 — 1824")
title(s, [[("Петербург и ", False), ("южная ссылка", True)]], size=34)
card(s, M, 1.95, 5.9, 1.62, years="1817 — 1820", head="Свобода, театр, друзья", head_size=16, txt_size=11.5,
     text="Служба в Коллегии иностранных дел. «Вольность», «К Чаадаеву», «Деревня» — вольнолюбивые стихи.")
card(s, M, 3.72, 5.9, 1.88, years="1820 — 1824", head="Кавказ, Крым, Кишинёв, Одесса", head_size=16, txt_size=11.5,
     text="Ссылка становится подарком: южная романтическая поэзия — «Кавказский пленник», «Бахчисарайский фонтан», «Цыганы».")
card(s, 7.0, 1.95, 5.4, 1.62, years="ВАЖНО", head="Поворот к профессии", head_size=15, txt_size=11.5, hi=True,
     text="На юге Пушкин осознаёт себя профессиональным литератором: стихи — главное дело жизни.")
card(s, 7.0, 3.72, 5.4, 1.88, years="1824", head="Конец ссылки", head_size=15, txt_size=11.5,
     text="За письмо о «атеистических» идеях его увольняют со службы и отправляют в Михайловское под надзор.")
chips(s, M, 5.85, ["романтизм", "южные поэмы", "вольнолюбивая лирика"], size=9.5)
quote(s, 7.05, 5.78, 5.4, "«Пока свободою горим…»", "«К Чаадаеву», 1818", size=13)
footer(s, 4, TOTAL)

# ────────────────────────────────────────── 5. Михайловское
s = new_slide(); kicker(s, "1824 — 1826")
title(s, [[("Михайловское: ", False), ("два года в тишине", True)]], size=32)
photo(s, IMG["mihail"], M, 2.0, 6.05, 4.15, "Н. Н. Ге. «Пушкин в селе Михайловском», 1875")
card(s, 7.35, 2.0, 5.05, 1.42, years="1824", head="Новая ссылка", head_size=15, txt_size=11,
     text="Родовое имение матери под надзором. Вдали от Петербурга много читает и мало печатается.")
card(s, 7.35, 3.56, 5.05, 1.42, years="1825", head="Главное", head_size=15, txt_size=11,
     text="Трагедия «Борис Годунов», поэма «Граф Нулин», центральные главы «Евгения Онегина».")
card(s, 7.35, 5.12, 5.05, 1.42, years="1826", head="Возвращение", head_size=15, txt_size=11,
     text="Николай I возвращает его из ссылки, но берёт на личную цензуру — свободного поэта больше не будет.")
footer(s, 5, TOTAL)

# ─────────────────────────────────────── 6. Болдинская осень
s = new_slide(); kicker(s, "1830")
title(s, [[("Болдинская осень — ", False), ("взрыв гения", True)]], size=34)
tf, _ = body(s, M, 2.0, 10.6, "Три месяца в Нижегородской губернии, отрезанные холерным карантином. "
             "То, что он написал за один сезон, сравнимо с целой библиотекой.", size=14, color=MUTED)
steps = [("Сентябрь", "«Повести Белкина», «Маленькие трагедии»"),
         ("Октябрь", "Последние главы «Евгения Онегина»"),
         ("Октябрь", "«Домик в Коломне», «Пир во время чумы»"),
         ("Ноябрь", "«Медный всадник», сказка о попе"),
         ("Итог", "Около 30 произведений за 3 месяца")]
ln = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(M), Inches(3.42), Inches(CW), Pt(1))
ln.fill.solid(); ln.fill.fore_color.rgb = RGBColor(0x5A, 0x49, 0x2C); ln.line.fill.background(); ln.shadow.inherit = False
sw = (CW - 4 * 0.3) / 5
for i, (yr, txt) in enumerate(steps):
    x = M + i * (sw + 0.3)
    dot = s.shapes.add_shape(MSO_SHAPE.OVAL, Inches(x), Inches(3.32), Inches(0.16), Inches(0.16))
    dot.fill.solid(); dot.fill.fore_color.rgb = GOLD; dot.line.fill.background(); dot.shadow.inherit = False
    t = tb(s, x, 3.72, sw, 0.3)
    p = para(t, first=True)
    run(p, yr, 15, GOLD_SOFT)
    tf, _ = body(s, x, 4.06, sw, txt, size=11.5, color=RGBColor(0xC9, 0xC2, 0xB4), line=1.3)
card(s, M, 5.42, CW, 1.15, head=None, text=None)
tf = tb(s, M + 0.4, 5.66, CW - 0.8, 0.7, anchor=MSO_ANCHOR.TOP)
p = para(tf, first=True, line=1.3)
run(p, "Почему это важно:  ", 11.5, GOLD, font_name=SANS, spc=1.2)
run(p, "Болдинская осень завершает переход Пушкина от романтизма к реализму — от героя-исключения к обычному человеку "
       "и его судьбе. Именно здесь рождается тот Пушкин, которого читают сегодня.", 11.5, RGBColor(0xCF, 0xC8, 0xBA))
footer(s, 6, TOTAL)

# ─────────────────────────────────────────────── 7. Семья
s = new_slide(); kicker(s, "1831 — 1837")
title(s, [[("Дом, семья, ", False), ("Петербург", True)]], size=34)
photo(s, IMG["gonch"], 9.15, 1.9, 3.25, 4.3, "А. П. Брюллов. Портрет Н. Н. Гончаровой, 1831")
cw3 = 7.05
card(s, M, 1.9, cw3, 1.18, years="1831", head="Женитьба", head_size=15, txt_size=11,
     text="18 февраля — венчание с Натальей Николаевной Гончаровой в Москве.")
card(s, M, 3.2, cw3, 1.3, years="1831 — 1837", head="Дети", head_size=15, txt_size=11,
     text="Мария, Александр, Григорий, Наталья. Дом на Мойке, 12 становится литературным салоном.")
card(s, M, 4.62, cw3, 1.18, years="1836 — 1837", head="Долги и заботы", head_size=15, txt_size=11,
     text="Светские расходы росли быстрее доходов, а издательские дела шли трудно.")
quote(s, M, 6.0, 7.05, "«Жена моя прелесть, и чем доле я с ней живу, тем более люблю…»", "из письма, 1834", size=12.5)
footer(s, 7, TOTAL)

# ─────────────────────────────────── 8. Главные произведения
s = new_slide(); kicker(s, "Библиотека")
title(s, [[("Что читать ", False), ("в первую очередь", True)]], size=32)
works = [("1823–1831", "«Евгений Онегин»", "Роман в стихах. «Онегинская строфа» и судьба свободного человека в России."),
         ("1825", "«Борис Годунов»", "Трагедия о власти и совести; народ, который «безмолвствует»."),
         ("1830", "«Повести Белкина»", "Первая русская реалистическая проза: «Метель», «Выстрел», «Станционный смотритель»."),
         ("1830", "«Маленькие трагедии»", "Четыре пьесы о зависти, страсти и смерти: «Моцарт и Сальери», «Каменный гость»."),
         ("1833", "«Медный всадник»", "Петербургская повесть о «маленьком человеке» и мощи империи."),
         ("1836", "«Капитанская дочка»", "Роман о Пугачёвском бунте: честь, милосердие и история.")]
cw4, ch4 = (CW - 0.4) / 3, 1.68
for i, (yr, head, txt) in enumerate(works):
    x = M + (i % 3) * (cw4 + 0.2)
    y = 2.05 + (i // 3) * (ch4 + 0.2)
    card(s, x, y, cw4, ch4, years=yr, head=head, text=txt, head_size=15, txt_size=10.5, hi=(i == 0))
chips(s, M, 5.95, ["сказки", "«Пиковая дама»", "лирика", "«Повести Белкина»", "поэмы"], size=9.5)
footer(s, 8, TOTAL)

# ───────────────────────────────────────── 9. Дуэль
s = new_slide(); kicker(s, "1837")
title(s, [[("Дуэль на ", False), ("Чёрной речке", True)]], size=34)
photo(s, IMG["duel"], M, 1.95, 6.05, 3.9, "Пушкин на смертном одре. По рисунку А. Козлова")
card(s, 7.35, 1.95, 5.05, 1.3, years="4 ноября 1836", head="Анонимный пасквиль", head_size=14, txt_size=10.5,
     text="Оскорбительные письма о жене и Дантесе — удар по чести семьи.")
card(s, 7.35, 3.36, 5.05, 1.3, years="27 января 1837", head="Поединок", head_size=14, txt_size=10.5,
     text="Дуэль с Жоржем Дантесом у Чёрной речки. Смертельное ранение в живот.")
card(s, 7.35, 4.77, 5.05, 1.35, years="29 января 1837", head="Последние минуты", head_size=14, txt_size=10.5,
     text="Умирает на Мойке, 12. Похоронен у Святогорского монастыря.")
quote(s, M, 6.15, 11.0, "«Погиб поэт! — невольник чести — пал, оклеветанный молвой…»", "М. Ю. Лермонтов, 1837", size=15)
footer(s, 9, TOTAL)

# ───────────────────────────────────────── 10. Наследие
s = new_slide(); kicker(s, "Наследие")
title(s, [[("Что осталось ", False), ("после", True)]], size=34)
leg = [("Язык", "Норма и вкус", "Русский литературный язык получил в его текстах ясность, лёгкость и точность."),
       ("Жанры", "Основа традиции", "Реалистический роман, психологическая проза и русская драма выросли из его опыта."),
       ("Память", "Миф и музей", "Михайловское, Болдино, Мойка, 12 — места национальной памяти.")]
cw5 = (CW - 0.5) / 3
for i, (yr, head, txt) in enumerate(leg):
    card(s, M + i * (cw5 + 0.25), 2.05, cw5, 1.62, years=yr, head=head, text=txt, head_size=18, txt_size=11.5)
quote(s, M, 4.15, 9.6, "«Я памятник себе воздвиг нерукотворный,\nК нему не зарастёт народная тропа…»",
      "А. С. Пушкин, 1836", size=20)
footer(s, 10, TOTAL)

# ───────────────────────────────────────── 11. Пять дат
s = new_slide(); kicker(s, "Вывод")
title(s, [[("Пять дат, которые ", False), ("стоит запомнить", True)]], size=32)
dates = [("1799", "Родился в Москве"), ("1811", "Поступил в Царскосельский лицей"),
         ("1830", "Болдинская осень"), ("1831", "Женитьба на Н. Гончаровой"), ("1837", "Дуэль на Чёрной речке")]
dw = (CW - 4 * 0.2) / 5
for i, (yr, txt) in enumerate(dates):
    x = M + i * (dw + 0.2)
    box(s, x, 2.3, dw, 1.75, fill=CARD_HI if i in (0, 4) else CARD, line=GOLD if i in (0, 4) else DIMLINE, lw=0.9)
    tf = tb(s, x + 0.2, 2.62, dw - 0.4, 1.3)
    p = para(tf, first=True, align=PP_ALIGN.CENTER, space_after=8)
    run(p, yr, 24, GOLD)
    p = para(tf, align=PP_ALIGN.CENTER, line=1.25)
    run(p, txt, 11, RGBColor(0xC9, 0xC2, 0xB4))
box(s, M, 4.45, CW, 1.0, fill=RGBColor(0x1A, 0x19, 0x22), line=DIMLINE)
tf = tb(s, M + 0.45, 4.68, CW - 0.9, 0.6)
p = para(tf, first=True)
run(p, "Пушкин прожил 37 лет, но создал то, на что опирается вся русская литература после него: "
       "язык, жанры и способ говорить о человеке.", 13, RGBColor(0xDD, 0xD6, 0xC8))
tf, _ = body(s, M, 5.85, CW, "Источники: А. С. Пушкин. Собрание сочинений; В. В. Вересаев «Пушкин в жизни»; "
             "Ю. М. Лотман «Александр Сергеевич Пушкин»; материалы музеев «Михайловское» и «Болдино».",
             size=10, color=RGBColor(0x7C, 0x76, 0x6C), italic=True, line=1.4)
footer(s, 11, TOTAL)

# ───────────────────────────────────────── 12. Финал
s = new_slide()
pic = s.shapes.add_picture(str(IMG["kiprensky"]), Inches(4.9), Inches(1.15), Inches(3.5), Inches(3.5))
tf = tb(s, M, 4.95, CW, 0.4)
p = para(tf, first=True, align=PP_ALIGN.CENTER)
run(p, "СПАСИБО ЗА ВНИМАНИЕ", 15, GOLD, font_name=SANS, spc=6)
tf, _ = body(s, 3.3, 5.5, 6.75, "«Чтение — вот лучшее учение. Следовать за мыслями великого человека — "
             "есть наука самая занимательная».", size=14, color=RGBColor(0xC9, 0xC2, 0xB4), italic=True)
tf = tb(s, M, 6.75, CW, 0.3)
p = para(tf, first=True, align=PP_ALIGN.CENTER)
run(p, "12 / 12", 8.5, GOLD, font_name=SANS, spc=1.6)


# ───────────────────────────── заметки для выступающего
NOTES = [
    "Здравствуйте! Тема моего выступления — жизнь и творчество Александра Сергеевича Пушкина. "
    "Он прожил всего 37 лет, но именно его тексты стали основой современного русского литературного языка.",

    "Пушкина называют «нашим всем» — и это не преувеличение. Он работал во всех жанрах: роман в стихах, "
    "трагедия, поэма, повесть, сказка, критика. И почти в каждом был первым.",

    "Пушкин родился в 1799 году в Москве, в дворянской семье, его прадедом был Абрам Ганнибал — «арап Петра Великого». "
    "В 1811 году он поступил в Царскосельский лицей, где нашёл друзей на всю жизнь. На экзамене 1815 года его стихи "
    "услышал Державин.",

    "После лицея — Петербург, служба, вольнолюбивые стихи. За них в 1820 году последовала южная ссылка: Кавказ, Крым, "
    "Кишинёв, Одесса. Именно там расцвела его романтическая поэзия.",

    "В 1824 году Пушкин попадает в Михайловское — под надзор, в тишину. Здесь он пишет «Бориса Годунова» и центральные "
    "главы «Евгения Онегина». Это время сосредоточенной работы над собой и над языком.",

    "Осень 1830 года — Болдинская осень. Из-за холерного карантина он застревает в имении на три месяца и пишет около "
    "тридцати произведений: «Повести Белкина», «Маленькие трагедии», «Медный всадник», последние главы «Онегина». "
    "Это момент перехода от романтизма к реализму.",

    "В 1831 году Пушкин женится на Наталье Николаевне Гончаровой. У них четверо детей. Петербургский дом на Мойке, 12 "
    "становится литературным центром, но и источником долгов и светских обязательств.",

    "Если выбирать главное для чтения: «Евгений Онегин» — роман в стихах и энциклопедия русской жизни; «Борис Годунов» — "
    "о власти и совести; «Повести Белкина» — первая русская реалистическая проза; «Капитанская дочка» — о чести и истории.",

    "Конец был трагическим. В ноябре 1836 года появился анонимный пасквиль, оскорблявший честь его семьи. "
    "27 января 1837 года — дуэль с Дантесом на Чёрной речке. 29 января поэт умер.",

    "После Пушкина осталось главное: язык, жанры и способ говорить о человеке. Всё, что делала русская литература "
    "дальше, так или иначе опиралось на него.",

    "Пять дат, которые стоит запомнить: 1799 — рождение, 1811 — лицей, 1830 — Болдинская осень, 1831 — женитьба, "
    "1837 — дуэль.",

    "Спасибо за внимание! Готов ответить на вопросы.",
]
for slide, text in zip(prs.slides, NOTES):
    tf = slide.notes_slide.notes_text_frame
    tf.text = text

out = ROOT / "Pushkin-prezentaciya.pptx"
prs.save(out)
print("saved", out, out.stat().st_size // 1024, "KB", "slides:", len(prs.slides.__iter__.__self__._sldIdLst))
