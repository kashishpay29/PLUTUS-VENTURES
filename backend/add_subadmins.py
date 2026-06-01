# import os, uuid, bcrypt
# from datetime import datetime, timezone
# from pymongo import MongoClient

# MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
# DB_NAME   = os.environ.get("DB_NAME", "plutus")

# client = MongoClient(MONGO_URL)
# db     = client[DB_NAME]

# def now_iso():
#     return datetime.now(timezone.utc).isoformat()

# def hash_password(password: str) -> str:
#     salt = bcrypt.gensalt()
#     return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

# SUB_ADMINS = [
#     {"name": "Laxmi Yadav",     "phone": "9773782206", "email": "laxmi@plutusventures.in",  "password": "Laxmi@678"},
#     {"name": "Swati Gupta",     "phone": "9920855335", "email": "swati@plutusventures.in",  "password": "Swati@123"},
#     {"name": "Mumtaaz Shaikh",  "phone": "8657989972", "email": "sales2@plutusventures.in", "password": "Mumtaaz@321"},
#     {"name": "Varsha Solanki",  "phone": "8652480928", "email": "varsha@plutusventures.in", "password": "Varsha@876"},
#     {"name": "Suraj Jhadhav",   "phone": "9834830979", "email": "suraj@plutusventures.in",  "password": "Suraj@123"},
#     {"name": "Nancy Das",       "phone": "9739075308", "email": "nancy@plutusventures.in",  "password": "Nancy@321"},
# ]

# inserted = 0
# skipped  = 0

# for u in SUB_ADMINS:
#     email = u["email"].lower().strip()
#     if db.users.find_one({"email": email}):
#         print(f"  SKIP (exists): {u['name']} <{email}>")
#         skipped += 1
#         continue

#     db.users.insert_one({
#         "id":            str(uuid.uuid4()),
#         "email":         email,
#         "name":          u["name"],
#         "role":          "sub_admin",
#         "phone":         u["phone"],
#         "password_hash": hash_password(u["password"]),
#         "is_active":     True,
#         "status":        "active",
#         "created_at":    now_iso(),
#         "updated_at":    now_iso(),
#     })
#     print(f"  ADDED: {u['name']} <{email}>")
#     inserted += 1

# print(f"\nDone — {inserted} added, {skipped} skipped.")
