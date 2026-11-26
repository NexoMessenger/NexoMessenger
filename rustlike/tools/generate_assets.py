#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Генератор ресурсов RustLike (этап 1).

Создаёт:
  - текстуры 16×16 (PNG) для блоков 5 уровней, двери, плана и молотка;
  - модели блоков (blockstates + models);
  - модели предметов (item models);
  - лут-таблицы (блоки выпадают сами).

Запуск:  python3 tools/generate_assets.py
Повторный запуск перезаписывает сгенерированные файлы.
"""

import json
import os
import random
import struct
import zlib

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)                     # rustlike/
RES = os.path.join(ROOT, "src", "main", "resources")
ASSETS = os.path.join(RES, "assets", "rustlike")
DATA = os.path.join(RES, "data", "rustlike")

TIERS = 5


# --------------------------------------------------------------------------
# PNG
# --------------------------------------------------------------------------
def write_png(path, pixels):
    """pixels: список строк, каждая строка — список (r, g, b, a)."""
    height = len(pixels)
    width = len(pixels[0]) if height else 0

    def chunk(tag, data):
        out = struct.pack(">I", len(data)) + tag + data
        out += struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        return out

    raw = bytearray()
    for row in pixels:
        raw.append(0)  # фильтр: none
        for r, g, b, a in row:
            raw += struct.pack("4B", r, g, b, a)

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        + chunk(b"IEND", b"")
    )
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as fh:
        fh.write(png)
    print("  текстура:", os.path.relpath(path, ROOT))


# --------------------------------------------------------------------------
# Текстуры
# --------------------------------------------------------------------------
def clamp(v):
    return max(0, min(255, int(v)))


def tier_texture(tier, door=False):
    """16×16 текстура уровня. door=True — дополнительно ручка и шов."""
    styles = [
        # (base, dark, light, стиль)
        ((107, 74, 47), (80, 54, 32), (130, 95, 60), "twigs"),
        ((160, 118, 74), (126, 90, 54), (186, 142, 98), "wood"),
        ((127, 127, 127), (98, 98, 98), (152, 152, 152), "stone"),
        ((138, 143, 152), (106, 110, 118), (172, 178, 188), "metal"),
        ((109, 115, 125), (82, 87, 96), (142, 148, 160), "armored"),
    ]
    base, dark, light, style = styles[tier]
    rng = random.Random(1000 + tier * 77 + (7 if door else 0))
    px = [[(base[0], base[1], base[2], 255) for _ in range(16)] for _ in range(16)]

    def setp(x, y, color, alpha=255):
        if 0 <= x < 16 and 0 <= y < 16:
            px[y][x] = (color[0], color[1], color[2], alpha)

    if style == "twigs":
        # Переплетённые ветки: диагонали + случайные тёмные волокна
        for y in range(16):
            for x in range(16):
                if (x + y) % 7 == 0:
                    setp(x, y, dark)
                elif (x - y) % 9 == 0:
                    setp(x, y, light)
        for _ in range(26):
            setp(rng.randrange(16), rng.randrange(16), dark)
    elif style == "wood":
        # Доски: горизонтальные швы + зерно
        for y in range(16):
            for x in range(16):
                if y % 4 == 3:
                    setp(x, y, dark)
                elif rng.random() < 0.18:
                    setp(x, y, light if rng.random() < 0.5 else dark)
    elif style == "stone":
        for y in range(16):
            for x in range(16):
                n = rng.randint(-18, 18)
                setp(x, y, (clamp(base[0] + n), clamp(base[1] + n), clamp(base[2] + n)))
        for _ in range(10):
            setp(rng.randrange(16), rng.randrange(16), dark)
    elif style == "metal":
        # Металлические плиты: швы по горизонтали + заклёпки
        for y in range(16):
            for x in range(16):
                if y in (0, 8):
                    setp(x, y, dark)
                elif rng.random() < 0.08:
                    setp(x, y, light)
        for rx, ry in ((2, 2), (13, 2), (2, 10), (13, 10)):
            setp(rx, ry, light)
            setp(rx + 1, ry, light)
    else:  # armored
        for y in range(16):
            for x in range(16):
                if y in (0, 8) or x in (0, 8):
                    setp(x, y, dark)
                elif (x + y) % 15 == 0 or (x - y) % 15 == 0:
                    setp(x, y, light)
                elif rng.random() < 0.06:
                    setp(x, y, light)
        for rx, ry in ((2, 2), (13, 2), (2, 13), (13, 13)):
            setp(rx, ry, light)

    if door:
        # Вертикальный шов по центру и ручка
        for y in range(16):
            setp(7, y, dark)
            setp(8, y, (clamp(dark[0] + 10), clamp(dark[1] + 10), clamp(dark[2] + 10)))
        for hx in (11, 12):
            for hy in (7, 8):
                setp(hx, hy, light)

    return px


def plan_texture():
    px = [[(236, 228, 200, 255) for _ in range(16)] for _ in range(16)]
    for y in range(16):
        for x in range(16):
            if x in (0, 15) or y in (0, 15):
                px[y][x] = (140, 130, 100, 255)
            elif x % 4 == 0 or y % 4 == 0:
                px[y][x] = (202, 192, 162, 255)
            if x == y or x == 15 - y:
                px[y][x] = (186, 74, 66, 255)
    return px


def hammer_texture():
    px = [[(0, 0, 0, 0) for _ in range(16)] for _ in range(16)]
    handle = (122, 86, 50, 255)
    head = (148, 152, 160, 255)
    head_dark = (104, 108, 116, 255)
    # Рукоять по диагонали
    for i in range(9):
        x, y = 3 + i, 12 - i
        if 0 <= x < 16 and 0 <= y < 16:
            px[y][x] = handle
            if y + 1 < 16:
                px[y + 1][x] = handle
    # Голова молотка
    for y in range(2, 7):
        for x in range(9, 15):
            px[y][x] = head if y > 2 else head_dark
    for x in range(9, 15):
        px[6][x] = head_dark
    return px


def gen_textures():
    print("Генерация текстур…")
    for t in range(TIERS):
        write_png(os.path.join(ASSETS, "textures", "block", "foundation_%d.png" % t),
                  tier_texture(t))
        write_png(os.path.join(ASSETS, "textures", "block", "wall_%d.png" % t),
                  tier_texture(t))
        write_png(os.path.join(ASSETS, "textures", "block", "door_%d.png" % t),
                  tier_texture(t, door=True))
    write_png(os.path.join(ASSETS, "textures", "item", "building_plan.png"), plan_texture())
    write_png(os.path.join(ASSETS, "textures", "item", "hammer.png"), hammer_texture())


# --------------------------------------------------------------------------
# JSON: модели
# --------------------------------------------------------------------------
def save_json(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(obj, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    print("  json:", os.path.relpath(path, ROOT))


ALL_FACES = ["up", "down", "north", "south", "east", "west"]


def element(frm, to, texture_key):
    return {
        "from": list(frm),
        "to": list(to),
        "faces": {f: {"texture": "#" + texture_key} for f in ALL_FACES},
    }


def frame_elements():
    return [
        element((0, 0, 0), (3, 16, 16), "frame"),    # левый столб
        element((13, 0, 0), (16, 16, 16), "frame"),  # правый столб
        element((0, 13, 0), (16, 16, 16), "frame"),  # перемычка
    ]


def gen_models():
    print("Генерация моделей…")
    models = os.path.join(ASSETS, "models")

    for t in range(TIERS):
        # Фундамент: плита 3/16
        save_json(os.path.join(models, "block", "foundation_t%d.json" % t), {
            "textures": {"0": "rustlike:block/foundation_%d" % t},
            "elements": [element((0, 0, 0), (16, 3, 16), "0")],
        })

        # Стена: полный куб
        save_json(os.path.join(models, "block", "wall_t%d.json" % t), {
            "parent": "minecraft:block/cube_all",
            "textures": {"all": "rustlike:block/wall_%d" % t},
        })

        # Дверной проём: только рама
        save_json(os.path.join(models, "block", "doorway_t%d.json" % t), {
            "textures": {"frame": "rustlike:block/wall_%d" % t},
            "elements": frame_elements(),
        })

        # Проём с закрытой дверью
        save_json(os.path.join(models, "block", "doorway_t%d_closed.json" % t), {
            "textures": {
                "frame": "rustlike:block/wall_%d" % t,
                "door": "rustlike:block/door_%d" % t,
            },
            "elements": frame_elements() + [element((3, 0, 7), (13, 13, 9), "door")],
        })

        # Проём с открытой дверью (панель сложена к левому столбу)
        save_json(os.path.join(models, "block", "doorway_t%d_open.json" % t), {
            "textures": {
                "frame": "rustlike:block/wall_%d" % t,
                "door": "rustlike:block/door_%d" % t,
            },
            "elements": frame_elements() + [element((3, 0, 2), (5, 13, 14), "door")],
        })

    # Модели предметов-блоков (иконки по умолчанию — уровень 0)
    save_json(os.path.join(models, "item", "foundation.json"),
              {"parent": "rustlike:block/foundation_t0"})

    save_json(os.path.join(models, "item", "wall.json"),
              {"parent": "rustlike:block/wall_t0"})
    save_json(os.path.join(models, "item", "doorway.json"),
              {"parent": "rustlike:block/doorway_t0"})

    # Модели инструментов
    save_json(os.path.join(models, "item", "building_plan.json"), {
        "parent": "minecraft:item/generated",
        "textures": {"layer0": "rustlike:item/building_plan"},
    })
    save_json(os.path.join(models, "item", "hammer.json"), {
        "parent": "minecraft:item/generated",
        "textures": {"layer0": "rustlike:item/hammer"},
    })


# --------------------------------------------------------------------------
# JSON: blockstates
# --------------------------------------------------------------------------
FACING_ROT = {"south": 0, "west": 90, "north": 180, "east": 270}


def gen_blockstates():
    print("Генерация blockstates…")
    bs = os.path.join(ASSETS, "blockstates")

    # Фундамент / стена: только tier
    for name in ("foundation", "wall"):
        variants = {}
        for t in range(TIERS):
            variants["tier=%d" % t] = {"model": "rustlike:block/%s_t%d" % (name, t)}
        save_json(os.path.join(bs, "%s.json" % name), {"variants": variants})

    # Дверной проём: tier, has_door, open, facing (порядок = порядку объявления свойств)
    variants = {}
    for t in range(TIERS):
        for has_door in ("false", "true"):
            for open_state in ("false", "true"):
                for facing, rot in FACING_ROT.items():
                    if has_door == "false":
                        model = "rustlike:block/doorway_t%d" % t
                    elif open_state == "false":
                        model = "rustlike:block/doorway_t%d_closed" % t
                    else:
                        model = "rustlike:block/doorway_t%d_open" % t
                    key = "tier=%d,has_door=%s,open=%s,facing=%s" % (
                        t, has_door, open_state, facing)
                    variants[key] = {"model": model, "y": rot}
    save_json(os.path.join(bs, "doorway.json"), {"variants": variants})


# --------------------------------------------------------------------------
# Лут-таблицы
# --------------------------------------------------------------------------
def gen_loot_tables():
    print("Генерация лут-таблиц…")
    for name in ("foundation", "wall", "doorway"):
        table = {
            "type": "minecraft:block",
            "pools": [{
                "rolls": 1,
                "entries": [{
                    "type": "minecraft:item",
                    "name": "rustlike:%s" % name,
                }],
                "conditions": [{"condition": "minecraft:survives_explosion"}],
            }],
        }
        save_json(os.path.join(DATA, "loot_tables", "blocks", "%s.json" % name), table)


def main():
    gen_textures()
    gen_models()
    gen_blockstates()
    gen_loot_tables()
    print("\nГотово.")


if __name__ == "__main__":
    main()
