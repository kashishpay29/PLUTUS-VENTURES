"""
Creates dummy tickets for testing analytics/customer features.
All dummy tickets are tagged with is_dummy=True for easy removal.

Run from backend folder with venv activated:
  python dummy_tickets.py

To remove all dummy tickets after testing:
  python dummy_tickets.py --remove
"""
import os, sys, uuid
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient
import random

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME   = os.environ.get("DB_NAME", "plutus")
client    = MongoClient(MONGO_URL)
db        = client[DB_NAME]

# ── Remove mode ──────────────────────────────────────────────────────────────
if "--remove" in sys.argv:
    result = db.tickets.delete_many({"is_dummy": True})
    print(f"✅ Removed {result.deleted_count} dummy tickets")
    sys.exit(0)

# ── Helpers ──────────────────────────────────────────────────────────────────
def now_iso(days_ago=0, hours_ago=0):
    dt = datetime.now(timezone.utc) - timedelta(days=days_ago, hours=hours_ago)
    return dt.isoformat()

def next_ticket_number():
    year = datetime.now(timezone.utc).year
    doc = db.counters.find_one_and_update(
        {"_id": f"ticket_{year}"}, {"$inc": {"sequence_value": 1}},
        upsert=True, return_document=True,
    )
    return f"TKT-{year}-{doc['sequence_value']:04d}"

# ── Fetch real data to reference ─────────────────────────────────────────────
companies = list(db.companies.find({}, {"_id": 0, "id": 1, "name": 1}).limit(10))
engineers  = list(db.users.find({"role": "engineer"}, {"_id": 0, "id": 1, "name": 1}))
admin      = db.users.find_one({"role": {"$in": ["admin", "sub_admin"]}}, {"_id": 0, "id": 1, "name": 1})

if not companies:
    print("❌ No companies found. Add companies first.")
    sys.exit(1)

# ── Dummy data ────────────────────────────────────────────────────────────────
CUSTOMERS = [
    ("Rohit Sharma",    "rohit.sharma@example.com",   "9876543210"),
    ("Priya Mehta",     "priya.mehta@example.com",    "9823456789"),
    ("Amit Joshi",      "amit.joshi@example.com",     "9712345678"),
    ("Sneha Patil",     "sneha.patil@example.com",    "9634567890"),
    ("Vikram Desai",    "vikram.desai@example.com",   "9556789012"),
    ("Pooja Nair",      "pooja.nair@example.com",     "9445678901"),
    ("Arjun Singh",     "arjun.singh@example.com",    "9334567890"),
]

PROBLEMS = [
    "Laptop not turning on after power surge",
    "Screen flickering and display issues",
    "Keyboard keys not responding",
    "Battery draining too fast",
    "WiFi connectivity issues",
    "System running very slow",
    "Blue screen error on startup",
    "Overheating problem",
    "Printer not connecting to network",
    "Hard disk making clicking sounds",
]

STATUSES = ["open", "assigned", "in_progress", "closed", "report_generated"]

# Shared serial numbers (3 tickets per serial = strong repeat complaints)
SHARED_SERIALS = ["SRL-REPEAT-001", "SRL-REPEAT-002", "SRL-REPEAT-003"]
SHARED_CUSTOMERS = [
    ("Rohit Sharma",  "SRL-REPEAT-001", "Dell",   "Inspiron 15",   "DEV-RPT-001"),
    ("Rohit Sharma",  "SRL-REPEAT-001", "Dell",   "Inspiron 15",   "DEV-RPT-001"),
    ("Rohit Sharma",  "SRL-REPEAT-001", "Dell",   "Inspiron 15",   "DEV-RPT-001"),
    ("Priya Mehta",   "SRL-REPEAT-002", "HP",     "EliteBook 840", "DEV-RPT-002"),
    ("Priya Mehta",   "SRL-REPEAT-002", "HP",     "EliteBook 840", "DEV-RPT-002"),
    ("Priya Mehta",   "SRL-REPEAT-002", "HP",     "EliteBook 840", "DEV-RPT-002"),
    ("Amit Joshi",    "SRL-REPEAT-003", "Lenovo", "ThinkPad X1",   "DEV-RPT-003"),
    ("Amit Joshi",    "SRL-REPEAT-003", "Lenovo", "ThinkPad X1",   "DEV-RPT-003"),
    ("Amit Joshi",    "SRL-REPEAT-003", "Lenovo", "ThinkPad X1",   "DEV-RPT-003"),
]
BRANDS = ["Dell", "HP", "Lenovo", "Apple", "Asus"]
MODELS = ["Inspiron 15", "EliteBook 840", "ThinkPad X1", "MacBook Pro", "VivoBook"]

