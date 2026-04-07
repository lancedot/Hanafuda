import json
import re
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
XLSX_PATH = ROOT / "策划案 1.0.xlsx"
OUT_DIR = ROOT / "src" / "content" / "generated"
OUT_DIR.mkdir(parents=True, exist_ok=True)

NS = {
    "m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "p": "http://schemas.openxmlformats.org/package/2006/relationships",
}

RANK_MAP = {
    "光": "HIKARI",
    "短": "TAN",
    "皮": "KASU",
    "种": "TANE",
}

RARITY_MAP = {
    "普通": "COMMON",
    "优秀": "UNCOMMON",
    "稀有": "RARE",
    "传说": "LEGENDARY",
}


def col_to_num(col: str) -> int:
    n = 0
    for ch in col:
        n = n * 26 + (ord(ch) - 64)
    return n


def parse_ref(ref: str):
    m = re.match(r"([A-Z]+)(\d+)", ref)
    if not m:
        return None, None
    return int(m.group(2)), col_to_num(m.group(1))


def cell_text(cell, shared_strings):
    ctype = cell.attrib.get("t")
    if ctype == "s":
        v = cell.find("m:v", NS)
        if v is None or v.text is None:
            return ""
        idx = int(v.text)
        return shared_strings[idx] if 0 <= idx < len(shared_strings) else ""
    if ctype == "inlineStr":
        t = cell.find("m:is/m:t", NS)
        return "" if t is None or t.text is None else t.text
    v = cell.find("m:v", NS)
    return "" if v is None or v.text is None else v.text


def parse_workbook(path: Path):
    with zipfile.ZipFile(path, "r") as z:
        shared_strings = []
        if "xl/sharedStrings.xml" in z.namelist():
            root = ET.fromstring(z.read("xl/sharedStrings.xml"))
            for si in root.findall("m:si", NS):
                parts = []
                t = si.find("m:t", NS)
                if t is not None and t.text is not None:
                    parts.append(t.text)
                for r in si.findall("m:r", NS):
                    tt = r.find("m:t", NS)
                    if tt is not None and tt.text is not None:
                        parts.append(tt.text)
                shared_strings.append("".join(parts))

        wb_root = ET.fromstring(z.read("xl/workbook.xml"))
        rel_root = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
        rel_map = {
            rel.attrib.get("Id"): rel.attrib.get("Target")
            for rel in rel_root.findall("p:Relationship", NS)
        }

        sheets = {}
        for s in wb_root.findall("m:sheets/m:sheet", NS):
            name = s.attrib.get("name")
            rid = s.attrib.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id")
            target = rel_map.get(rid, "")
            sheet_path = target.lstrip("/") if target.startswith("/") else ("xl/" + target if not target.startswith("xl/") else target)
            root = ET.fromstring(z.read(sheet_path))
            grid = {}
            for c in root.findall(".//m:sheetData/m:row/m:c", NS):
                ref = c.attrib.get("r", "")
                row, col = parse_ref(ref)
                if row is None:
                    continue
                grid[(row, col)] = cell_text(c, shared_strings).strip()
            sheets[name] = grid
        return sheets


def rows_from_sheet(grid, max_col=10):
    max_row = 0
    for r, _ in grid.keys():
        max_row = max(max_row, r)
    rows = []
    for r in range(1, max_row + 1):
        row = [grid.get((r, c), "") for c in range(1, max_col + 1)]
        rows.append(row)
    return rows


def month_num(text: str) -> int:
    m = re.search(r"(\d+)", text)
    return int(m.group(1)) if m else 0


def normalize_rank(text: str) -> str:
    for k, v in RANK_MAP.items():
        if text.startswith(k):
            return v
    return "KASU"


def tags_for_card(month: int, rank: str, name: str, note: str):
    tags = []
    if "赤短" in name or "赤短" in note:
        tags.append("RED_RIBBON")
    if "青短" in name or "青短" in note:
        tags.append("BLUE_RIBBON")
    if month == 6 and rank == "TANE":
        tags.append("BOAR")
    if month == 7 and rank == "TANE":
        tags.append("DEER")
    if month == 10 and rank == "TANE":
        tags.append("BUTTERFLY")
    if month == 9 and rank == "TANE":
        tags.append("SAKE_CUP")
    if month == 3 and rank == "HIKARI":
        tags.append("FLOWER_VIEWING_LIGHT")
    return tags


