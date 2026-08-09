#!/usr/bin/env python3
"""
Scrape missing Pal data from palworld.wiki.gg API.
Generates JSON skeletons matching the existing data format.
"""
import json, re, time, os, sys, urllib.request, urllib.error

API = "https://palworld.wiki.gg/api.php?action=parse&page={}&prop=wikitext&format=json"
OUTPUT_DIR = "/Users/judy/70-Projects/wangzhan/palworldbase/data/pals-new"
DELAY = 1.0  # seconds between requests
TIMEOUT = 30  # seconds per HTTP request

os.makedirs(OUTPUT_DIR, exist_ok=True)

# ---- 44 missing Pals ----
MISSING = [
    "Amione", "Bakemi", "Boltmane", "Bulldosu", "Carnibora", "Clovee",
    "Dualith", "Dupin", "Dynamoff", "Eidrolon", "Elgrove",
    "Faleris Noct", "Flaracle", "Gildra", "Hoodle", "Illuminant Bat",
    "Lapiron", "Lapure", "Leafan", "Loomen", "Majex", "Moldron",
    "Muffly", "Mycora", "Needoll", "Ophydia", "Panthalus", "Pierdon",
    "Puffolt", "Pupperai", "Roujay", "Sekhmet", "Skutlass", "Slowatt",
    "Snock", "Snugloo", "Solmora", "Souffline", "Tetroise", "Tropicaw",
    "Valentail", "Venusa", "Wispaw", "Woolipop Terra",
]

# Known BP values from breeding ranks
BP_VALUES = {
    "Amione": 2520, "Bakemi": 1540, "Boltmane": None, "Bulldosu": 1190,
    "Carnibora": 1700, "Clovee": 2970, "Dualith": 510, "Dupin": 520,
    "Dynamoff": 1400, "Eidrolon": 300, "Elgrove": 2020,
    "Faleris Noct": None, "Flaracle": 390, "Gildra": 1170,
    "Hoodle": 1770, "Illuminant Bat": 1250, "Lapiron": 1680,
    "Lapure": 810, "Leafan": 1410, "Loomen": 890, "Majex": 1010,
    "Moldron": 750, "Muffly": 2480, "Mycora": 760, "Needoll": 2420,
    "Ophydia": 230, "Panthalus": 20, "Pierdon": 1110,
    "Puffolt": 2360, "Pupperai": 2930, "Roujay": 530, "Sekhmet": 870,
    "Skutlass": 1420, "Slowatt": 1750, "Snock": 1780, "Snugloo": 2390,
    "Solmora": 1370, "Souffline": 2000, "Tetroise": 790, "Tropicaw": 1350,
    "Valentail": 1900, "Venusa": 970, "Wispaw": 2250, "Woolipop Terra": 2030,
}

SIZE_MAP = {"xl": "Huge", "l": "Large", "m": "Medium", "s": "Small"}

RARITY_MAP = {
    # Based on BP ranges
    range(0, 100): "Legendary",
    range(100, 500): "Epic",
    range(500, 1500): "Rare",
    range(1500, 9999): "Common",
}

def get_rarity(bp):
    if bp is None: return "Unknown"
    for rng, rarity in RARITY_MAP.items():
        if bp in rng:
            return rarity
    return "Common"

def parse_template(text):
    """Extract key=value pairs from {{Pal|...}} template."""
    # Find the Pal template — handle nested {{...}} by counting braces
    start_match = re.search(r'\{\{Pal\s*\n', text)
    if not start_match:
        return None
    pos = start_match.end()
    depth = 2  # we've seen two opening braces
    end_pos = -1
    i = pos
    while i < len(text) - 1:
        if text[i:i+2] == '{{':
            depth += 2
            i += 2
            continue
        if text[i:i+2] == '}}':
            depth -= 2
            if depth == 0:
                end_pos = i
                break
            i += 2
            continue
        i += 1
    if end_pos == -1:
        return None
    block = text[pos:end_pos]

    data = {}
    current_key = None
    for line in block.split('\n'):
        stripped = line.strip()
        # Skip comments and empty lines
        if not stripped or stripped.startswith('<!--'):
            continue
        # New parameter line: starts with | and has =
        if stripped.startswith('|') and '=' in stripped:
            parts = stripped.split('=', 1)
            key = parts[0].strip().lstrip('|').strip()
            value = parts[1].strip() if len(parts) > 1 else ''
            data[key] = value
            current_key = key
        elif current_key and stripped:
            # Continuation of previous multi-line value
            if data[current_key]:
                data[current_key] += ' ' + stripped
            else:
                data[current_key] = stripped
    return data

