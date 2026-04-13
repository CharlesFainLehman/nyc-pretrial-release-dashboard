#!/usr/bin/env python3
"""
Preprocess NYS DCJS Pretrial Release CSVs into compact JSON for the dashboard.
Filters to NYC boroughs and aggregates by key dimensions.
"""

import csv
import json
import os
import sys
from collections import defaultdict
from pathlib import Path

# NYC borough counties
NYC_COUNTIES = {'Bronx', 'Kings', 'New York', 'Queens', 'Richmond'}

# Friendly borough names for display
BOROUGH_NAMES = {
    'Bronx': 'Bronx',
    'Kings': 'Brooklyn',
    'New York': 'Manhattan',
    'Queens': 'Queens',
    'Richmond': 'Staten Island',
}

# CSV files and their years
DATA_DIR = Path(__file__).parent.parent
CSV_FILES = [
    ('NYS for Web 2020.csv', 2020),
    ('NYS for Web 2021.csv', 2021),
    ('NYS for Web 2022.csv', 2022),
    ('NYS for Web 2023.csv', 2023),
    ('NYS for Web 2024.csv', 2024),
    ('NYS for Web 2025.csv', 2025),
]

# Release decision mapping
RELEASE_KEYS = ['ROR', 'Disposed at arraign', 'Nonmonetary release', 'Bail-set', 'Unknown', 'Remanded']

# Rearrest category mapping
REARREST_KEYS = ['No Arrest', 'Misdemeanor', 'Non-Violent Felony', 'Violent Felony', 'NULL']


def parse_release(val):
    """Map release decision string to index in RELEASE_KEYS."""
    if val in RELEASE_KEYS:
        return RELEASE_KEYS.index(val)
    return RELEASE_KEYS.index('Unknown')


def parse_rearrest(val):
    """Map rearrest string to index in REARREST_KEYS."""
    if val in REARREST_KEYS:
        return REARREST_KEYS.index(val)
    if val == '' or val == 'NULL':
        return REARREST_KEYS.index('NULL')
    return REARREST_KEYS.index('NULL')


def parse_severity(val):
    """Normalize severity to a clean category."""
    if val == 'Felony':
        return 'Felony'
    elif val == 'Misdemeanor':
        return 'Misdemeanor'
    elif val == 'Violation':
        return 'Violation'
    elif val == 'Infraction':
        return 'Infraction'
    else:
        return 'Unknown'