def export_cards(sheets):
    rows = rows_from_sheet(sheets["卡牌"], max_col=8)
    out = []
    for row in rows[1:]:
        if not row[0]:
            continue
        month = month_num(row[1])
        rank = normalize_rank(row[2])
        name = row[3]
        note = row[6]
        out.append(
            {
                "id": str(row[0]),
                "month": month,
                "rank": rank,
                "name": name,
                "baseChips": int(float(row[4] or 0)),
                "baseMult": int(float(row[5] or 0)),
                "note": note,
                "lore": row[7],
                "tags": tags_for_card(month, rank, name, note),
            }
        )
    return out


def export_combos(sheets):
    rows = rows_from_sheet(sheets["牌型"], max_col=4)
    out = []
    for idx, row in enumerate(rows[1:], start=1):
        if not row[0]:
            continue
        out.append(
            {
                "id": f"combo-{idx:02d}",
                "name": row[0],
                "conditionText": row[1],
                "baseMultText": row[2],
                "levelUpText": row[3],
            }
        )
    return out


def export_relics(sheets):
    rows = rows_from_sheet(sheets["法宝"], max_col=6)
    out = []
    for row in rows[1:]:
        if not row[0]:
            continue
        out.append(
            {
                "id": row[0],
                "name": row[1],
                "rarity": RARITY_MAP.get(row[2], "COMMON"),
                "price": int(float(row[3] or 0)),
                "effectScript": row[4],
                "buildHint": row[5],
            }
        )
    return out


def export_charms(sheets):
    rows = rows_from_sheet(sheets["符咒"], max_col=5)
    out = []
    for row in rows[1:]:
        if not row[0]:
            continue
        out.append(
            {
                "id": row[0],
                "name": row[1],
                "type": row[2],
                "effectScript": row[3],
                "designIntent": row[4],
                "price": 4,
                "permanence": "PERMANENT" if any(k in row[3] for k in ["永久", "贴上"]) else "TEMPORARY",
            }
        )
    return out


def export_stages(sheets):
    rows = rows_from_sheet(sheets["关卡进度"], max_col=5)
    out = []
    stage_num = 1
    season = "SPRING"
    season_map = {
        "第一章": "SPRING",
        "第二章": "SUMMER",
        "第三章": "AUTUMN",
        "第四章": "WINTER",
        "终章": "ECLIPSE",
    }
    for row in rows[1:]:
        if not row[0]:
            continue
        chapter = row[0]
        for key, val in season_map.items():
            if chapter.startswith(key):
                season = val
                break
        out.append(
            {
                "id": f"stage-{stage_num:02d}",
                "chapter": chapter,
                "monthSet": row[1],
                "targetScoreText": row[2],
                "boss": row[3],
                "bossRuleText": row[4],
                "season": season,
                "shopConfig": {"cards": 3, "relics": 2, "charms": 2},
            }
        )
        stage_num += 1
    return out


def export_rules():
    return {
        "maxHandSize": 8,
        "maxPlayCards": 5,
        "basePlays": 4,
        "baseDiscards": 3,
        "koiKoi": {
            "onSuccess": {"bonusType": "PERMANENT_GROWTH"},
            "onFail": {"goldMultiplier": 0.5},
        },
        "scoringFormula": "(sumCardChips + charmsChips + comboChips) * (comboMult + charmMult) * productMultipliers",
        "interest": {"step": 5, "bonus": 1, "cap": 20},
    }


def export_flow_text(sheets):
    rows = rows_from_sheet(sheets["流程"], max_col=3)
    lines = []
    for row in rows:
        if any(row):
            lines.append(" | ".join(x for x in row if x))
    return lines


def main():
    sheets = parse_workbook(XLSX_PATH)

    outputs = {
        "cards.json": export_cards(sheets),
        "combos.json": export_combos(sheets),
        "relics.json": export_relics(sheets),
        "charms.json": export_charms(sheets),
        "stages.json": export_stages(sheets),
        "rules.json": export_rules(),
        "flow.json": export_flow_text(sheets),
    }

    for name, data in outputs.items():
        (OUT_DIR / name).write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    print("Exported content files:")
    for name in outputs.keys():
        print(f"- {name}")


if __name__ == "__main__":
    main()