def parse_breeding(text):
    """Extract breeding_rank from {{Breeding|...}} template."""
    match = re.search(r'\{\{Breeding\n(.*?)\}\}', text, re.DOTALL)
    if not match:
        return None
    block = match.group(1)
    for line in block.split('\n'):
        if 'breeding_rank' in line:
            val = line.split('=', 1)[1].strip()
            try:
                return int(val)
            except:
                return None
    return None

def parse_skills(active_str):
    """Parse 'Spirit Fire@1; Dragon Burst@7' → list of {name, level}."""
    if not active_str: return []
    skills = []
    for item in active_str.split(';'):
        item = item.strip()
        if not item or '@' not in item:
            continue
        name, level_str = item.rsplit('@', 1)
        name = name.strip()
        level_str = level_str.strip()
        # Handle "Level N" format
        if ' ' in level_str:
            level_str = level_str.split()[-1]
        try:
            level = int(level_str)
        except (ValueError, IndexError):
            continue  # skip malformed entries
        if not name:
            name = "Unknown"
        skills.append({"name": name, "level": level})
    return skills

def parse_work(work_str):
    """Parse 'Gathering@8; Kindling@3' → dict of {workType: level}."""
    result = {}
    if not work_str: return result
    for item in work_str.split(';'):
        item = item.strip()
        if '@' in item:
            name, level = item.rsplit('@', 1)
            # Map wiki work names to our camelCase keys
            key_map = {
                "Kindling": "kindling", "Watering": "watering",
                "Planting": "planting", "Generating Electricity": "generating",
                "Generating": "generating", "Handiwork": "handiwork",
                "Gathering": "gathering", "Lumbering": "lumbering",
                "Mining": "mining", "Medicine Production": "medicine",
                "Medicine": "medicine", "Cooling": "cooling",
                "Transporting": "transporting", "Farming": "farming",
            }
            mapped = key_map.get(name.strip(), name.strip().lower())
            try:
                result[mapped] = int(level.strip())
            except:
                pass
    return result

def guess_role(data, partner_icon, work):
    """Guess Pal role(s) from available data."""
    roles = []
    if partner_icon and 'mount' in partner_icon.lower():
        if 'flying' in partner_icon.lower():
            roles.append("Mount")
            data['isFlyable'] = True
        else:
            roles.append("Mount")
    if work:
        high_work = [k for k, v in work.items() if v >= 2]
        if high_work:
            roles.append("Base Worker")
    atk = data.get('attack', 0)
    if atk and atk > 90:
        roles.append("Combat")
    if not roles:
        roles.append("Combat")
    return list(set(roles))

