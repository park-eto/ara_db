"""Minimal, dependency-free XLSX reader.

openpyxl fails on these workbooks (Google Sheets export with non-standard
conditional formatting), so we read the OOXML parts directly.

Provides:
  - cell values per sheet (shared strings resolved)
  - pictures per sheet with the (1-based) row/col their centre falls into
"""
from __future__ import annotations

import posixpath
import re
import zipfile
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field

NS = {
    'm': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    'pr': 'http://schemas.openxmlformats.org/package/2006/relationships',
    'xdr': 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing',
    'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
}
R_ID = '{%s}id' % NS['r']
R_EMBED = '{%s}embed' % NS['r']

EMU_PER_PT = 12700
# Excel column width unit -> EMU (approx. 7px per char @ 96dpi, 9525 EMU per px)
EMU_PER_COL_UNIT = 7 * 9525

_CELL_RE = re.compile(r'([A-Z]+)(\d+)')


def col_to_idx(col: str) -> int:
    n = 0
    for ch in col:
        n = n * 26 + (ord(ch) - 64)
    return n


def idx_to_col(idx: int) -> str:
    s = ''
    while idx:
        idx, rem = divmod(idx - 1, 26)
        s = chr(65 + rem) + s
    return s


@dataclass
class Picture:
    row: int          # 1-based start row from anchor
    col: int          # 1-based start col from anchor
    media_path: str   # path inside the zip, e.g. xl/media/image1.png
    area: int = 0     # EMU^2, used to pick the main picture when several overlap
    to_row: int = 0   # 1-based end row
    to_col: int = 0   # 1-based end col
    idx: int = 0      # order index in drawing


@dataclass
class Sheet:
    name: str
    cells: dict[tuple[int, int], str] = field(default_factory=dict)
    pictures: list[Picture] = field(default_factory=list)
    max_row: int = 0

    def get(self, row: int, col: int | str) -> str:
        if isinstance(col, str):
            col = col_to_idx(col)
        return self.cells.get((row, col), '')

    def row_values(self, row: int) -> dict[int, str]:
        return {c: v for (r, c), v in self.cells.items() if r == row}


