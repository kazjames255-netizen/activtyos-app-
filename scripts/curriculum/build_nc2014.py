#!/usr/bin/env python3
"""Build server/src/data/curriculum/nc2014.json from the owner's Google Sheet export
("ActivityOS-lessons-vs-national-curriculum", tabs: Coverage check / Lessons mapped / Area x year).
Input: a JSON dump {lessons, coverage, areaYear} (see scratch/nc/nc.json). Usage: build_nc2014.py <nc.json> <out.json>
Compact on purpose (server loads it once; ~0.9 MB): lessons are keyed by the Oak URL minus its host prefix."""
import json, re, sys
PREFIX = "https://www.thenational.academy/teachers/programmes/"
SUBJ = {"Mathematics": "maths", "English": "english", "Science": "science", "Languages": "languages"}
STATUS = {"Statutory NC content": 0, "Beyond NC (languages statutory KS2–KS3 only)": 1, "Non-statutory (beyond NC)": 2}
CONF = {"High": 0, "Medium": 1}
slug = lambda s: re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
d = json.load(open(sys.argv[1]))
areas, idx = [], {}
for r in d["areaYear"]:
    k = (r["NC subject"], r["NC strand"], r["NC area"])
    idx[k] = len(areas)
    areas.append({"id": f"nc.{SUBJ[k[0]]}.{slug(k[1])}.{slug(k[2])}", "subject": SUBJ[k[0]], "strand": k[1], "area": k[2]})
assert len({a["id"] for a in areas}) == len(areas), "area ids must be unique"
yr = lambda s: int(s.split()[-1])
expected = []  # one row per sheet "coverage check" row: [areaIdx, fromYear, toYear] — a KS row spans several years and is judged as a whole
for r in d["coverage"]:
    ai = next(i for i, a in enumerate(areas) if a["subject"] == SUBJ[r["NC subject"]] and a["area"] == r["NC area"])
    y = r["Year / key stage"]
    a, b = (yr(y), yr(y)) if y.startswith("Year") else {"KS1": (1, 2), "KS2": (3, 6), "KS3": (7, 9), "KS4": (10, 11)}[y]
    expected.append([ai, a, b])
lessons = {}
for r in d["lessons"]:
    url = r["Oak URL"]
    assert url.startswith(PREFIX), url
    lessons[url[len(PREFIX):]] = [idx[(r["NC subject"], r["NC strand"], r["NC area"])], yr(r["Year"]), CONF[r["Match confidence"]], STATUS[r["NC status"]]]
out = {"framework": {"id": "nc2014", "label": "National curriculum (England)", "version": "2014 programmes of study — rewrite expected for first teaching from Sept 2028",
                     "note": "Lessons are auto-mapped: Maths and Science by unit, English lesson by lesson. Medium-confidence tags are judgement calls."},
       "areas": areas, "expected": expected, "lessons": lessons}
json.dump(out, open(sys.argv[2], "w"), ensure_ascii=False, separators=(",", ":"))
print(len(areas), "areas;", len(expected), "expected rows;", len(lessons), "lessons")
