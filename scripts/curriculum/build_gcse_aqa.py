#!/usr/bin/env python3
"""Build server/src/data/curriculum/gcse-aqa.json from the unit→area mapping (scratch/nc/gcse-aqa.json, built + validated by
scratch/nc/build_gcse.py + validate_gcse.py) and the lesson list. Usage: build_gcse_aqa.py <nc.json> <gcse-aqa.json> <out.json>
Every KS4 lesson inherits its UNIT's area(s); the first area listed is the lesson's primary area. Confidence: High 0 / Medium 1 / Low 2."""
import json, sys, re
PREFIX = "https://www.thenational.academy/teachers/programmes/"
nc = json.load(open(sys.argv[1])); g = json.load(open(sys.argv[2]))
GROUP = {"maths": "maths", "english": "english", "biology": "science", "chemistry": "science", "physics": "science", "french": "languages", "german": "languages", "spanish": "languages"}
areas, idx = [], {}
for a in g["areas"]:
    if a["id"].endswith(".unmapped"): continue
    sub = a["subject"].lower()
    idx[a["id"]] = len(areas)
    areas.append({"id": a["id"], "subject": sub, "group": GROUP[sub], "strand": a["strand"], "area": a["area"], **({"code": a["code"]} if a.get("code") else {})})
CONF = {"High": 0, "Medium": 1, "Low": 2}
lessons, secondary = {}, {}
for r in nc["lessons"]:
    if r["Key stage"] != "KS4": continue
    url = r["Oak URL"]; key = url[len(PREFIX):]
    m = re.match(r"([^/]+)/units/([^/]+)/lessons/", key)
    u = g["units"].get(f"{m.group(1)}|{m.group(2)}")
    if not u or not u["areas"] or u["areas"][0] not in idx: continue
    lessons[key] = [idx[u["areas"][0]], int(r["Year"].split()[-1]), CONF[u["confidence"]], 0]
    extra = [idx[x] for x in u["areas"][1:] if x in idx]
    if extra: secondary[key] = extra
expected = [[i, 10, 11] for i in range(len(areas))]
out = {"framework": {"id": "gcse-aqa", "label": "GCSE (AQA)", "version": g["framework"]["version"],
                     "note": "Auto-mapped from Oak KS4 unit names to AQA specification areas. MFL themes are inferred from unit titles (Oak's KS4 language units use different theme names) — treat Low/Medium as a starting point and correct as needed."},
       "areas": areas, "expected": expected, "lessons": lessons, "secondary": secondary}
json.dump(out, open(sys.argv[3], "w"), ensure_ascii=False, separators=(",", ":"))
print(len(areas), "areas;", len(lessons), "lessons;", len(secondary), "with a second area")
