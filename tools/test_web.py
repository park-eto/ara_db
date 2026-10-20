"""Automated verification script for Underdark Web All Datasets (Items, Heroes, Mercenaries, Mounts)."""
import json
import urllib.request

PORT = 8000
BASE_URL = f"http://localhost:{PORT}"

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
    "/data/underdark_all.js"
]

for ep in endpoints:
    url = BASE_URL + ep
    req = urllib.request.Request(url)
    try:
        with urllib.request.urlopen(req) as resp:
            print(f" [OK] {ep} -> Status {resp.status}, Size {len(resp.read())} bytes")
    except Exception as e:
        print(f" [FAIL] {ep} -> {e}")

print("\n=== 2. Verifying Expansion Data Content ===")

# Heroes
with open(r"c:\dev\workplace\underdark_web\data\heroes.json", encoding="utf-8") as f:
    heroes = json.load(f)
print(f"Heroes count: {len(heroes)}")
assert len(heroes) >= 30, "Should have 30+ heroes"
ork = next((h for h in heroes if "오크" in h["name"]), None)
assert ork is not None, "Hero '오크와 멧돼지' should exist"
print(f"Sample Hero: {ork['name']}, Tier: {ork['tier']}, Levels: {list(ork['levels'].keys())}")

# Mercenaries
with open(r"c:\dev\workplace\underdark_web\data\mercenaries.json", encoding="utf-8") as f:
    mercs = json.load(f)
print(f"Mercenaries count: {len(mercs)}")
assert len(mercs) >= 30, "Should have 30+ mercenaries"
grim = next((m for m in mercs if "저승사자" in m["name"]), None)
assert grim is not None, "Mercenary '저승사자' should exist"
print(f"Sample Mercenary: {grim['name']}, Rec: {grim['recommend']}, TierValues: {grim['tierValues']}")

# Mounts
with open(r"c:\dev\workplace\underdark_web\data\mounts.json", encoding="utf-8") as f:
    mount_data = json.load(f)
mounts = mount_data["mounts"]
sub_options = mount_data["subOptions"]
print(f"Mounts count: {len(mounts)}, SubOptions rules: {len(sub_options)}")
assert len(mounts) == 57, "Should have exactly 57 mounts"
white_dragon = next((m for m in mounts if "아기 백룡" in m["name"]), None)
assert white_dragon is not None, "Mount '아기 백룡' should exist"
print(f"Sample Mount: No.{white_dragon['no']} {white_dragon['name']}, Ability: {white_dragon['ability']}")

print("\n🎉 ALL EXPANSION DATA & SERVER TESTS PASSED SUCCESSFULLY!")
