from concurrent.futures import ThreadPoolExecutor
from html import escape, unescape
from urllib.parse import urljoin, urlsplit
from io import BytesIO
from pathlib import Path
from urllib.request import Request, urlopen
from zipfile import ZipFile
import re
import sys

publish = Path(sys.argv[1])
year = int(sys.argv[2]) if len(sys.argv) > 2 else 2026
if year not in range(2022, 2027):
    raise ValueError("Unsupported CBSE exam year")
page_name = "papers.html" if year == 2026 else f"papers-{year}.html"
folder_name = "papers" if year == 2026 else f"papers-{year}"
question_zip = "CHEMISTRY.zip" if year in (2023, 2024, 2025) else "Chemistry.zip"
pdf_dir = publish / folder_name
pdf_dir.mkdir(exist_ok=True)
base = "https://www.cbse.gov.in/cbsenew/"
archives = {
    "question-paper": base + f"question-paper/{year}/XII/{question_zip}",
    "marking-scheme": base + f"marking-scheme/{year}/XII/Chemistry.zip",
}
limit = 50 * 1024 * 1024


def paper_code(name):
    stem = Path(name).stem
    code = re.search(r"(?<!\d)56[\s_-]+(\d+)[\s_-]+(\d+)(?!\d)", stem)
    if code:
        return f"56-{int(code[1])}-{int(code[2])}"
    if re.search(r"56\s*[\s_(-]+B\b|visually[\s_-]+impaired", stem, re.I):
        return "56-B"
    return None


def extract(kind):
    try:
        request = Request(archives[kind], headers={"User-Agent": "Chemistry Achievers Academy paper archive"})
        with urlopen(request, timeout=15) as response:
            data = response.read(limit + 1)
        if len(data) > limit:
            raise ValueError("Archive exceeds size limit")
        with ZipFile(BytesIO(data)) as archive:
            matches = {}
            for member in archive.infolist():
                if Path(member.filename).suffix.lower() != ".pdf" or member.file_size > limit:
                    continue
                code = paper_code(member.filename)
                if code:
                    matches.setdefault(code, []).append(member)
            files = {}
            for code, candidates in matches.items():
                english = [member for member in candidates if "english" in member.filename.lower()]
                candidates = english or candidates
                if len(candidates) != 1:
                    continue
                data = archive.read(candidates[0])
                if data.startswith(b"%PDF-"):
                    filename = f"{code}-{kind}.pdf"
                    (pdf_dir / filename).write_bytes(data)
                    files[code] = filename
            return files
    except (OSError, ValueError, RuntimeError) as error:
        print(f"CBSE {kind} archive unavailable: {error}")
        return {}
    except Exception as error:
        print(f"Could not extract CBSE {kind} PDFs: {error}")
        return {}


marking_index = base + "marking-scheme.html"


def find_2022_marking_archive():
    try:
        with urlopen(marking_index, timeout=10) as response:
            page = response.read(2 * 1024 * 1024).decode("utf-8", errors="replace")
        for row in re.findall(r"<tr\b[^>]*>.*?</tr>", page, re.I | re.S):
            # The official Class XII 2022 main-exam Chemistry row is 6.78 MB.
            if not re.search(r"\bCHEMISTRY\b", row, re.I) or not re.search(r"6\.78\s*MB", row, re.I):
                continue
            for href in re.findall(r"""href\s*=\s*["']([^"']+)["']""", row, re.I):
                url = urljoin(marking_index, unescape(href))
                parts = urlsplit(url)
                if parts.scheme == "https" and parts.hostname == "www.cbse.gov.in" and parts.path.lower().endswith(".zip"):
                    return url
    except OSError as error:
        print(f"Could not read the 2022 marking scheme index: {error}")
    return None


if year == 2022:
    marking_archive = find_2022_marking_archive()
    if marking_archive:
        archives["marking-scheme"] = marking_archive
    else:
        del archives["marking-scheme"]
with ThreadPoolExecutor(max_workers=2) as pool:
    files = dict(zip(archives, pool.map(extract, archives)))
papers = files["question-paper"]
schemes = files.get("marking-scheme", {})

cards = []
for code in sorted(papers.keys() | schemes.keys()):
    label = "Visually Impaired Paper (56B)" if code == "56-B" else "Set " + code.replace("-", "/")
    links = []
    for files, title in ((papers, "question paper"), (schemes, "marking scheme")):
        if code in files:
            links.append(f'<a href="./{folder_name}/{files[code]}" target="_blank" rel="noopener">Open {title} PDF ↗</a>')
        else:
            links.append(f"<span>See official archive below for the {title}.</span>")
    cards.append(f'<article class="card"><h2>{escape(label)}</h2><div class="paper-links">{"".join(links)}</div></article>')

page_path = publish / page_name
page = page_path.read_text(encoding="utf-8")
page = page.replace("<!-- Set cards -->", "\n".join(cards))
if year == 2022 and "marking-scheme" in archives:
    archive = escape(archives["marking-scheme"], quote=True)
    page = page.replace("<!-- Additional archive -->",
                        f'<a href="{archive}">Chemistry marking schemes (ZIP) ↗</a>')
page_path.write_text(page, encoding="utf-8")
print(f"Published {len(cards)} CBSE {year} set cards, with {len(papers.keys() & schemes.keys())} matched pairs.")