# ── Create tickets ─────────────────────────────────────────────────────────────
created_count = 0

# First: 9 tickets with shared serials (3 per serial)
print("\n--- Shared serial tickets (repeat complaints) ---")
for name, serial, brand, model, dev_id in SHARED_CUSTOMERS:
    company  = random.choice(companies)
    days_ago = random.randint(1, 60)
    engineer = random.choice(engineers) if engineers else None
    tno      = next_ticket_number()
    doc = {
        "id":                  str(uuid.uuid4()),
        "ticket_number":       tno,
        "ticket_no":           tno,
        "status":              random.choice(STATUSES),
        "customer_name":       name,
        "customer_email":      f"{name.lower().replace(' ','.')}@example.com",
        "customer_phone":      "9876543210",
        "customer_company":    company["name"],
        "company_id":          company["id"],
        "contact_source":      random.choice(["phone", "email", "walk_in"]),
        "problem_description": random.choice(PROBLEMS),
        "device_id":           dev_id,
        "device_serial":       serial,
        "device_brand":        brand,
        "device_model":        model,
        "assigned_engineer_id": engineer["id"] if engineer else None,
        "created_by":          admin["id"] if admin else None,
        "created_by_name":     admin["name"] if admin else "Admin",
        "created_by_role":     "admin",
        "created_at":          now_iso(days_ago=days_ago),
        "updated_at":          now_iso(days_ago=days_ago),
        "is_dummy":            True,
    }
    db.tickets.insert_one(doc)
    created_count += 1
    print(f"  ADDED: {tno} | {name} | serial={serial} | {days_ago}d ago")

# Then: 10 random tickets spread over 3 months
print("\n--- Random tickets (customer analytics) ---")
for i in range(10):
    customer = random.choice(CUSTOMERS)
    company  = random.choice(companies)
    days_ago = random.randint(0, 90)
    engineer = random.choice(engineers) if engineers else None
    tno      = next_ticket_number()
    doc = {
        "id":                  str(uuid.uuid4()),
        "ticket_number":       tno,
        "ticket_no":           tno,
        "status":              random.choice(STATUSES),
        "customer_name":       customer[0],
        "customer_email":      customer[1],
        "customer_phone":      customer[2],
        "customer_company":    random.choice(companies)["name"],
        "company_id":          company["id"],
        "contact_source":      random.choice(["phone", "email", "walk_in"]),
        "problem_description": random.choice(PROBLEMS),
        "device_id":           f"DEV-DUMMY-{i:03d}",
        "device_serial":       f"SRL-DUMMY-{i:03d}",
        "device_brand":        random.choice(BRANDS),
        "device_model":        random.choice(MODELS),
        "assigned_engineer_id": engineer["id"] if engineer else None,
        "created_by":          admin["id"] if admin else None,
        "created_by_name":     admin["name"] if admin else "Admin",
        "created_by_role":     "admin",
        "created_at":          now_iso(days_ago=days_ago),
        "updated_at":          now_iso(days_ago=days_ago),
        "is_dummy":            True,
    }
    db.tickets.insert_one(doc)
    created_count += 1
    print(f"  ADDED: {tno} | {customer[0]} | {days_ago}d ago")

print(f"\n✅ Created {created_count} dummy tickets")
print(f"   Shared serials used: {SHARED_SERIALS} (for repeat complaints chart)")
print(f"\nTo remove all dummy tickets:")
print(f"   python dummy_tickets.py --remove")