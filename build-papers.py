from concurrent.futures import ThreadPoolExecutor
from html import escape
from io import BytesIO
from pathlib import Path
from urllib.request import Request, urlopen
from zipfile import ZipFile
import re
import sys

publish = Path(sys.argv[1])
year = int(sys.argv[2]) if len(sys.argv) > 2 else 2026
if year not in range(2021, 2027):
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


if year == 2022:
    del archives["marking-scheme"]
papers, schemes = {}, {}
if year != 2021:
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

status = "" if cards else "<p>Open the official CBSE archives below to find your paper and marking scheme by set code.</p>"
title = f"{year} Board Papers &amp; Marking Schemes"
archive_links = "".join(
    f'<a href="{url}">All Chemistry {kind.replace("-", " ")}s (ZIP)</a>'
    for kind, url in archives.items()
)
if year == 2022:
    archive_links += '<a href="https://www.cbse.gov.in/cbsenew/marking-scheme.html">CBSE marking scheme index</a>'
    status = "<p>The official Chemistry question paper archive is below. A main-exam marking scheme ZIP was not verified.</p>"
if year == 2021:
    title = "2021–22 Sample Papers &amp; Marking Schemes"
    status = "<p>CBSE cancelled the regular 2021 Class XII board examination. These are official sample papers for the 2021–22 term-based session.</p>"
    sample_base = "https://cbseacademic.nic.in/web_material/SQP/ClassXII_2021_22/"
    for term, suffix in ((1, ""), (2, "_Term2")):
        cards.append(f'<article class="card"><h2>Term {term} · Chemistry</h2><div class="paper-links">'
                     f'<a href="{sample_base}Chemistry-SQP{suffix}.pdf">Sample question paper PDF ↗</a>'
                     f'<a href="{sample_base}Chemistry-MS{suffix}.pdf">Marking scheme PDF ↗</a></div></article>')
    archive_links = '<a href="https://cbseacademic.nic.in/SQP_CLASSXII_2021-22.html">CBSE Academic 2021–22 sample-paper index ↗</a>'
older_links = "\n".join(
    f'<a href="./papers-{value}.html"{" aria-current=page" if year == value else ""}>'
    f'{f"{value} Board Papers &amp; Marking Schemes" if value != 2021 else "2021–22 Sample Papers &amp; Marking Schemes"}</a>'
    for value in (2024, 2023, 2022, 2021)
)
current_2026 = 'aria-current="page"' if year == 2026 else ""
current_2025 = 'aria-current="page"' if year == 2025 else ""
page = f"""<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title} | Chemistry Achievers Academy</title>
<link rel="stylesheet" href="./site.css"></head>
<body><header><div class="wrap">
<nav aria-label="Academy links"><strong>Chemistry Achievers Academy</strong><a href="https://wa.me/919677795536">Ask a doubt ↗</a></nav>
<nav class="section-nav" aria-label="Quiz sections"><a href="./">2026 Board Exam PYQs</a>
<a href="./practice.html">Practice MCQ Test</a><a href="./mcq-test-1.html">MCQ Test 1</a><a href="./papers.html" {current_2026}>2026 Board Papers &amp; Marking Schemes</a><a href="./papers-2025.html" {current_2025}>2025 Board Papers &amp; Marking Schemes</a>{older_links}<a href="./account.html">Student sign in</a></nav>
<h1>{title}</h1><p>CBSE Class 12 Chemistry · Board Examination</p>
</div></header><main class="wrap">
<div class="paper-list">{''.join(cards)}</div>{status}
<section class="card"><h2>Official CBSE archives</h2><div class="paper-links">
{archive_links}
</div></section></main>
<footer class="wrap"><a href="https://chemistryachieversacademy.in">Academy website ↗</a></footer></body></html>"""
(publish / page_name).write_text(page, encoding="utf-8")
print(f"Published {len(cards)} CBSE {year} set cards, with {len(papers.keys() & schemes.keys())} matched pairs.")