class Workbook:
    def __init__(self, path: str):
        self.path = path
        self.zip = zipfile.ZipFile(path)
        self.shared = self._read_shared_strings()
        self.sheets: list[Sheet] = []
        self._read_sheets()

    # ------------------------------------------------------------------ utils
    def _xml(self, name: str) -> ET.Element:
        return ET.fromstring(self.zip.read(name))

    def _rels(self, part: str) -> dict[str, str]:
        """Return {rId: absolute target path} for a part."""
        folder, fname = posixpath.split(part)
        rel_path = posixpath.join(folder, '_rels', fname + '.rels')
        if rel_path not in self.zip.namelist():
            return {}
        out = {}
        for rel in self._xml(rel_path).findall('pr:Relationship', NS):
            target = rel.get('Target')
            if target.startswith('/'):
                target = target.lstrip('/')
            else:
                target = posixpath.normpath(posixpath.join(folder, target))
            out[rel.get('Id')] = target
        return out

    def _read_shared_strings(self) -> list[str]:
        if 'xl/sharedStrings.xml' not in self.zip.namelist():
            return []
        root = self._xml('xl/sharedStrings.xml')
        out = []
        for si in root.findall('m:si', NS):
            out.append(''.join(t.text or '' for t in si.iter('{%s}t' % NS['m'])))
        return out

    # ----------------------------------------------------------------- sheets
    def _read_sheets(self) -> None:
        wb = self._xml('xl/workbook.xml')
        rels = self._rels('xl/workbook.xml')
        for sh in wb.find('m:sheets', NS):
            part = rels[sh.get(R_ID)]
            self.sheets.append(self._read_sheet(sh.get('name'), part))

    def sheet(self, name: str) -> Sheet:
        for s in self.sheets:
            if s.name.strip() == name:
                return s
        raise KeyError(name)

    def _read_sheet(self, name: str, part: str) -> Sheet:
        root = self._xml(part)
        sheet = Sheet(name=name)

        fmt = root.find('m:sheetFormatPr', NS)
        default_ht = float(fmt.get('defaultRowHeight', 15)) if fmt is not None else 15.0
        default_w = float(fmt.get('defaultColWidth', 8.43)) if fmt is not None and fmt.get('defaultColWidth') else 8.43

        heights: dict[int, float] = {}
        for row in root.find('m:sheetData', NS):
            r = int(row.get('r'))
            sheet.max_row = max(sheet.max_row, r)
            if row.get('hidden') == '1':
                heights[r] = 0.0
            elif row.get('ht'):
                heights[r] = float(row.get('ht'))
            for c in row.findall('m:c', NS):
                val = self._cell_value(c)
                if val is None or val == '':
                    continue
                m = _CELL_RE.match(c.get('r'))
                sheet.cells[(int(m.group(2)), col_to_idx(m.group(1)))] = val

        widths: dict[int, float] = {}
        cols = root.find('m:cols', NS)
        if cols is not None:
            for col in cols.findall('m:col', NS):
                w = 0.0 if col.get('hidden') == '1' else float(col.get('width', default_w))
                for i in range(int(col.get('min')), int(col.get('max')) + 1):
                    widths[i] = w

        drawing = root.find('m:drawing', NS)
        if drawing is not None:
            rels = self._rels(part)
            dpart = rels.get(drawing.get(R_ID))
            if dpart:
                sheet.pictures = self._read_drawing(dpart, heights, default_ht, widths, default_w)
        return sheet

    def _cell_value(self, c: ET.Element) -> str | None:
        t = c.get('t')
        if t == 'inlineStr':
            is_ = c.find('m:is', NS)
            return ''.join(x.text or '' for x in is_.iter('{%s}t' % NS['m'])) if is_ is not None else None
        v = c.find('m:v', NS)
        if v is None or v.text is None:
            return None
        if t == 's':
            return self.shared[int(v.text)]
        return v.text

    # --------------------------------------------------------------- drawings
    def _read_drawing(self, part, heights, default_ht, widths, default_w) -> list[Picture]:
        rels = self._rels(part)
        root = self._xml(part)

        pics: list[Picture] = []
        curr_idx = 0

        # Read both twoCellAnchor and oneCellAnchor in order
        for a in root:
            tag_name = a.tag.split('}')[-1]
            if tag_name not in ('twoCellAnchor', 'oneCellAnchor'):
                continue

            pic = a.find('xdr:pic', NS)
            if pic is None:
                continue
            blip = pic.find('.//a:blip', NS)
            emb = blip.get(R_EMBED) if blip is not None else None
            if not emb or emb not in rels:
                continue

            from_el = a.find('xdr:from', NS)
            to_el = a.find('xdr:to', NS)

            from_row = int(from_el.find('xdr:row', NS).text) + 1 if from_el is not None and from_el.find('xdr:row', NS) is not None else 1
            from_col = int(from_el.find('xdr:col', NS).text) + 1 if from_el is not None and from_el.find('xdr:col', NS) is not None else 1

            to_row = int(to_el.find('xdr:row', NS).text) + 1 if to_el is not None and to_el.find('xdr:row', NS) is not None else from_row
            to_col = int(to_el.find('xdr:col', NS).text) + 1 if to_el is not None and to_el.find('xdr:col', NS) is not None else from_col

            ext = pic.find('xdr:spPr/a:xfrm/a:ext', NS)
            area = 0
            if ext is not None:
                cx, cy = int(ext.get('cx', '0')), int(ext.get('cy', '0'))
                area = cx * cy

            target_path = rels[emb]
            if not target_path.startswith('xl/'):
                target_path = 'xl/' + target_path

            curr_idx += 1
            pics.append(Picture(
                row=from_row,
                col=from_col,
                media_path=target_path,
                area=area,
                to_row=to_row,
                to_col=to_col,
                idx=curr_idx
            ))

        return pics

    def read_bytes(self, path: str) -> bytes:
        return self.zip.read(path)