def fetch_pal(name, max_retries=2):
    """Fetch and parse data for a single Pal from wiki.gg."""
    url = API.format(urllib.parse.quote(name))
    for attempt in range(max_retries + 1):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'PalworldBase/1.0'})
            with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
                raw = json.loads(resp.read())
            break
        except Exception as e:
            if attempt < max_retries:
                time.sleep(2)
                continue
            return None, f"HTTP/API error: {e}"

    if 'error' in raw:
        return None, f"Wiki page not found: {raw['error'].get('info', 'unknown')}"

    wikitext = raw.get('parse', {}).get('wikitext', {}).get('*', '')
    pal_data = parse_template(wikitext)
    if not pal_data:
        return None, "No {{Pal}} template found"

    bp_wiki = parse_breeding(wikitext)
    bp = bp_wiki if bp_wiki else BP_VALUES.get(name)

    # Build slug
    slug = name.lower().replace(' ', '_').replace("'", "")

    # Stats
    def get_int(key, default=0):
        try: return int(pal_data.get(key, default))
        except: return default

    # Work suitability
    work = parse_work(pal_data.get('work_suitability', ''))

    # Skills
    active_skills = parse_skills(pal_data.get('active_skills', ''))
    skills = []
    for s in active_skills:
        skills.append({
            "name": s['name'],
            "element": "Neutral",   # TODO: look up from skills.json
            "power": 0,              # TODO
            "cooldown": 0,           # TODO
            "level": s['level']
        })

    result = {
        "id": slug,
        "gameId": "palworld",
        "number": get_int('no'),
        "name": {
            "zh": "",
            "en": name
        },
        "slug": slug,
        "image": f"/images/pals/{slug}.webp",
        "_source": "wiki.gg auto-generated",
        "_needsReview": ["stats.scale", "skills.power", "skills.cooldown", "skills.element", "drops", "acquisition.habitats", "decision"],
        "classification": {
            "elements": [],
            "rarity": get_rarity(bp),
            "role": [],
            "size": SIZE_MAP.get(pal_data.get('pal_size', '').lower(), "Medium"),
            "isRideable": False,
            "isFlyable": False
        },
        "stats": {
            "hp": get_int('hp'),
            "attack": get_int('attack'),
            "defense": get_int('defense'),
            "rangedAttack": 0,
            "speed": get_int('run_speed'),
            "stamina": get_int('stamina')
        },
        "workSuitability": {
            "kindling": work.get('kindling', 0),
            "watering": work.get('watering', 0),
            "planting": work.get('planting', 0),
            "generating": work.get('generating', 0),
            "handiwork": work.get('handiwork', 0),
            "gathering": work.get('gathering', 0),
            "lumbering": work.get('lumbering', 0),
            "mining": work.get('mining', 0),
            "medicine": work.get('medicine', 0),
            "cooling": work.get('cooling', 0),
            "transporting": work.get('transporting', 0),
            "farming": work.get('farming', 0)
        },
        "skills": skills,
        "partnerSkill": {
            "name": pal_data.get('partner_skill_name', ''),
            "descriptionEn": pal_data.get('partner_skill_desc', '')
        },
        "acquisition": {
            "habitats": [],
            "isBreedable": True,
            "isCatchable": True,
            "isBossEncounter": False,
            "bossLevel": None,
            "bossLocation": None
        },
        "breeding": {
            "breedingPower": bp
        },
        "drops": [],
        "decision": {
            "bestFor": [],
            "gameStage": {"early": False, "mid": False, "late": False},
            "scores": {
                "kindling": 0, "watering": 0, "planting": 0, "generating": 0,
                "handiwork": 0, "gathering": 0, "lumbering": 0, "mining": 0,
                "medicine": 0, "cooling": 0, "transporting": 0, "farming": 0,
                "combat": 0, "mount-flying": 0, "mount-ground": 0
            },
            "reasons": {}
        }
    }

    # Elements
    ele1 = pal_data.get('ele1', '')
    ele2 = pal_data.get('ele2', '')
    if ele1: result['classification']['elements'].append(ele1)
    if ele2 and ele2 != ele1: result['classification']['elements'].append(ele2)

    # Role guessing
    partner_icon = pal_data.get('partner_skill_icon', '')
    ride_sprint = get_int('ride_sprint_speed')
    if ride_sprint > 0:
        result['classification']['isRideable'] = True
    if 'flying' in partner_icon.lower():
        result['classification']['isFlyable'] = True
    if 'mount' in partner_icon.lower() and 'flying' not in partner_icon.lower():
        result['classification']['isRideable'] = True

    result['classification']['role'] = guess_role(
        {'attack': result['stats']['attack']}, partner_icon, work
    )

    # Boss info
    alpha_title = pal_data.get('alpha_title', '')
    if alpha_title:
        result['acquisition']['isBossEncounter'] = True

    # Drops
    drops_match = re.search(r'normal_drops\s*=\s*(.+?)(?:\n|\|)', wikitext)
    if drops_match:
        result['_rawDrops'] = drops_match.group(1).strip()

    return result, None


def main():
    success = []
    failed = []

    for i, name in enumerate(MISSING):
        slug = name.lower().replace(' ', '_').replace("'", "")
        outpath = os.path.join(OUTPUT_DIR, f"{slug}.json")
        if os.path.exists(outpath):
            print(f"[{i+1:2d}/{len(MISSING)}] {name} ... ⏭ skip")
            success.append(name)
            continue
        print(f"[{i+1:2d}/{len(MISSING)}] {name} ...", end=" ", flush=True)
        data, error = fetch_pal(name)

        if data:
            slug = data['slug']
            path = os.path.join(OUTPUT_DIR, f"{slug}.json")
            with open(path, 'w') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            needs = data.get('_needsReview', [])
            print(f"✅ #{data['number']} BP={data['breeding']['breedingPower']} | TODO: {len(needs)} fields")
            success.append(name)
        else:
            print(f"❌ {error}")
            failed.append(name)

        time.sleep(DELAY)

    # Summary
    print(f"\n{'='*60}")
    print(f"Done. Success: {len(success)}, Failed: {len(failed)}")
    if failed:
        print(f"\n❌ Failed ({len(failed)}):")
        for name in failed:
            print(f"   - {name}")
    print(f"\n📁 Output: {OUTPUT_DIR}/")
    print(f"⚠️  All generated files have _needsReview fields that must be filled manually.")
    print(f"   See each file's _needsReview array for the list.")

if __name__ == '__main__':
    main()