def process_files():
    """Read all CSVs, filter to NYC, and return rows as dicts."""
    all_categories = set()
    all_judges = set()
    rows = []

    for filename, file_year in CSV_FILES:
        filepath = DATA_DIR / filename
        if not filepath.exists():
            print(f"WARNING: {filepath} not found, skipping")
            continue

        print(f"Processing {filename}...")
        has_rearrest_180 = (file_year >= 2021)
        count = 0
        nyc_count = 0

        with open(filepath, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for raw in reader:
                count += 1
                county = raw.get('County_Name', '').strip()
                if county not in NYC_COUNTIES:
                    continue
                nyc_count += 1

                charge_cat = raw.get('Arraign Charge Category', '').strip()
                if not charge_cat:
                    charge_cat = 'Unknown'
                all_categories.add(charge_cat)

                judge = raw.get('Judge_Name', '').strip()
                if judge:
                    all_judges.add(judge)

                severity = parse_severity(raw.get('Top_Charge_Severity_at_Arrest', '').strip())

                release = raw.get('Release Decision at Arraign', '').strip()
                rearrest = raw.get('rearrest', '').strip()
                rearrest_180 = raw.get('rearrest_180', '').strip() if has_rearrest_180 else ''
                rearrest_firearm = raw.get('rearrest_firearm', '').strip()
                supervision = raw.get('supervision', '').strip()
                fta = raw.get('Warrant_Ordered_btw_Arraign_and_Dispo', '').strip()

                rows.append({
                    'year': file_year,
                    'county': county,
                    'judge': judge if judge else 'Unknown',
                    'category': charge_cat,
                    'severity': severity,
                    'release_idx': parse_release(release),
                    'rearrest_idx': parse_rearrest(rearrest),
                    'rearrest180_idx': parse_rearrest(rearrest_180) if rearrest_180 else REARREST_KEYS.index('NULL'),
                    'rearrest_firearm': 1 if rearrest_firearm == '1' else (0 if rearrest_firearm == '0' else -1),
                    'supervision': 1 if supervision == '1' else (0 if supervision == '0' else -1),
                    'has_rearrest_180': has_rearrest_180,
                    'fta': 1 if fta == 'Y' else (0 if fta == 'N' else -1),
                })

        print(f"  Total: {count:,}, NYC: {nyc_count:,}")

    return rows, sorted(all_categories), sorted(all_judges)


def aggregate_county(rows, categories, severities):
    """Aggregate by year x county x category x severity."""
    agg = defaultdict(lambda: [0] * 24)  # total + 6 release + 5 rearrest + 5 rearrest180 + 3 firearm + 2 supervision + 2 fta

    cat_idx = {c: i for i, c in enumerate(categories)}
    sev_idx = {s: i for i, s in enumerate(severities)}
    county_list = sorted(NYC_COUNTIES)
    county_idx = {c: i for i, c in enumerate(county_list)}

    for r in rows:
        key = (r['year'], county_idx[r['county']], cat_idx[r['category']], sev_idx[r['severity']])
        arr = agg[key]
        arr[0] += 1  # total
        arr[1 + r['release_idx']] += 1  # release decision
        arr[7 + r['rearrest_idx']] += 1  # rearrest
        arr[12 + r['rearrest180_idx']] += 1  # rearrest_180
        # firearm: 0=no, 1=yes, 2=null
        if r['rearrest_firearm'] == 0:
            arr[17] += 1
        elif r['rearrest_firearm'] == 1:
            arr[18] += 1
        else:
            arr[19] += 1
        # supervision: 0=no, 1=yes (null counted by total - no - yes)
        if r['supervision'] == 0:
            arr[20] += 1
        elif r['supervision'] == 1:
            arr[21] += 1
        # fta: 0=no, 1=yes
        if r['fta'] == 0:
            arr[22] += 1
        elif r['fta'] == 1:
            arr[23] += 1

    return agg, county_list


def aggregate_judge(rows, categories, severities, judges):
    """Aggregate by year x county x judge x category x severity."""
    agg = defaultdict(lambda: [0] * 24)

    cat_idx = {c: i for i, c in enumerate(categories)}
    sev_idx = {s: i for i, s in enumerate(severities)}
    county_list = sorted(NYC_COUNTIES)
    county_idx = {c: i for i, c in enumerate(county_list)}
    judge_idx = {j: i for i, j in enumerate(judges)}

    for r in rows:
        if r['judge'] not in judge_idx:
            continue
        key = (r['year'], county_idx[r['county']], judge_idx[r['judge']], cat_idx[r['category']], sev_idx[r['severity']])
        arr = agg[key]
        arr[0] += 1
        arr[1 + r['release_idx']] += 1
        arr[7 + r['rearrest_idx']] += 1
        arr[12 + r['rearrest180_idx']] += 1
        if r['rearrest_firearm'] == 0:
            arr[17] += 1
        elif r['rearrest_firearm'] == 1:
            arr[18] += 1
        else:
            arr[19] += 1
        if r['supervision'] == 0:
            arr[20] += 1
        elif r['supervision'] == 1:
            arr[21] += 1
        if r['fta'] == 0:
            arr[22] += 1
        elif r['fta'] == 1:
            arr[23] += 1

    return agg, county_list


def build_json(agg, county_list, categories, severities, judges=None):
    """Build compact JSON structure."""
    columns = [
        'year', 'county_idx', 'cat_idx', 'sev_idx', 'total',
        'ror', 'disposed', 'nmr', 'bail', 'unknown', 'remanded',
        'ra_none', 'ra_misd', 'ra_nvf', 'ra_vf', 'ra_null',
        'ra180_none', 'ra180_misd', 'ra180_nvf', 'ra180_vf', 'ra180_null',
        'raf_no', 'raf_yes', 'raf_null',
        'sup_no', 'sup_yes',
        'fta_no', 'fta_yes'
    ]

    if judges is not None:
        columns = ['year', 'county_idx', 'judge_idx', 'cat_idx', 'sev_idx'] + columns[4:]

    data = []
    for key, metrics in sorted(agg.items()):
        row = list(key) + metrics
        data.append(row)

    result = {
        'counties': county_list,
        'borough_names': [BOROUGH_NAMES[c] for c in county_list],
        'categories': categories,
        'severities': severities,
        'releases': RELEASE_KEYS,
        'rearrests': REARREST_KEYS,
        'columns': columns,
        'data': data,
    }

    if judges is not None:
        result['judges'] = judges

    return result


def main():
    print("=" * 60)
    print("NYC Pre-Trial Release Data Preprocessor")
    print("=" * 60)

    rows, categories, judges = process_files()
    print(f"\nTotal NYC rows: {len(rows):,}")
    print(f"Charge categories: {len(categories)}")
    print(f"Unique judges: {len(judges)}")

    severities = ['Felony', 'Misdemeanor', 'Violation', 'Infraction', 'Unknown']

    # County aggregation
    print("\nAggregating by county...")
    county_agg, county_list = aggregate_county(rows, categories, severities)
    county_json = build_json(county_agg, county_list, categories, severities)
    print(f"  County rows: {len(county_agg):,}")

    # Judge aggregation
    print("Aggregating by judge...")
    judge_agg, _ = aggregate_judge(rows, categories, severities, judges)
    judge_json = build_json(judge_agg, county_list, categories, severities, judges)
    print(f"  Judge rows: {len(judge_agg):,}")

    # Write output
    out_dir = DATA_DIR / 'data'
    out_dir.mkdir(exist_ok=True)

    county_path = out_dir / 'county_agg.json'
    with open(county_path, 'w') as f:
        json.dump(county_json, f, separators=(',', ':'))
    print(f"\nWrote {county_path} ({county_path.stat().st_size / 1024:.0f} KB)")

    judge_path = out_dir / 'judge_agg.json'
    with open(judge_path, 'w') as f:
        json.dump(judge_json, f, separators=(',', ':'))
    print(f"Wrote {judge_path} ({judge_path.stat().st_size / 1024:.0f} KB)")

    # Metadata
    meta = {
        'source': 'https://ww2.nycourts.gov/pretrial-release-data-33136',
        'source_name': 'NYS Division of Criminal Justice Services (DCJS)',
        'description': 'DCJS Supplemental Pretrial Release Data File, filtered to NYC boroughs',
        'years': [2020, 2021, 2022, 2023, 2024, 2025],
        'total_cases': len(rows),
        'caveats': [
            'rearrest_180 data not available for 2020',
            '2025 contains partial year data',
            'Superior Court data pre-2022 may be incomplete',
            'NULL rearrest values indicate cases likely still pending',
        ],
    }
    meta_path = out_dir / 'metadata.json'
    with open(meta_path, 'w') as f:
        json.dump(meta, f, indent=2)
    print(f"Wrote {meta_path}")

    # Spot check
    print("\n--- Spot Check ---")
    total_from_json = sum(row[4] if len(county_json['columns']) > 4 else 0 for row in county_json['data'])
    print(f"Total from county_agg: {total_from_json:,}")
    print(f"Total from raw rows:   {len(rows):,}")
    if total_from_json == len(rows):
        print("MATCH!")
    else:
        print("MISMATCH - investigate!")

    print("\nDone!")


if __name__ == '__main__':
    main()
