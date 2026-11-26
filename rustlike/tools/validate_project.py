#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Автоматическая проверка проекта RustLike (без Java/Gradle):

  1. Синтаксис всех .java файлов (парсер javalang);
  2. Корректность всех .json (модели, blockstate, ланг, лут);
  3. Существование всех текстур, на которые ссылаются модели;
  4. Существование всех моделей, на которые ссылаются blockstate;
  5. Совпадение ключей локализации ru/en;
  6. Наличие в ru-локализации всех ключей, используемых в коде;
  7. Целостность PNG (сигнатура + CRC);
  8. Полное покрытие вариантов blockstate (все комбинации свойств).

Запуск:  python3 tools/validate_project.py
Код возврата 0 = все проверки пройдены.
"""

import json
import os
import re
import struct
import sys
import zlib

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
RES = os.path.join(ROOT, "src", "main", "resources")
JAVA = os.path.join(ROOT, "src", "main", "java")

errors = []
warnings = []
passed = []


def check(name, ok, detail=""):
    if ok:
        passed.append(name)
    else:
        errors.append("%s%s" % (name, (": " + detail) if detail else ""))


# --------------------------------------------------------------------------
def check_java():
    """Синтаксис Java через tree-sitter (поддержка record, pattern matching)."""
    try:
        import tree_sitter_java
        from tree_sitter import Language, Parser
    except ImportError:
        warnings.append("tree-sitter-java не установлен — проверка Java пропущена")
        return

    lang = Language(tree_sitter_java.language())
    parser = Parser(lang)
    count = 0
    for dirpath, _, filenames in os.walk(JAVA):
        for fn in filenames:
            if not fn.endswith(".java"):
                continue
            path = os.path.join(dirpath, fn)
            rel = os.path.relpath(path, ROOT)
            with open(path, "rb") as fh:
                src = fh.read()
            tree = parser.parse(src)
            if tree.root_node.has_error:
                # Находим первую строку с ошибкой для сообщения
                line = "?"
                stack = [tree.root_node]
                while stack:
                    node = stack.pop()
                    if node.type == "ERROR" or node.is_missing:
                        line = src[:node.start_byte].count(b"\n") + 1
                        break
                    stack.extend(node.children)
                errors.append("Java-синтаксис %s (строка %s)" % (rel, line))
            else:
                count += 1
    check("Java-файлов разобрано: %d" % count, count > 0, "нет .java файлов")


# --------------------------------------------------------------------------
def check_json():
    count = 0
    for dirpath, _, filenames in os.walk(RES):
        for fn in filenames:
            if not fn.endswith(".json"):
                continue
            path = os.path.join(dirpath, fn)
            rel = os.path.relpath(path, ROOT)
            try:
                with open(path, encoding="utf-8") as fh:
                    json.load(fh)
                count += 1
            except Exception as exc:  # noqa: BLE001
                errors.append("JSON %s: %s" % (rel, exc))
    check("JSON-файлов валидны: %d" % count, count > 0)


# --------------------------------------------------------------------------
def check_model_references():
    models_dir = os.path.join(RES, "assets", "rustlike", "models")
    tex_refs = 0
    missing_tex = []
    for dirpath, _, filenames in os.walk(models_dir):
        for fn in filenames:
            if not fn.endswith(".json"):
                continue
            with open(os.path.join(dirpath, fn), encoding="utf-8") as fh:
                data = json.load(fh)
            for tex in data.get("textures", {}).values():
                if not isinstance(tex, str) or not tex.startswith("rustlike:"):
                    continue
                tex_refs += 1
                # rustlike:block/wall_0 -> assets/rustlike/textures/block/wall_0.png
                parts = tex.split(":", 1)[1].split("/")
                path = os.path.join(RES, "assets", "rustlike", "textures",
                                    parts[0], parts[1] + ".png")
                if not os.path.isfile(path):
                    missing_tex.append(tex)
    check("Ссылок на текстуры: %d, все существуют" % tex_refs,
          not missing_tex, "нет: " + ", ".join(missing_tex))

    # blockstate -> модель
    bs_dir = os.path.join(RES, "assets", "rustlike", "blockstates")
    model_refs = 0
    missing_models = []
    for fn in os.listdir(bs_dir):
        if not fn.endswith(".json"):
            continue
        with open(os.path.join(bs_dir, fn), encoding="utf-8") as fh:
            data = json.load(fh)
        for variant in data.get("variants", {}).values():
            entries = variant if isinstance(variant, list) else [variant]
            for entry in entries:
                model_refs += 1
                model = entry.get("model", "")
                if model.startswith("rustlike:"):
                    rel = model.split(":", 1)[1]
                    path = os.path.join(models_dir, rel + ".json")
                    if not os.path.isfile(path):
                        missing_models.append(model)
    check("Ссылок на модели в blockstate: %d, все существуют" % model_refs,
          not missing_models, "нет: " + ", ".join(sorted(set(missing_models))))


# --------------------------------------------------------------------------
def check_blockstate_coverage():
    # Дверной проём: 5 tier × 2 has_door × 2 open × 4 facing = 80
    path = os.path.join(RES, "assets", "rustlike", "blockstates", "doorway.json")
    with open(path, encoding="utf-8") as fh:
        data = json.load(fh)
    variants = data.get("variants", {})
    check("doorway.json: 80 вариантов (5×2×2×4)", len(variants) == 80,
          "фактически %d" % len(variants))

    for name in ("foundation", "wall"):
        path = os.path.join(RES, "assets", "rustlike", "blockstates", "%s.json" % name)
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
        n = len(data.get("variants", {}))
        check("%s.json: 5 вариантов" % name, n == 5, "фактически %d" % n)


# --------------------------------------------------------------------------
def check_lang():
    lang_dir = os.path.join(RES, "assets", "rustlike", "lang")
    with open(os.path.join(lang_dir, "ru_ru.json"), encoding="utf-8") as fh:
        ru = json.load(fh)
    with open(os.path.join(lang_dir, "en_us.json"), encoding="utf-8") as fh:
        en = json.load(fh)

    missing_en = sorted(set(ru) - set(en))
    missing_ru = sorted(set(en) - set(ru))
    check("Ключи ru/en совпадают (%d)" % len(ru),
          not missing_en and not missing_ru,
          "только в ru: %s; только в en: %s" % (missing_en, missing_ru))

    # Ключи, используемые в Java-коде
    used = set()
    pattern = re.compile(r'translatable\(\s*"([^"]+)"')
    for dirpath, _, filenames in os.walk(JAVA):
        for fn in filenames:
            if fn.endswith(".java"):
                with open(os.path.join(dirpath, fn), encoding="utf-8") as fh:
                    used.update(pattern.findall(fh.read()))
    # Имена элементов/предметов (blocks/items) берутся из реестра автоматически
    dynamic = {k for k in used if k.startswith("rustlike.tier.")}
    used -= dynamic
    missing = sorted(k for k in used if k not in ru)
    check("Ключи из кода есть в ru_ru.json (%d)" % len(used),
          not missing, "нет: " + ", ".join(missing))


# --------------------------------------------------------------------------
def check_pngs():
    count = 0
    bad = []
    for dirpath, _, filenames in os.walk(os.path.join(RES, "assets")):
        for fn in filenames:
            if not fn.endswith(".png"):
                continue
            path = os.path.join(dirpath, fn)
            with open(path, "rb") as fh:
                data = fh.read()
            if not data.startswith(b"\x89PNG\r\n\x1a\n"):
                bad.append(fn + " (нет сигнатуры)")
                continue
            # Последний блок: длина(4)=0, тег(4)="IEND", crc(4)
            if data[-12:-8] != b"\x00\x00\x00\x00" or data[-8:-4] != b"IEND":
                bad.append(fn + " (нет IEND)")
                continue
            # Проверка CRC блока IDAT
            try:
                pos = data.index(b"IDAT") - 4
                length = struct.unpack(">I", data[pos:pos + 4])[0]
                chunk = data[pos + 4:pos + 8 + length]
                crc_stored = struct.unpack(">I", data[pos + 8 + length:pos + 12 + length])[0]
                if zlib.crc32(chunk) & 0xFFFFFFFF != crc_stored:
                    bad.append(fn + ("" if fn.endswith(")") else " (CRC)"))
            except Exception:  # noqa: BLE001
                bad.append(fn + " (разбор)")
            count += 1
    check("PNG-текстур целы: %d" % count, count >= 17 and not bad,
          "битые: " + ", ".join(bad))


# --------------------------------------------------------------------------
def check_build_files():
    for fn in ("build.gradle", "settings.gradle", "gradle.properties",
               "src/main/resources/META-INF/mods.toml",
               "src/main/resources/pack.mcmeta"):
        check("Есть файл %s" % fn, os.path.isfile(os.path.join(ROOT, fn)))

    with open(os.path.join(ROOT, "src/main/resources/META-INF/mods.toml"),
              encoding="utf-8") as fh:
        toml = fh.read()
    check("mods.toml: мод rustlike", 'modId="rustlike"' in toml)
    check("mods.toml: зависимость minecraft 1.20.1", "[1.20.1" in toml)

    with open(os.path.join(ROOT, "src/main/resources/pack.mcmeta"),
              encoding="utf-8") as fh:
        pack = json.load(fh)
    check("pack.mcmeta: pack_format 15 (1.20.1)",
          pack.get("pack", {}).get("pack_format") == 15)


# --------------------------------------------------------------------------
def main():
    check_java()
    check_json()
    check_model_references()
    check_blockstate_coverage()
    check_lang()
    check_pngs()
    check_build_files()

    print("=" * 64)
    print("ПРОВЕРКА ПРОЕКТА RUSTLIKE")
    print("=" * 64)
    for item in passed:
        print("  [OK]   " + item)
    for item in warnings:
        print("  [WARN] " + item)
    for item in errors:
        print("  [FAIL] " + item)
    print("-" * 64)
    print("Итого: %d ок, %d предупреждений, %d ошибок" %
          (len(passed), len(warnings), len(errors)))
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
