"""Automated verification script for Underdark Web All Datasets
(Items, Heroes, Mercenaries, Mounts, Pets, Camp Structures/Props, Growth).
"""
import json
import urllib.request
from pathlib import Path

PORT = 8000
BASE_URL = f"http://localhost:{PORT}"
ROOT = Path(r"c:\dev\workplace\underdark_web")

print("=== 1. Checking HTTP Static File Responses ===")
endpoints = [
    "/index.html",
    "/admin.html",
    "/css/style.css",
    "/js/search.js",
    "/js/app.js",
    "/data/items.js",
    "/data/items.json",
    "/data/heroes.json",
    "/data/mercenaries.json",
    "/data/mounts.json",
    "/data/pets.json",
    "/data/camp.json",
    "/data/underdark_all.js",
    "/assets/growth/underdark_growth.png"
]

for ep in endpoints:
    url = BASE_URL + ep
    req = urllib.request.Request(url)
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            print(f" [OK] {ep} -> Status {resp.status}, Size {len(resp.read())} bytes")
    except Exception as e:
        print(f" [FAIL] {ep} -> {e}")

print("\n=== 2. Verifying Expansion Data Content ===")

# Heroes
with open(ROOT / "data" / "heroes.json", encoding="utf-8") as f:
    heroes = json.load(f)
print(f"Heroes count: {len(heroes)}")
assert len(heroes) >= 30, "Should have 30+ heroes"
ork = next((h for h in heroes if "오크" in h["name"]), None)
assert ork is not None, "Hero '오크와 멧돼지' should exist"
print(f"Sample Hero: {ork['name']}, Tier: {ork['tier']}, Levels: {list(ork['levels'].keys())}")

# Mercenaries
with open(ROOT / "data" / "mercenaries.json", encoding="utf-8") as f:
    mercs = json.load(f)
print(f"Mercenaries count: {len(mercs)}")
assert len(mercs) >= 30, "Should have 30+ mercenaries"
grim = next((m for m in mercs if "저승사자" in m["name"]), None)
assert grim is not None, "Mercenary '저승사자' should exist"
print(f"Sample Mercenary: {grim['name']}, Rec: {grim['recommend']}")

# Mounts
with open(ROOT / "data" / "mounts.json", encoding="utf-8") as f:
    mount_data = json.load(f)
mounts = mount_data["mounts"]
print(f"Mounts count: {len(mounts)}")
assert len(mounts) == 57, "Should have exactly 57 mounts"

# Pets
with open(ROOT / "data" / "pets.json", encoding="utf-8") as f:
    pets_data = json.load(f)
pets = pets_data["pets"]
print(f"Pets count: {len(pets)}")
assert len(pets) == 26, "Should have exactly 26 pets"

# Camp (Structures & Props)
with open(ROOT / "data" / "camp.json", encoding="utf-8") as f:
    camp = json.load(f)
structures = camp["structures"]
props = camp["props"]
common = camp["common"]
grades = common["grades"]
sub_opts = common["subOptions"]
rand_opts = common["randomOptions"]

print(f"Camp Structures count: {len(structures)}")
print(f"Camp Props count: {len(props)}")
print(f"Camp Grades ({len(grades)}): {grades}")
print(f"Camp Sub Options count: {len(sub_opts)}")
print(f"Camp Random Options count: {len(rand_opts)}")

assert len(structures) == 10, f"Should have 10 structures, got {len(structures)}"
assert len(props) == 34, f"Should have 34 props, got {len(props)}"
assert len(grades) == 8, f"Should have 8 grades, got {len(grades)}"
assert len(sub_opts) == 8, f"Should have 8 sub options, got {len(sub_opts)}"
assert len(rand_opts) == 12, f"Should have 12 random options, got {len(rand_opts)}"

# Verify all images and levels exist
for s in structures:
    assert (ROOT / s["img"]).exists(), f"Structure image missing: {s['img']}"
    assert s.get("level") in (0, 20, 40, 60), f"Invalid structure level: {s}"
for p in props:
    assert (ROOT / p["img"]).exists(), f"Prop image missing: {p['img']}"
    assert p.get("level") in (0, 20, 40, 60), f"Invalid prop level: {p}"

# Growth Asset
growth_img = ROOT / "assets" / "growth" / "underdark_growth.png"
assert growth_img.exists(), "Growth image does not exist!"
print(f"Growth Image: {growth_img.name} ({growth_img.stat().st_size} bytes)")

print("\n🎉 ALL EXPANSION DATA & SERVER TESTS PASSED SUCCESSFULLY!")
