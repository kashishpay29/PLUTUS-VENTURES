import os, uuid
from datetime import datetime, timezone
from pymongo import MongoClient

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME   = os.environ.get("DB_NAME", "plutus")

client = MongoClient(MONGO_URL)
db     = client[DB_NAME]

def now_iso():
    return datetime.now(timezone.utc).isoformat()

def next_company_code():
    doc = db.counters.find_one_and_update(
        {"_id": "company"}, {"$inc": {"sequence_value": 1}},
        upsert=True, return_document=True,
    )
    return f"CMP-{doc['sequence_value']:04d}"

COMPANIES = [
    "ACCELYA SERVICES INDIA PRIVATE LIMITED",
    "ADANI ELECTRICITY MUMBAI LTD",
    "ADITYA BIRLA RENEWABLES LTD",
    "ARISTO PHARMACEUTICALS PRIVATE LIMITED",
    "ARYSTA LIFESCIENCE INDIA LTD",
    "AXIRO SEMICONDUCTOR PRIVATE LIMITED",
    "BDO India Services Private Limited",
    "CG ADHESIVE PRODUCTS LIMITED",
    "CG POWER AND INDUSTRIAL SOLUTIONS LIMITED",
    "CMS INFO SYSTEMS LIMITED",
    "CRISIL LIMITED",
    "EUREKA FORBES LIMITED",
    "FFSERVICES PRIVATE LIMITED",
    "FINO PAYMENTS BANK LIMITED",
    "GLENMARK PHARMACEUTICALS LIMITED",
    "GODREJ CONSUMER PRODUCTS LTD.",
    "GODREJ INDUSTRIES LTD",
    "Godrej Pet Care Limited",
    "IDFC FIRST BANK LTD",
    "IIFL CAPITAL SERVICES LIMITED",
    "IIFL FINANCE LIMITED",
    "IIFL Home Finance Limited",
    "IN SOLUTIONS GLOBAL LIMITED",
    "INDIA RESURGENCE ASSET MANAGEMENT BUSINESS PRIVATE LIMITED",
    "INFRASTRUCTURE DEVELOPMENT CORPORATION LIMITED",
    "KNIGHT FRANK INDIA PRIVATE LIMITED",
    "KOTAK ALTERNATE ASSET MANAGERS LIMITED",
    "KOTAK MAHINDRA BANK LIMITED",
    "KOTAK MAHINDRA INVESTMENTS LIMITED",
    "L&T Finance Limited",
    "MAHINDRA AND MAHINDRA LIMITED",
    "MAHINDRA SUSTEN PRIVATE LIMITED",
    "MAJESCO SOFTWARE AND SOLUTIONS INDIA PRIVATE LIMITED",
    "Mastek Ltd",
    "NYKAA E- RETAIL LIMITED",
    "PIRAMAL PHARMA LIMITED",
    "PRINCE PIPES AND FITTINGS LTD",
    "PROTOS ENGINEERING CO. PVT LTD.",
    "PUNE IT CITY METRO RAIL LIMITED",
    "SHOPSENSE RETAIL TECHNOLOGIES LIMITED",
    "SMFG INDIA CREDIT COMPANY LIMITED",
    "SODEXO INDIA SERVICES PVT LTD",
]

# Deduplicate against existing companies (checks both name and company_name fields)
existing = set(
    c.get("company_name", c.get("name", "")).strip().lower()
    for c in db.companies.find({}, {"name": 1, "company_name": 1})
    if c.get("company_name") or c.get("name")
)

inserted = 0
skipped  = 0

for name in COMPANIES:
    if name.strip().lower() in existing:
        print(f"  SKIP (exists): {name}")
        skipped += 1
        continue

    doc = {
        "id":             str(uuid.uuid4()),
        "name":           name.strip(),
        "company_name":   name.strip(),
        "company_code":   next_company_code(),
        "is_active":      True,
        "created_at":     now_iso(),
        "updated_at":     now_iso(),
        "address":        None,
        "phone":          None,
        "email":          None,
        "contact_person": None,
    }
    db.companies.insert_one(doc)
    print(f"  ADDED: {name}")
    inserted += 1

print(f"\nDone — {inserted} added, {skipped} skipped (already existed).")