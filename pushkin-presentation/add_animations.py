#!/usr/bin/env python3
"""Добавляет в PPTX анимации: смена слайдов «плавное появление» + появление
элементов по очереди (Fade) и лёгкий подъём снизу."""
from pathlib import Path
from copy import deepcopy

from lxml import etree
from pptx import Presentation

ROOT = Path(__file__).resolve().parent
FILE = ROOT / "Pushkin-prezentaciya.pptx"
P = "http://schemas.openxmlformats.org/presentationml/2006/main"
A = "http://schemas.openxmlformats.org/drawingml/2006/main"
NS = {"p": P, "a": A}

# слайды, на которых элементы появляются по очереди (индексы с 0)
ANIMATED = {0: 220, 1: 200, 2: 220, 3: 220, 4: 220, 5: 220,
            6: 200, 7: 160, 8: 200, 9: 220, 10: 180}
# длительность появления одного элемента, мс
DUR = 700


def is_background(shape):
    return shape.name in ("bg",)


def is_furniture(shape):
    """Нижняя подпись, номер слайда, разделительная линия."""
    if shape.name.startswith("bg"):
        return True
    try:
        top_in = shape.top / 914400
    except TypeError:
        return False
    return top_in > 6.75


def anim_shape_ids(slide):
    ids = []
    for sh in slide.shapes:
        if not sh.has_text_frame and sh.shape_type != 13:  # 13 = PICTURE
            # тонкие линии-акценты тоже показываем
            if sh.height and sh.height < 914400 * 0.05:
                pass
        if is_background(sh) or is_furniture(sh):
            continue
        ids.append(sh.shape_id)
    return ids


def build_timing(spids, stagger=180, dur=DUR):
    """PowerPoint-совместимый блок <p:timing> с эффектами Fade."""
    nid = [2]

    def nxt():
        nid[0] += 1
        return nid[0]

    effects = []
    for i, spid in enumerate(spids):
        delay = i * stagger
        e_id, s_id, a_id, anim_id = nxt(), nxt(), nxt(), nxt()
        effects.append(f'''
      <p:par>
        <p:cTn id="{e_id}" presetID="10" presetClass="entr" presetSubtype="0" fill="hold"
               grpId="0" nodeType="afterEffect">
          <p:stCondLst><p:cond delay="{delay}"/></p:stCondLst>
          <p:childTnLst>
            <p:set>
              <p:cBhvr>
                <p:cTn id="{s_id}" dur="1" fill="hold">
                  <p:stCondLst><p:cond delay="0"/></p:stCondLst>
                </p:cTn>
                <p:tgtEl><p:spTgt spid="{spid}"/></p:tgtEl>
                <p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst>
              </p:cBhvr>
              <p:to><p:strVal val="visible"/></p:to>
            </p:set>
            <p:animEffect transition="in" filter="fade">
              <p:cBhvr>
                <p:cTn id="{a_id}" dur="{dur}"/>
                <p:tgtEl><p:spTgt spid="{spid}"/></p:tgtEl>
              </p:cBhvr>
            </p:animEffect>
            <p:anim calcmode="lin" valueType="num">
              <p:cBhvr additive="base">
                <p:cTn id="{anim_id}" dur="{dur}" fill="hold"/>
                <p:tgtEl><p:spTgt spid="{spid}"/></p:tgtEl>
                <p:attrNameLst><p:attrName>ppt_y</p:attrName></p:attrNameLst>
              </p:cBhvr>
              <p:from>#ppt_y+0.035</p:from>
              <p:to>#ppt_y</p:to>
            </p:anim>
          </p:childTnLst>
        </p:cTn>
      </p:par>''')

    main_seq_id = nxt()
    group_id = nxt()
    inner_id = nxt()

    xml = f'''<p:timing xmlns:p="{P}" xmlns:a="{A}">
  <p:tnLst>
    <p:par>
      <p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot">
        <p:childTnLst>
          <p:seq concurrent="1" nextAc="seek">
            <p:cTn id="{main_seq_id}" dur="indefinite" nodeType="mainSeq">
              <p:childTnLst>
                <p:par>
                  <p:cTn id="{group_id}" fill="hold">
                    <p:stCondLst><p:cond delay="indefinite"/></p:stCondLst>
                    <p:childTnLst>
                      <p:par>
                        <p:cTn id="{inner_id}" fill="hold">
                          <p:stCondLst><p:cond delay="0"/></p:stCondLst>
                          <p:childTnLst>{''.join(effects)}
                          </p:childTnLst>
                        </p:cTn>
                      </p:par>
                    </p:childTnLst>
                  </p:cTn>
                </p:par>
              </p:childTnLst>
            </p:cTn>
            <p:prevCondLst>
              <p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond>
            </p:prevCondLst>
            <p:nextCondLst>
              <p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond>
            </p:nextCondLst>
          </p:seq>
        </p:childTnLst>
      </p:cTn>
    </p:par>
  </p:tnLst>
</p:timing>'''
    return etree.fromstring(xml)


TRANSITION = etree.fromstring(
    f'<p:transition xmlns:p="{P}" spd="med"><p:fade/></p:transition>'
)


def add_transition(slide):
    sld = slide._element
    for old in sld.findall(f"{{{P}}}transition"):
        sld.remove(old)
    # p:transition идёт после p:clrMapOvr, до p:timing
    tr = deepcopy(TRANSITION)
    clr = sld.find(f"{{{P}}}clrMapOvr")
    if clr is not None:
        clr.addnext(tr)
    else:
        sld.insert(1, tr)


def add_timing(slide, spids):
    sld = slide._element
    for old in sld.findall(f"{{{P}}}timing"):
        sld.remove(old)
    sld.append(build_timing(spids))


def main():
    prs = Presentation(str(FILE))
    total = 0
    for i, slide in enumerate(prs.slides):
        add_transition(slide)
        if i in ANIMATED:
            ids = anim_shape_ids(slide)
            if ids:
                add_timing(slide, ids)
                total += len(ids)
    prs.save(str(FILE))
    print(f"анимаций: {total}, слайдов: {len(prs.slides.__iter__.__self__._sldIdLst)}")


if __name__ == "__main__":
    main()
