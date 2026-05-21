from dotenv import load_dotenv
import os
import certifi
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

import os
import uuid
import logging
import random
from datetime import datetime, timezone, timedelta
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from datetime import date
from pathlib import Path
from typing import List, Optional, Literal, Dict, Any

from fastapi import (
    FastAPI, APIRouter, HTTPException, Depends, Request, Response,
    Query
)

from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from pymongo import MongoClient
from pydantic import BaseModel, EmailStr
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from auth import (
    hash_password, verify_password, create_access_token,
    get_current_user, require_admin, require_engineer, require_sub_admin,
    decode_token,
)
from storage_client import init_storage, put_object, get_object
from pdf_gen import build_service_report_pdf

# ---------- Setup ----------
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)s | %(name)s | %(message)s'
)
logger = logging.getLogger("plutus-serviceops")


def send_ticket_email(to_email: str, ticket: dict, pdf_bytes: bytes = None,
                      subject_prefix: str = "", sender_name: str = None, sender_email: str = None):
    """Send ticket notification email with optional PDF attachment."""
    try:
        smtp_host = os.environ.get("SMTP_HOST", "")
        smtp_port = int(os.environ.get("SMTP_PORT", "587"))
        smtp_user = os.environ.get("SMTP_USER", "")
        smtp_pass = os.environ.get("SMTP_PASS", "")

        if not smtp_host or not smtp_user:
            logger.warning("SMTP not configured - skipping email")
            return

        # Use sender's name/email if provided, else fall back to env
        display_name = sender_name or os.environ.get("COMPANY_NAME", "Plutus Ventures")
        reply_to = sender_email or os.environ.get("FROM_EMAIL", smtp_user)
        from_email = f"{display_name} <{smtp_user}>"

        ticket_no = ticket.get("ticket_no") or ticket.get("ticket_number", "")
        subject = f"{subject_prefix}Service Ticket {ticket_no} - Plutus Ventures"

        msg = MIMEMultipart()
        msg["From"] = from_email
        msg["Reply-To"] = reply_to
        msg["To"] = to_email
        msg["Subject"] = subject

        status = ticket.get("status", "").replace("_", " ").title()
        body = f"""
Dear Customer,

Your service ticket <b>{ticket_no}</b> has been <b>{status}</b>.

<b>Details:</b>
- Ticket: {ticket_no}
- Status: {status}
- Device: {ticket.get("device_id", "—")}
- Issue: {ticket.get("issue_description") or ticket.get("problem_description", "—")}

{"Please find the service report attached." if pdf_bytes else ""}

Thank you for choosing Plutus Ventures.

Regards,
Plutus Ventures IT Service Team
        """.strip()

        msg.attach(MIMEText(body, "html"))

        if pdf_bytes:
            part = MIMEBase("application", "octet-stream")
            part.set_payload(pdf_bytes)
            encoders.encode_base64(part)
            part.add_header("Content-Disposition", f"attachment; filename=ServiceReport_{ticket_no}.pdf")
            msg.attach(part)

        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(from_email, to_email, msg.as_string())

        logger.info(f"Email sent to {to_email} for ticket {ticket_no}")
    except Exception as e:
        logger.error(f"Email send failed: {e}")


def send_ticket_closed_email(to_email: str, ticket: dict, pdf_bytes: bytes = None,
                             sender_name: str = None, sender_email: str = None):
    """Send 'Ticket Closed' email with engineer-submitted PDF attached.

    Subject: Ticket Closed - {ticket_id}
    Body includes Ticket ID, Product Reference Number, OEM Reference Number,
    Approval Date & Time and a closure confirmation message.
    """
    try:
        smtp_host = os.environ.get("SMTP_HOST", "")
        smtp_port = int(os.environ.get("SMTP_PORT", "587"))
        smtp_user = os.environ.get("SMTP_USER", "")
        smtp_pass = os.environ.get("SMTP_PASS", "")

        ticket_no = ticket.get("ticket_no") or ticket.get("ticket_number", "")
        approved_at = ticket.get("approved_at") or now_iso()
        # Pretty format approved_at (YYYY-MM-DD HH:MM UTC) if ISO
        try:
            dt = datetime.fromisoformat(approved_at.replace("Z", "+00:00"))
            approved_at_pretty = dt.strftime("%Y-%m-%d %H:%M UTC")
        except Exception:
            approved_at_pretty = approved_at

        product_ref = ticket.get("product_reference_number") or "—"
        oem_ref = ticket.get("oem_reference_number") or "—"

        subject = f"Ticket Closed - {ticket_no}"
        display_name = sender_name or os.environ.get("COMPANY_NAME", "Plutus Ventures")
        reply_to = sender_email or os.environ.get("FROM_EMAIL", smtp_user or "no-reply@plutusventures.com")

        body = f"""
Dear Customer,

Your service ticket <b>{ticket_no}</b> has been <b>closed</b> after successful resolution and approval.

<b>Ticket Details:</b><br/>
- Ticket ID: {ticket_no}<br/>
- Product Reference Number: {product_ref}<br/>
- OEM Reference Number: {oem_ref}<br/>
- Approval Date &amp; Time: {approved_at_pretty}<br/>

The engineer's service report is attached for your records. If you have any
questions or need further assistance, please reply to this email.

Thank you for choosing {display_name}.

Regards,<br/>
{display_name} IT Service Team
        """.strip()

        # If SMTP not configured, log the email and return (mocked mode for dev/tests).
        if not smtp_host or not smtp_user:
            logger.warning(
                f"SMTP not configured - MOCK email | to={to_email} subject='{subject}' "
                f"pdf_attached={bool(pdf_bytes)}"
            )
            return {"sent": False, "mocked": True, "to": to_email, "subject": subject}

        from_email = f"{display_name} <{smtp_user}>"
        msg = MIMEMultipart()
        msg["From"] = from_email
        msg["Reply-To"] = reply_to
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "html"))

        if pdf_bytes:
            part = MIMEBase("application", "octet-stream")
            part.set_payload(pdf_bytes)
            encoders.encode_base64(part)
            part.add_header(
                "Content-Disposition",
                f"attachment; filename=ServiceReport_{ticket_no}.pdf",
            )
            msg.attach(part)

        # Simple retry: try up to 2 attempts
        last_err = None
        for attempt in range(2):
            try:
                with smtplib.SMTP(smtp_host, smtp_port) as server:
                    server.starttls()
                    server.login(smtp_user, smtp_pass)
                    server.sendmail(from_email, to_email, msg.as_string())
                logger.info(f"Closure email sent to {to_email} for ticket {ticket_no}")
                return {"sent": True, "to": to_email, "subject": subject}
            except Exception as e:
                last_err = e
                logger.error(f"Closure email attempt {attempt + 1} failed: {e}")
        return {"sent": False, "error": str(last_err), "to": to_email, "subject": subject}
    except Exception as e:
        logger.error(f"send_ticket_closed_email failed: {e}")
        return {"sent": False, "error": str(e), "to": to_email}

mongo_url = os.environ["MONGO_URL"]

import ssl

client = MongoClient(
    mongo_url,
    tlsAllowInvalidCertificates=True
)

db = client[os.environ["DB_NAME"]]

# Rate limiter
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="Plutus Ventures – IT Service Management API",
    version="2.1.0",
    docs_url=os.environ.get("DOCS_URL", "/api/docs"),
    redoc_url=None,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
api = APIRouter(prefix="/api")


# ---------- Security headers + request logging ----------
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(self), geolocation=(self)"
        if request.url.scheme == "https":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response


class RequestLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        import time
        start = time.time()
        response = await call_next(request)
        if request.url.path.startswith("/api/"):
            dur = int((time.time() - start) * 1000)
            logger.info(
                f"{request.method} {request.url.path} "
                f"-> {response.status_code} {dur}ms"
            )
        return response

# ---------- Constants ----------
TICKET_STATUSES = [
    "open", "assigned", "accepted", "travelling", "reached_site",
    "in_progress", "resolved",
    "completed_with_signature", "report_generated", "closed",
    "rejected",
]


# ---------- Helpers ----------
def now_iso():
    return datetime.now(timezone.utc).isoformat()


def new_id():
    return str(uuid.uuid4())


def clean(d):
    if not d:
        return d
    d.pop("_id", None)
    d.pop("password_hash", None)
    return d


def _seq(name: str) -> int:
    doc = db.counters.find_one_and_update(
        {"_id": name}, {"$inc": {"sequence_value": 1}},
        upsert=True, return_document=True,
    )
    return doc["sequence_value"]


def next_ticket_number() -> str:
    year = datetime.now(timezone.utc).year
    seq = _seq(f"ticket_{year}")
    return f"TKT-{year}-{seq:04d}"


def next_device_id() -> str:
    year = datetime.now(timezone.utc).year
    seq = _seq(f"device_{year}")
    return f"DEV-{year}-{seq:04d}"


def next_company_code() -> str:
    seq = _seq("company")
    return f"CMP-{seq:04d}"


# ---------- Models ----------
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class OTPVerifyRequest(BaseModel):
    email: EmailStr
    otp: str
    challenge_id: str


class EngineerCreate(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    password: str
    skills: List[str] = []
    employee_id: Optional[str] = None
    designation: Optional[str] = None
    address: Optional[str] = None


class EngineerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    skills: Optional[List[str]] = None
    is_active: Optional[bool] = None
    is_available: Optional[bool] = None
    password: Optional[str] = None
    employee_id: Optional[str] = None
    designation: Optional[str] = None
    address: Optional[str] = None


class CompanyCreate(BaseModel):
    company_name: str
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    client_email: Optional[EmailStr] = None
    address: Optional[str] = None
    gst_number: Optional[str] = None
    product_ref_number: Optional[str] = None
    oem_ref_number: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None


class CompanyUpdate(BaseModel):
    company_name: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    client_email: Optional[EmailStr] = None
    address: Optional[str] = None
    gst_number: Optional[str] = None
    product_ref_number: Optional[str] = None
    oem_ref_number: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    status: Optional[Literal["active", "inactive"]] = None


class DeviceCreate(BaseModel):
    brand: str
    model: str
    serial_number: Optional[str] = None
    device_name: Optional[str] = None
    device_type: Optional[str] = None
    warranty_status: Literal["active", "expired", "none"] = "none"
    warranty_expiry: Optional[str] = None
    purchase_date: Optional[str] = None
    notes: Optional[str] = None


class TicketCreate(BaseModel):
    company_id: str
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_email: EmailStr
    contact_source: Literal["call", "whatsapp", "email"] = "call"
    issue_description: str
    priority: Literal["low", "medium", "high", "critical"] = "medium"
    product_reference_number: Optional[str] = None
    oem_reference_number: Optional[str] = None
    device: DeviceCreate


class TicketAssign(BaseModel):
    engineer_id: str


class StatusUpdate(BaseModel):
    status: Literal[
        "accepted", "travelling", "reached_site", "in_progress",
        "resolved", "completed_with_signature", "report_generated",
        "closed", "rejected",
    ]
    note: Optional[str] = None
    reject_reason: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class LocationUpdate(BaseModel):
    latitude: float
    longitude: float


class PartItem(BaseModel):
    name: str
    part_number: Optional[str] = None
    quantity: int = 1


class ReportSubmit(BaseModel):
    engineer_notes: str
    resolution_summary: Optional[str] = None
    parts_used: List[PartItem] = []
    before_images: List[str] = []
    after_images: List[str] = []
    customer_signature: str
    customer_signed_name: Optional[str] = None


class AttendanceAction(BaseModel):
    latitude: Optional[float] = None
    longitude: Optional[float] = None


# ---------- Startup ----------
@app.on_event("startup")
async def startup():
    # ---- Migrations: backfill new fields on existing docs ----
    db.tickets.update_many(
        {"ticket_no": {"$exists": False}, "ticket_number": {"$exists": True}},
        [{"$set": {"ticket_no": "$ticket_number"}}],
    )
    db.tickets.update_many(
        {"issue_description": {"$exists": False}, "problem_description": {"$exists": True}},
        [{"$set": {"issue_description": "$problem_description"}}],
    )

    # Drop legacy indexes that conflict
    try:
        db.tickets.drop_index("ticket_number_1")
    except Exception:
        pass
    try:
        db.devices.drop_index("serial_number_1")
    except Exception:
        pass

    # Sync counters with existing data
    year = datetime.now(timezone.utc).year

    last_device = db.devices.find_one(
        {"device_id": {"$regex": f"^DEV-{year}-"}},
        sort=[("device_id", -1)]
    )

    if last_device:
        try:
            seq = int(last_device["device_id"].split("-")[-1])
            db.counters.update_one(
                {"_id": f"device_{year}"},
                {"$max": {"sequence_value": seq}},
                upsert=True,
            )
        except Exception:
            pass

    last_ticket = db.tickets.find_one(
        {"ticket_no": {"$regex": f"^TKT-{year}-"}},
        sort=[("ticket_no", -1)]
    )

    if last_ticket:
        try:
            seq = int(last_ticket["ticket_no"].split("-")[-1])
            db.counters.update_one(
                {"_id": f"ticket_{year}"},
                {"$max": {"sequence_value": seq}},
                upsert=True,
            )
        except Exception:
            pass

    # Indexes
    #db.devices.create_index("warranty_expiry")
    #db.ticket_status_logs.create_index([("timestamp", -1)])
    db.users.create_index("role")
    db.users.create_index("email", unique=True)
    db.users.create_index("id", unique=True)
    db.users.create_index("employee_id", sparse=True)
    db.companies.create_index("company_name", unique=True)
    db.companies.create_index("company_code", unique=True)
    db.companies.create_index("status")
    db.tickets.create_index("ticket_no", unique=True, sparse=True)
    db.tickets.create_index("status")
    db.tickets.create_index("assigned_engineer_id")
    db.tickets.create_index("company_id")
    db.devices.create_index("warranty_expiry")
    db.devices.create_index("device_id", unique=True)
    db.devices.create_index("serial_number", sparse=True)
    db.devices.create_index("company_id")
    db.ticket_status_logs.create_index("ticket_id")
    db.ticket_status_logs.create_index([("timestamp", -1)])
    db.service_reports.create_index("ticket_id", unique=True)
    db.attachments.create_index("ticket_id")
    db.notifications.create_index("user_id")
    db.otp_challenges.create_index("expires_at", expireAfterSeconds=0)

    # Seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@plutusventures.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")

    existing = db.users.find_one({"email": admin_email})

    if not existing:
        db.users.insert_one({
            "id": new_id(),
            "email": admin_email,
            "name": "Administrator",
            "role": "admin",
            "password_hash": hash_password(admin_password),
            "is_active": True,
            "is_available": True,
            "status": "active",
            "designation": "System Admin",
            "created_at": now_iso(),
            "updated_at": now_iso(),
        })
        logger.info(f"Seeded admin: {admin_email}")
    else:
        if not verify_password(admin_password, existing["password_hash"]):
            db.users.update_one(
                {"email": admin_email},
                {
                    "$set": {
                        "password_hash": hash_password(admin_password),
                        "updated_at": now_iso()
                    }
                }
            )

    # Also keep legacy admin@serviceops.com if it exists
    legacy = db.users.find_one({"email": "admin@serviceops.com"})
    if not legacy:
        db.users.insert_one({
            "id": new_id(),
            "email": "admin@serviceops.com",
            "name": "Admin (legacy)",
            "role": "admin",
            "password_hash": hash_password("admin123"),
            "is_active": True,
            "is_available": True,
            "status": "active",
            "created_at": now_iso(),
            "updated_at": now_iso(),
        })

    # Seed engineer
    eng_email = "engineer@plutusventures.com"
    if not db.users.find_one({"email": eng_email}):
        db.users.insert_one({
            "id": new_id(),
            "email": eng_email,
            "name": "Rajiv Kumar",
            "role": "engineer",
            "phone": "+91 98765 43210",
            "password_hash": hash_password("engineer123"),
            "skills": ["Laptop Repair", "Networking", "Printer"],
            "employee_id": "EMP-001",
            "designation": "Senior Field Engineer",
            "is_active": True,
            "is_available": True,
            "status": "active",
            "created_at": now_iso(),
            "updated_at": now_iso(),
        })

    # Legacy engineer
    legacy_eng = db.users.find_one({"email": "engineer@serviceops.com"})
    if not legacy_eng:
        db.users.insert_one({
            "id": new_id(),
            "email": "engineer@serviceops.com",
            "name": "Field Engineer (legacy)",
            "role": "engineer",
            "phone": "+91 90000 00000",
            "password_hash": hash_password("engineer123"),
            "skills": ["Laptop Repair"],
            "employee_id": "EMP-LEG",
            "is_active": True,
            "is_available": True,
            "status": "active",
            "created_at": now_iso(),
            "updated_at": now_iso(),
        })

    # Init local filesystem storage
    init_storage()

    # Write test credentials
    from pathlib import Path

    try:
        BASE_DIR = Path(__file__).resolve().parent
        memory_dir = BASE_DIR / "memory"
        memory_dir.mkdir(parents=True, exist_ok=True)

        (memory_dir / "test_credentials.md").write_text(
            "# Test Credentials\n\n"
            "## Admin (primary)\n"
            f"- Email: `{admin_email}`\n"
            f"- Password: `{admin_password}`\n\n"
            "## Admin (legacy)\n"
            "- Email: `admin@serviceops.com` / Password: `admin123`\n\n"
            "## Engineer (primary)\n"
            f"- Email: `{eng_email}` / Password: `engineer123`\n\n"
            "## Engineer (legacy)\n"
            "- Email: `engineer@serviceops.com` / Password: `engineer123`\n\n"
            "## Login flow\n"
            "1. POST /api/auth/login -> returns `challenge_id` and `dev_otp`\n"
            "2. POST /api/auth/verify-otp -> returns JWT `token`\n"
            "3. Use `Authorization: Bearer <token>` for all subsequent calls\n"
        )

    except Exception as e:
        logger.error(f"Error writing test credentials: {e}")
     



@app.on_event("shutdown")
async def shutdown():
    client.close()


# ---------- AUTH ----------
@api.post("/auth/login")
@limiter.limit("10/minute")
async def login(request: Request, payload: LoginRequest):
    email = payload.email.lower().strip()
    user = db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account disabled")

    # Update last login
    db.users.update_one({"email": email}, {"$set": {"last_login": now_iso()}})

    token = create_access_token(
        user.get("id") or str(user["_id"]),
        user["email"],
        user.get("role", "admin"),
    )
    return {
        "token": token,
        "user": {
            "id": user.get("id") or str(user["_id"]),
            "name": user.get("name", ""),
            "email": user["email"],
            "role": user.get("role", "admin"),
        },
    }
@api.post("/auth/verify-otp")
@limiter.limit("20/minute")
async def verify_otp(request: Request, payload: OTPVerifyRequest):
    try:
        email = payload.email.lower().strip()

        #  Fetch challenge
        challenge = db.otp_challenges.find_one({
            "id": payload.challenge_id,
            "email": email,
            "consumed": False,
        })

        if not challenge:
            raise HTTPException(status_code=400, detail="Invalid challenge")

        #  OTP match
        if str(challenge.get("otp")) != payload.otp.strip():
            raise HTTPException(status_code=400, detail="Incorrect OTP")
        
        #EXPIRY CHECK (SAFE)
        expires_at = challenge.get("expires_at")
        from datetime import timezone
        if expires_at:
            if expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
                raise HTTPException(status_code=400, detail="OTP expired")

        

        # #  Expiry check (SAFE)
        # from datetime import timezone

        # if expires_at:
        #     if expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        #         raise HTTPException(status_code=400, detail="OTP expired")
            

        #  Mark consumed
        db.otp_challenges.update_one(
            {"id": payload.challenge_id},
            {"$set": {"consumed": True}}
        )

        # Fetch full user
        user = db.users.find_one({"email": email})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        #  Update last login
        db.users.update_one(
            {"email": email},
            {"$set": {"last_login": now_iso()}}
        )

        #  Create token (SAFE format)
        token = create_access_token(
            str(user["_id"]),
            user["email"],
            user.get("role", "admin")
        )

        return {
            "token": token,
            "user": {
                "email": user["email"],
                "role": user.get("role", "admin")
            }
        }

    except Exception as e:
        print("VERIFY OTP ERROR:", str(e))  # 👈 VERY IMPORTANT
        raise HTTPException(status_code=500, detail="Internal error")
# @api.post("/auth/verify-otp")
# @limiter.limit("20/minute")
# async def verify_otp(request: Request, payload: OTPVerifyRequest):
#     email = payload.email.lower().strip()

#     challenge = db.otp_challenges.find_one({
#         "id": payload.challenge_id,
#         "email": email,
#         "consumed": False,
#     })

#     if not challenge:
#         raise HTTPException(status_code=400, detail="Invalid challenge")

#     expires_at = challenge.get("expires_at")
#     if not expires_at:
#         raise HTTPException(status_code=400, detail="Invalid OTP data")

#     if expires_at < datetime.now(timezone.utc):
#         raise HTTPException(status_code=400, detail="OTP expired")

#     if challenge["otp"] != payload.otp.strip():
#         raise HTTPException(status_code=400, detail="Incorrect OTP")

#     db.otp_challenges.update_one(
#         {"id": payload.challenge_id},
#         {"$set": {"consumed": True}}
#     )

#     user_full = db.users.find_one({"email": email})

#     if not user_full:
#         raise HTTPException(status_code=404, detail="User not found")

#     db.users.update_one(
#         {"email": email},
#         {"$set": {"last_login": now_iso()}}
#     )

#     # SAFE TOKEN CREATION
#     token = create_access_token({
#         "sub": str(user_full["_id"]),
#         "email": user_full["email"],
#         "role": user_full.get("role", "admin")
#     })

#     return {
#         "token": token,
#         "user": {
#             "email": user_full["email"],
#             "role": user_full.get("role", "admin")
#         }
#     }
# @api.post("/auth/verify-otp")
# @limiter.limit("20/minute")
# async def verify_otp(request: Request, payload: OTPVerifyRequest):
#     email = payload.email.lower().strip()

#     challenge = db.otp_challenges.find_one({
#         "id": payload.challenge_id,
#         "email": email,
#         "consumed": False,
#     })

#     if not challenge:
#         raise HTTPException(status_code=400, detail="Invalid challenge")

#     if challenge["expires_at"].replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
#         raise HTTPException(status_code=400, detail="OTP expired")

#     if challenge["otp"] != payload.otp.strip():
#         raise HTTPException(status_code=400, detail="Incorrect OTP")

#     db.otp_challenges.update_one(
#         {"id": payload.challenge_id},
#         {"$set": {"consumed": True}}
#     )

#     user_full = db.users.find_one({"email": email})

#     if not user_full:
#         raise HTTPException(status_code=404, detail="User not found")

#     db.users.update_one(
#         {"email": email},
#         {"$set": {"last_login": now_iso()}}
#     )

#     token = create_access_token(
#         str(user_full["_id"]),
#         user_full["email"],
#         user_full.get("role", "admin")
#     )

#     return {
#         "token": token,
#         "user": {
#             "email": user_full["email"],
#             "role": user_full.get("role", "admin")
#         }
#     }


@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return user


@api.post("/auth/logout")
async def logout(user=Depends(get_current_user)):
    return {"ok": True}


# ---------- ENGINEERS ----------
@api.get("/engineers")
async def list_engineers(available_only: bool = False,
                         user=Depends(get_current_user)):
    q = {"role": "engineer"}
    if available_only:
        q["is_active"] = True
        q["is_available"] = True
    engs = list(db.users.find(q, {"_id": 0, "password_hash": 0}))
    for e in engs:
        e["active_tickets"] = db.tickets.count_documents({
            "assigned_engineer_id": e["id"],
            "status": {"$nin": ["closed", "rejected", "report_generated"]},
        })
    return engs


@api.post("/engineers", dependencies=[Depends(require_admin)])
async def create_engineer(payload: EngineerCreate):
    email = payload.email.lower().strip()
    if db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already exists")
    doc = {
        "id": new_id(),
        "email": email,
        "name": payload.name,
        "role": "engineer",
        "phone": payload.phone,
        "skills": payload.skills,
        "employee_id": payload.employee_id,
        "designation": payload.designation,
        "address": payload.address,
        "password_hash": hash_password(payload.password),
        "is_active": True,
        "is_available": True,
        "status": "active",
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    db.users.insert_one(doc)
    return clean({**doc})


@api.patch("/engineers/{eng_id}", dependencies=[Depends(require_admin)])
async def update_engineer(eng_id: str, payload: EngineerUpdate):
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if "password" in updates:
        updates["password_hash"] = hash_password(updates.pop("password"))
    updates["updated_at"] = now_iso()
    if not updates:
        raise HTTPException(status_code=400, detail="No changes")
    res = db.users.update_one({"id": eng_id, "role": "engineer"},
                               {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Engineer not found")
    return db.users.find_one({"id": eng_id}, {"_id": 0, "password_hash": 0})


@api.delete("/engineers/{eng_id}", dependencies=[Depends(require_admin)])
async def delete_engineer(eng_id: str):
    res = db.users.delete_one({"id": eng_id, "role": "engineer"})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Engineer not found")
    return {"ok": True}


# ---------- COMPANIES ----------
@api.get("/companies")
async def list_companies(
    q: Optional[str] = None,
    status: Optional[Literal["active", "inactive"]] = None,
    page: int = 1, page_size: int = 50,
    user=Depends(get_current_user),
):
    query: Dict[str, Any] = {}
    if status:
        query["status"] = status
    if q:
        query["$or"] = [
            {"company_name": {"$regex": q, "$options": "i"}},
            {"company_code": {"$regex": q, "$options": "i"}},
            {"contact_person": {"$regex": q, "$options": "i"}},
            {"gst_number": {"$regex": q, "$options": "i"}},
            {"city": {"$regex": q, "$options": "i"}},
        ]
    total = db.companies.count_documents(query)
    skip = max(0, (page - 1)) * page_size
    items = list(db.companies.find(query, {"_id": 0})
                 .sort("created_at", -1).skip(skip).limit(page_size))
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@api.get("/companies/{company_id}")
async def get_company(company_id: str, user=Depends(get_current_user)):
    c = db.companies.find_one({"id": company_id}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Company not found")
    tickets = list(db.tickets.find(
        {"company_id": company_id}, {"_id": 0}
    ).sort("created_at", -1).limit(20))
    devices = list(db.devices.find(
        {"company_id": company_id}, {"_id": 0}
    ).sort("created_at", -1).limit(50))
    return {"company": c, "tickets": tickets, "devices": devices}


@api.post("/companies", dependencies=[Depends(require_admin)])
async def create_company(payload: CompanyCreate, admin=Depends(require_admin)):
    name = payload.company_name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Company name required")
    if db.companies.find_one({"company_name": {"$regex": f"^{name}$", "$options": "i"}}):
        raise HTTPException(status_code=400, detail="Company name already exists")
    doc = {
        "id": new_id(),
        "company_name": name,
        "company_code": next_company_code(),
        "contact_person": payload.contact_person,
        "phone": payload.phone,
        "email": payload.email,
        "address": payload.address,
        "gst_number": payload.gst_number,
        "product_ref_number": payload.product_ref_number,
        "oem_ref_number": payload.oem_ref_number,
        "client_email": payload.client_email,
        "city": payload.city,
        "state": payload.state,
        "pincode": payload.pincode,
        "status": "active",
        "created_by": admin["id"],
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    db.companies.insert_one(doc)
    return clean({**doc})


@api.put("/companies/{company_id}", dependencies=[Depends(require_admin)])
async def update_company(company_id: str, payload: CompanyUpdate):
    existing = db.companies.find_one({"id": company_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Company not found")
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if "company_name" in updates:
        new_name = updates["company_name"].strip()
        if not new_name:
            raise HTTPException(status_code=400, detail="Company name required")
        dup = db.companies.find_one({
            "company_name": {"$regex": f"^{new_name}$", "$options": "i"},
            "id": {"$ne": company_id},
        })
        if dup:
            raise HTTPException(status_code=400, detail="Company name already exists")
        updates["company_name"] = new_name
    updates["updated_at"] = now_iso()
    db.companies.update_one({"id": company_id}, {"$set": updates})
    if "company_name" in updates:
        db.tickets.update_many({"company_id": company_id},
                               {"$set": {"company_name": updates["company_name"]}})
        db.devices.update_many({"company_id": company_id},
                               {"$set": {"company_name": updates["company_name"]}})
    return db.companies.find_one({"id": company_id}, {"_id": 0})


@api.delete("/companies/{company_id}", dependencies=[Depends(require_admin)])
async def delete_company(company_id: str):
    open_tix = db.tickets.count_documents({
        "company_id": company_id,
        "status": {"$nin": ["closed", "rejected"]},
    })
    if open_tix > 0:
        raise HTTPException(status_code=400,
                            detail=f"Cannot delete: {open_tix} active tickets")
    res = db.companies.delete_one({"id": company_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Company not found")
    return {"ok": True}


# ---------- DEVICES ----------
@api.get("/devices")
async def list_devices(q: Optional[str] = None,
                       company_id: Optional[str] = None,
                       user=Depends(get_current_user)):
    query: Dict[str, Any] = {}
    if company_id:
        query["company_id"] = company_id
    if q:
        query["$or"] = [
            {"serial_number": {"$regex": q, "$options": "i"}},
            {"device_id": {"$regex": q, "$options": "i"}},
            {"brand": {"$regex": q, "$options": "i"}},
            {"model": {"$regex": q, "$options": "i"}},
            {"device_name": {"$regex": q, "$options": "i"}},
        ]
    devices = list(db.devices.find(query, {"_id": 0}).sort("created_at", -1))
    return devices


@api.get("/devices/history-export")
async def export_device_history(
    company_id: Optional[str] = None,
    month_from: Optional[str] = None,
    month_to: Optional[str] = None,
    user=Depends(get_current_user)
):
    """Export device service history as Excel."""
    import io
    try:
        import openpyxl
        from openpyxl.styles import Font, PatternFill, Alignment
    except ImportError:
        raise HTTPException(status_code=500, detail="openpyxl not installed")

    ticket_filter = {}
    if company_id:
        ticket_filter["company_id"] = company_id
    if month_from:
        ticket_filter["created_at"] = {"$gte": month_from + "-01"}
    if month_to:
        import calendar
        y, m = int(month_to[:4]), int(month_to[5:7])
        last_day = calendar.monthrange(y, m)[1]
        ticket_filter.setdefault("created_at", {})["$lte"] = f"{month_to}-{last_day}"

    tickets = list(db.tickets.find(ticket_filter, {"_id": 0}).sort("created_at", -1).limit(1000))
    device_ids = list({t.get("device_id") for t in tickets if t.get("device_id")})
    devices_map = {d["device_id"]: d for d in db.devices.find({"device_id": {"$in": device_ids}}, {"_id": 0})}
    companies_map = {c["id"]: c for c in db.companies.find({}, {"_id": 0, "id": 1, "company_name": 1})}
    engineers_map = {e["id"]: e["name"] for e in db.users.find({"role": "engineer"}, {"_id": 0, "id": 1, "name": 1})}

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Device History"

    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill("solid", fgColor="0A1128")
    headers = ["Ticket No", "Device ID", "Brand", "Model", "Serial No",
               "Company", "Engineer", "Status", "Issue", "Created At", "Completed At"]
    for col, h in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=h)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center")

    for row, t in enumerate(tickets, 2):
        dev = devices_map.get(t.get("device_id"), {})
        ws.cell(row=row, column=1, value=t.get("ticket_no") or t.get("ticket_number"))
        ws.cell(row=row, column=2, value=t.get("device_id"))
        ws.cell(row=row, column=3, value=dev.get("brand"))
        ws.cell(row=row, column=4, value=dev.get("model"))
        ws.cell(row=row, column=5, value=dev.get("serial_number"))
        ws.cell(row=row, column=6, value=companies_map.get(t.get("company_id"), {}).get("company_name"))
        ws.cell(row=row, column=7, value=engineers_map.get(t.get("assigned_engineer_id")))
        ws.cell(row=row, column=8, value=t.get("status"))
        ws.cell(row=row, column=9, value=t.get("issue_description") or t.get("problem_description"))
        ws.cell(row=row, column=10, value=(t.get("created_at") or "")[:16].replace("T", " "))
        ws.cell(row=row, column=11, value=(t.get("completed_at") or "")[:16].replace("T", " "))

    for col in ws.columns:
        ws.column_dimensions[col[0].column_letter].width = 18

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    from fastapi.responses import StreamingResponse
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=device_history.xlsx"}
    )


# ---------- DEVICE HISTORY (Feature 3) ----------
def _build_device_history_query(company: Optional[str], start_date: Optional[str],
                                end_date: Optional[str],
                                include_deleted: bool = False,
                                only_deleted: bool = False) -> Dict[str, Any]:
    """Build the MongoDB query for device-history listings.

    company: company name (case-insensitive partial match)
    start_date / end_date: YYYY-MM-DD inclusive (matched against ticket.created_at ISO string).
    include_deleted: if True, return both active and soft-deleted records.
    only_deleted: if True, return only soft-deleted records.
    Default (include_deleted=False, only_deleted=False) excludes soft-deleted records.
    """
    q: Dict[str, Any] = {}
    if only_deleted:
        q["is_deleted"] = True
    elif not include_deleted:
        q["is_deleted"] = {"$ne": True}
    if company:
        company_doc_ids = [
            c["id"] for c in db.companies.find(
                {"company_name": {"$regex": company, "$options": "i"}},
                {"_id": 0, "id": 1},
            )
        ]
        # Match either company_id (preferred) or denormalised company_name on ticket.
        q["$or"] = [
            {"company_id": {"$in": company_doc_ids}} if company_doc_ids else {"_no_match_": True},
            {"company_name": {"$regex": company, "$options": "i"}},
        ]
    if start_date:
        q.setdefault("created_at", {})["$gte"] = start_date
    if end_date:
        # Inclusive upper bound up to end of day.
        q.setdefault("created_at", {})["$lte"] = f"{end_date}T23:59:59"
    return q


def _enrich_history_rows(tickets: List[dict]) -> List[dict]:
    """Attach device_id, company_name, engineer_name, dates, reference numbers to ticket rows."""
    device_ids = list({t.get("device_id") for t in tickets if t.get("device_id")})
    devices_map = {
        d["device_id"]: d for d in db.devices.find(
            {"device_id": {"$in": device_ids}}, {"_id": 0}
        )
    } if device_ids else {}
    company_ids = list({t.get("company_id") for t in tickets if t.get("company_id")})
    companies_map = {
        c["id"]: c for c in db.companies.find(
            {"id": {"$in": company_ids}}, {"_id": 0}
        )
    } if company_ids else {}
    eng_ids = list({t.get("assigned_engineer_id") for t in tickets if t.get("assigned_engineer_id")})
    engineers_map = {
        e["id"]: e for e in db.users.find(
            {"id": {"$in": eng_ids}, "role": "engineer"},
            {"_id": 0, "id": 1, "name": 1},
        )
    } if eng_ids else {}

    rows = []
    for t in tickets:
        dev = devices_map.get(t.get("device_id"), {})
        comp = companies_map.get(t.get("company_id"), {})
        eng = engineers_map.get(t.get("assigned_engineer_id"), {})
        rows.append({
            "id": t.get("id"),
            "device_id": t.get("device_id"),
            "ticket_id": t.get("ticket_no") or t.get("ticket_number") or t.get("id"),
            "company_name": comp.get("company_name") or t.get("company_name"),
            "engineer_name": eng.get("name") or t.get("assigned_engineer_name"),
            "status": t.get("status"),
            "created_date": (t.get("created_at") or "")[:19].replace("T", " "),
            "closed_date": (
                (t.get("approved_at") or t.get("completed_at") or "")[:19].replace("T", " ")
                if t.get("status") == "closed" else ""
            ),
            "product_reference_number": (
                t.get("product_reference_number")
                or comp.get("product_ref_number")
                or dev.get("product_reference_number")
            ),
            "oem_reference_number": (
                t.get("oem_reference_number")
                or comp.get("oem_ref_number")
                or dev.get("oem_reference_number")
            ),
            "is_deleted": bool(t.get("is_deleted", False)),
        })
    return rows


@api.get("/device-history")
async def list_device_history(
    company: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    include_deleted: bool = False,
    only_deleted: bool = False,
    user=Depends(require_sub_admin),
):
    """List device service history with optional company / date-range filters.

    Soft-deleted records are excluded by default.
    Pass include_deleted=true to surface both, or only_deleted=true to surface
    only soft-deleted records (used by the restore UI).
    """
    q = _build_device_history_query(company, start_date, end_date,
                                    include_deleted=include_deleted,
                                    only_deleted=only_deleted)
    tickets = list(db.tickets.find(q, {"_id": 0}).sort("created_at", -1).limit(2000))
    return {"items": _enrich_history_rows(tickets), "total": len(tickets)}


@api.get("/device-history/filter")
async def filter_device_history(
    company: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    include_deleted: bool = False,
    only_deleted: bool = False,
    user=Depends(require_sub_admin),
):
    """Filter device history by company and date range (admin / sub_admin)."""
    q = _build_device_history_query(company, start_date, end_date,
                                    include_deleted=include_deleted,
                                    only_deleted=only_deleted)
    tickets = list(db.tickets.find(q, {"_id": 0}).sort("created_at", -1).limit(2000))
    return {"items": _enrich_history_rows(tickets), "total": len(tickets)}


@api.get("/device-history/export")
async def export_device_history_v2(
    company: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user=Depends(require_sub_admin),
):
    """Export filtered device history to Excel (.xlsx).

    Columns: Device ID, Ticket ID, Company Name, Engineer Name, Status,
    Created Date, Closed Date, Product Reference Number, OEM Reference Number.
    """
    import io
    try:
        import openpyxl
        from openpyxl.styles import Font, PatternFill, Alignment
    except ImportError:
        raise HTTPException(status_code=500, detail="openpyxl not installed")

    q = _build_device_history_query(company, start_date, end_date)
    tickets = list(db.tickets.find(q, {"_id": 0}).sort("created_at", -1).limit(5000))
    rows = _enrich_history_rows(tickets)

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Device History"
    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill("solid", fgColor="0A1128")
    headers = [
        "Device ID", "Ticket ID", "Company Name", "Engineer Name", "Status",
        "Created Date", "Closed Date",
        "Product Reference Number", "OEM Reference Number",
    ]
    for col, h in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=h)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center")

    for ridx, r in enumerate(rows, 2):
        ws.cell(row=ridx, column=1, value=r.get("device_id"))
        ws.cell(row=ridx, column=2, value=r.get("ticket_id"))
        ws.cell(row=ridx, column=3, value=r.get("company_name"))
        ws.cell(row=ridx, column=4, value=r.get("engineer_name"))
        ws.cell(row=ridx, column=5, value=r.get("status"))
        ws.cell(row=ridx, column=6, value=r.get("created_date"))
        ws.cell(row=ridx, column=7, value=r.get("closed_date"))
        ws.cell(row=ridx, column=8, value=r.get("product_reference_number"))
        ws.cell(row=ridx, column=9, value=r.get("oem_reference_number"))

    for col in ws.columns:
        ws.column_dimensions[col[0].column_letter].width = 22

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)

    def _slug(s: Optional[str]) -> str:
        if not s:
            return "all"
        # Preserve ISO date format (YYYY-MM-DD) for date params.
        import re
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", s):
            return s
        return "".join(ch if ch.isalnum() else "_" for ch in s).strip("_") or "all"

    filename = (
        f"device_history_{_slug(company)}_"
        f"{_slug(start_date)}_{_slug(end_date)}.xlsx"
    )

    from fastapi.responses import StreamingResponse
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@api.delete("/device-history/{ticket_id}")
async def soft_delete_device_history(ticket_id: str, user=Depends(require_sub_admin)):
    """Soft-delete a device-history entry (ticket).

    Sets is_deleted=true so the record is hidden from device-history listings
    and exports. Active (open) tickets cannot be deleted to avoid impacting
    ongoing work; only completed / closed / rejected tickets are eligible.
    """
    ticket = db.tickets.find_one({"id": ticket_id})
    if not ticket:
        # Allow lookup by ticket_no as fallback
        ticket = db.tickets.find_one({"ticket_no": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Device history record not found")

    if ticket.get("status") not in (
        "closed", "rejected", "report_generated", "completed_with_signature"
    ):
        raise HTTPException(
            status_code=400,
            detail="Only completed or closed tickets can be deleted from device history",
        )

    db.tickets.update_one(
        {"id": ticket["id"]},
        {"$set": {
            "is_deleted": True,
            "deleted_at": now_iso(),
            "deleted_by": user["id"],
            "updated_at": now_iso(),
        }},
    )
    return {"ok": True, "ticket_id": ticket["id"], "is_deleted": True}


@api.post("/device-history/{ticket_id}/restore")
async def restore_device_history(ticket_id: str, user=Depends(require_sub_admin)):
    """Restore a soft-deleted device-history entry."""
    ticket = db.tickets.find_one({"id": ticket_id}) or db.tickets.find_one({"ticket_no": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Device history record not found")
    db.tickets.update_one(
        {"id": ticket["id"]},
        {"$set": {"is_deleted": False, "updated_at": now_iso()},
         "$unset": {"deleted_at": "", "deleted_by": ""}},
    )
    return {"ok": True, "ticket_id": ticket["id"], "is_deleted": False}


@api.get("/devices/{device_id}")
async def get_device(device_id: str, user=Depends(get_current_user)):
    device = db.devices.find_one({"device_id": device_id}, {"_id": 0})
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    tickets = list(db.tickets.find(
        {"device_id": device_id}, {"_id": 0}
    ).sort("created_at", -1).limit(100))
    for t in tickets:
        if t.get("assigned_engineer_id"):
            eng = db.users.find_one(
                {"id": t["assigned_engineer_id"]}, {"_id": 0, "name": 1}
            )
            t["engineer_name"] = eng["name"] if eng else None
    return {"device": device, "history": tickets}


# ---------- TICKETS ----------
def _get_or_create_device(company: dict, d: DeviceCreate) -> dict:
    serial = (d.serial_number or "").strip() or None
    existing = None
    if serial:
        existing = db.devices.find_one({"serial_number": serial,
                                        "company_id": company["id"]})
    if existing:
        updates = {}
        if d.warranty_status != existing.get("warranty_status"):
            updates["warranty_status"] = d.warranty_status
        if d.warranty_expiry and d.warranty_expiry != existing.get("warranty_expiry"):
            updates["warranty_expiry"] = d.warranty_expiry
        if updates:
            updates["updated_at"] = now_iso()
            db.devices.update_one({"device_id": existing["device_id"]},
                                  {"$set": updates})
            existing.update(updates)
        existing.pop("_id", None)
        return existing
    dev_id = next_device_id()
    doc = {
        "id": new_id(),
        "device_id": dev_id,
        "company_id": company["id"],
        "company_name": company["company_name"],
        "serial_number": serial,
        "brand": d.brand,
        "model": d.model,
        "device_name": d.device_name or f"{d.brand} {d.model}",
        "device_type": d.device_type,
        "warranty_status": d.warranty_status,
        "warranty_expiry": d.warranty_expiry,
        "purchase_date": d.purchase_date,
        "notes": d.notes,
        "is_deleted": False,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    db.devices.insert_one(doc)
    doc.pop("_id", None)
    return doc


def _log_status(ticket_id: str, actor: dict, old_status: Optional[str],
                new_status: str, remarks: Optional[str] = None):
    db.ticket_status_logs.insert_one({
        "id": new_id(),
        "ticket_id": ticket_id,
        "old_status": old_status,
        "new_status": new_status,
        "changed_by": actor["id"],
        "changed_by_name": actor.get("name"),
        "changed_by_role": actor.get("role"),
        "remarks": remarks,
        "timestamp": now_iso(),
    })


def _ticket_full(ticket: dict) -> dict:
    if not ticket:
        return ticket
    ticket = clean(ticket)
    if ticket.get("device_id"):
        device = db.devices.find_one({"device_id": ticket["device_id"]},
                                     {"_id": 0})
        ticket["device"] = device
    if ticket.get("company_id"):
        company = db.companies.find_one({"id": ticket["company_id"]},
                                        {"_id": 0})
        ticket["company"] = company
    if ticket.get("assigned_engineer_id"):
        eng = db.users.find_one({"id": ticket["assigned_engineer_id"]},
                                {"_id": 0, "password_hash": 0})
        ticket["engineer"] = eng
    return ticket


@api.post("/tickets", dependencies=[Depends(require_admin)])
async def create_ticket(payload: TicketCreate, admin=Depends(require_admin)):
    company = db.companies.find_one({"id": payload.company_id})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    if company.get("status") == "inactive":
        raise HTTPException(status_code=400, detail="Company is inactive")

    device = _get_or_create_device(company, payload.device)
    ticket_no = next_ticket_number()
    ticket = {
        "id": new_id(),
        "ticket_no": ticket_no,
        "ticket_number": ticket_no,
        "company_id": company["id"],
        "company_name": company["company_name"],
        "customer_name": payload.customer_name or company.get("contact_person"),
        "customer_phone": payload.customer_phone or company.get("phone"),
        "customer_email": payload.customer_email,
        "customer_company": company["company_name"],
        "customer_address": company.get("address"),
        "contact_source": payload.contact_source,
        "issue_description": payload.issue_description,
        "problem_description": payload.issue_description,
        "priority": payload.priority,
        "product_reference_number": (payload.product_reference_number or None),
        "oem_reference_number": (payload.oem_reference_number or None),
        "device_id": device["device_id"],
        "device_name": device.get("device_name"),
        "serial_number": device.get("serial_number"),
        "status": "open",
        "assigned_engineer_id": None,
        "assigned_engineer_name": None,
        "engineer_notes": None,
        "admin_notes": None,
        "created_by": admin["id"],
        "created_at": now_iso(),
        "updated_at": now_iso(),
        "completed_at": None,
        "engineer_location": None,
        "approved": False,
        "approved_at": None,
        "is_deleted": False,
        "report_id": None,
        "pdf_path": None,
    }
    db.tickets.insert_one(ticket)
    _log_status(ticket["id"], admin, None, "open",
                f"Ticket {ticket_no} created for {company['company_name']}")
    return _ticket_full(ticket)


@api.get("/tickets")
async def list_tickets(
    status: Optional[str] = None,
    company_id: Optional[str] = None,
    mine: bool = False,
    user=Depends(get_current_user),
):
    q: Dict[str, Any] = {"is_deleted": {"$ne": True}}
    if status:
        q["status"] = status
    if company_id:
        q["company_id"] = company_id
    if user["role"] == "engineer" or mine:
        q["assigned_engineer_id"] = user["id"]
    tickets = list(db.tickets.find(q, {"_id": 0}).sort("created_at", -1).limit(500))
    for t in tickets:
        if t.get("device_id"):
            device = db.devices.find_one(
                {"device_id": t["device_id"]},
                {"_id": 0, "brand": 1, "model": 1, "device_id": 1,
                 "warranty_status": 1, "device_name": 1}
            )
            t["device"] = device
        if t.get("assigned_engineer_id"):
            eng = db.users.find_one(
                {"id": t["assigned_engineer_id"]},
                {"_id": 0, "name": 1, "id": 1}
            )
            t["engineer"] = eng
    return tickets


@api.get("/tickets/{ticket_id}")
async def get_ticket(ticket_id: str, user=Depends(get_current_user)):
    ticket = db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if user["role"] == "engineer" and ticket.get("assigned_engineer_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Not your ticket")
    full = _ticket_full(ticket)
    full["status_logs"] = list(db.ticket_status_logs.find(
        {"ticket_id": ticket_id}, {"_id": 0}
    ).sort("timestamp", -1).limit(200))
    full["activity"] = [
        {"id": s["id"], "ticket_id": s["ticket_id"],
         "action": f"status_{s['new_status']}",
         "actor_id": s.get("changed_by"),
         "actor_name": s.get("changed_by_name"),
         "actor_role": s.get("changed_by_role"),
         "details": s.get("remarks"),
         "timestamp": s["timestamp"]}
        for s in full["status_logs"]
    ]
    if full.get("report_id"):
        rep = db.service_reports.find_one({"id": full["report_id"]}, {"_id": 0})
        full["report"] = rep
    if full.get("device_id"):
        history = list(db.tickets.find(
            {"device_id": full["device_id"], "id": {"$ne": ticket_id}},
            {"_id": 0, "ticket_no": 1, "ticket_number": 1, "status": 1,
             "created_at": 1, "issue_description": 1, "problem_description": 1,
             "assigned_engineer_id": 1}
        ).sort("created_at", -1).limit(20))
        full["device_history"] = history
    return full


@api.post("/tickets/{ticket_id}/assign", dependencies=[Depends(require_admin)])
async def assign_ticket(ticket_id: str, payload: TicketAssign,
                        admin=Depends(require_admin)):
    eng = db.users.find_one(
        {"id": payload.engineer_id, "role": "engineer", "is_active": True}
    )
    if not eng:
        raise HTTPException(status_code=404, detail="Engineer not found")
    ticket = db.tickets.find_one({"id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    old = ticket["status"]
    db.tickets.update_one(
        {"id": ticket_id},
        {"$set": {
            "assigned_engineer_id": payload.engineer_id,
            "assigned_engineer_name": eng["name"],
            "status": "assigned",
            "updated_at": now_iso(),
        }}
    )
    _log_status(ticket_id, admin, old, "assigned", f"Assigned to {eng['name']}")
    db.notifications.insert_one({
        "id": new_id(),
        "user_id": payload.engineer_id,
        "title": "New ticket assigned",
        "message": f"Ticket {ticket['ticket_no']} has been assigned to you",
        "type": "ticket_assigned",
        "ticket_id": ticket_id,
        "read_status": False,
        "read": False,
        "created_at": now_iso(),
    })
    return _ticket_full(db.tickets.find_one({"id": ticket_id}, {"_id": 0}))


@api.post("/tickets/{ticket_id}/status")
async def update_status(ticket_id: str, payload: StatusUpdate,
                        user=Depends(get_current_user)):
    ticket = db.tickets.find_one({"id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if user["role"] == "engineer" and ticket.get("assigned_engineer_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Not your ticket")

    if payload.status == "rejected":
        new_status = "open"
        db.tickets.update_one(
            {"id": ticket_id},
            {"$set": {
                "status": "open",
                "assigned_engineer_id": None,
                "assigned_engineer_name": None,
                "reject_reason": payload.reject_reason,
                "updated_at": now_iso(),
            }}
        )
        _log_status(ticket_id, user, ticket["status"], "rejected",
                    payload.reject_reason)
        db.notifications.insert_one({
            "id": new_id(), "user_id": "admin", "ticket_id": ticket_id,
            "title": f"Ticket {ticket['ticket_no']} rejected",
            "message": payload.reject_reason or "",
            "type": "status_rejected", "read_status": False, "read": False,
            "created_at": now_iso(),
        })
        return _ticket_full(db.tickets.find_one({"id": ticket_id}, {"_id": 0}))

    if payload.status == "report_generated":
        report = db.service_reports.find_one({"ticket_id": ticket_id})
        if not report:
            raise HTTPException(status_code=400,
                                detail="Cannot mark report_generated without a service report")

    updates = {"status": payload.status, "updated_at": now_iso()}
    if payload.status in ("closed", "report_generated"):
        updates["completed_at"] = now_iso()
    if payload.latitude is not None and payload.longitude is not None:
        updates["engineer_location"] = {
            "lat": payload.latitude, "lng": payload.longitude,
            "updated_at": now_iso(),
        }
    db.tickets.update_one({"id": ticket_id}, {"$set": updates})
    _log_status(ticket_id, user, ticket["status"], payload.status, payload.note)
    if payload.status in ("accepted", "resolved", "completed_with_signature",
                          "report_generated", "closed"):
        db.notifications.insert_one({
            "id": new_id(), "user_id": "admin", "ticket_id": ticket_id,
            "title": f"Ticket {ticket['ticket_no']} → {payload.status}",
            "message": payload.note or "",
            "type": f"status_{payload.status}",
            "read_status": False, "read": False, "created_at": now_iso(),
        })
    return _ticket_full(db.tickets.find_one({"id": ticket_id}, {"_id": 0}))


@api.post("/tickets/{ticket_id}/location")
async def update_location(ticket_id: str, payload: LocationUpdate,
                          user=Depends(require_engineer)):
    ticket = db.tickets.find_one({"id": ticket_id})
    if not ticket or ticket.get("assigned_engineer_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Not your ticket")
    db.tickets.update_one(
        {"id": ticket_id},
        {"$set": {"engineer_location": {
            "lat": payload.latitude, "lng": payload.longitude,
            "updated_at": now_iso()
        }}}
    )
    return {"ok": True}


@api.post("/tickets/{ticket_id}/report")
async def submit_report(ticket_id: str, payload: ReportSubmit,
                        user=Depends(require_engineer)):
    """
    Submit signed service report.
    Security: only assigned engineer; signature required.
    Flow: ticket → completed_with_signature → PDF generated → report_generated.
    """
    ticket = db.tickets.find_one({"id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket.get("assigned_engineer_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Not your ticket")
    if not payload.customer_signature:
        raise HTTPException(status_code=400, detail="Customer signature is required")

    db.tickets.update_one({"id": ticket_id}, {
        "$set": {"status": "completed_with_signature", "updated_at": now_iso()}
    })
    _log_status(ticket_id, user, ticket["status"],
                "completed_with_signature",
                "Customer signature captured")

    device = db.devices.find_one(
        {"device_id": ticket.get("device_id")}, {"_id": 0}
    )
    company = db.companies.find_one(
        {"id": ticket.get("company_id")}, {"_id": 0}
    ) if ticket.get("company_id") else None
    engineer = db.users.find_one(
        {"id": user["id"]}, {"_id": 0, "password_hash": 0}
    )

    report_id = new_id()
    report = {
        "id": report_id,
        "ticket_id": ticket_id,
        "ticket_no": ticket["ticket_no"],
        "engineer_id": user["id"],
        "engineer_name": engineer["name"],
        "customer_name": payload.customer_signed_name or ticket.get("customer_name"),
        "engineer_notes": payload.engineer_notes,
        "resolution_summary": payload.resolution_summary or payload.engineer_notes,
        "parts_used": [p.model_dump() for p in payload.parts_used],
        "before_images": payload.before_images,
        "after_images": payload.after_images,
        "customer_signature": payload.customer_signature,
        "customer_signed_name": payload.customer_signed_name,
        "signed_at": now_iso(),
        "generated_at": now_iso(),
        "pdf_url": None,
        "pdf_path": None,
        "work_notes": payload.engineer_notes,
        "photos_before": payload.before_images,
        "photos_after": payload.after_images,
    }

    pdf_path = None
    try:
        ticket_for_pdf = {**ticket, "report_id": report_id, "company": company}
        pdf_bytes = build_service_report_pdf(
            ticket=ticket_for_pdf, device=device,
            engineer=engineer, report=report,
        )
        pdf_path = f"reports/{ticket['ticket_no']}-{report_id}.pdf"
        put_object(pdf_path, pdf_bytes, "application/pdf")
        db.attachments.insert_one({
            "id": new_id(),
            "ticket_id": ticket_id,
            "uploaded_by": user["id"],
            "file_name": f"{ticket['ticket_no']}.pdf",
            "file_type": "application/pdf",
            "file_url": f"/api/files/{pdf_path}",
            "storage_path": pdf_path,
            "size": len(pdf_bytes),
            "is_deleted": False,
            "uploaded_at": now_iso(),
        })
        report["pdf_url"] = f"/api/files/{pdf_path}"
        report["pdf_path"] = pdf_path
    except Exception as e:
        logger.error(f"PDF generation/upload failed: {e}")

    db.service_reports.replace_one(
        {"ticket_id": ticket_id}, report, upsert=True
    )

    next_status = "report_generated" if pdf_path else "completed_with_signature"
    db.tickets.update_one(
        {"id": ticket_id},
        {"$set": {
            "report_id": report_id,
            "status": next_status,
            "pdf_path": pdf_path,
            "pdf_url": report.get("pdf_url"),
            "updated_at": now_iso(),
            "completed_at": now_iso() if next_status == "report_generated" else None,
        }}
    )
    _log_status(ticket_id, user, "completed_with_signature",
                next_status, "Service report generated")
    db.notifications.insert_one({
        "id": new_id(), "user_id": "admin", "ticket_id": ticket_id,
        "title": f"Service report ready: {ticket['ticket_no']}",
        "message": "Customer-signed PDF is ready for review.",
        "type": "report_ready", "read_status": False, "read": False,
        "created_at": now_iso(),
    })
    # Send email to client with PDF
    try:
        company = db.companies.find_one({"id": ticket.get("company_id")}, {"_id": 0}) if ticket.get("company_id") else None
        client_email = (company or {}).get("client_email") or (company or {}).get("email")
        if client_email and pdf_path:
            pdf_bytes_for_email = get_object(pdf_path)
            send_ticket_email(
                client_email, ticket, pdf_bytes_for_email,
                subject_prefix="Report Ready: ",
                sender_name=engineer.get("name") if engineer else None,
                sender_email=engineer.get("email") if engineer else None,
            )
    except Exception as e:
        logger.error(f"Email on report generation failed: {e}")

    report.pop("_id", None)
    return report


@api.post("/tickets/{ticket_id}/approve")
async def approve_ticket(ticket_id: str, admin=Depends(require_sub_admin)):
    ticket = db.tickets.find_one({"id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    approved_at = now_iso()
    db.tickets.update_one(
        {"id": ticket_id},
        {"$set": {
            "approved": True,
            "approved_at": approved_at,
            "approved_by": admin["id"],
            "approved_by_name": admin.get("name"),
            "status": "closed",
            "updated_at": approved_at,
            "completed_at": approved_at,
        }}
    )
    _log_status(ticket_id, admin, ticket["status"], "closed",
                "Service report approved and ticket closed")

    # Send 'Ticket Closed' email to customer with engineer PDF report attached.
    email_result = None
    try:
        updated_ticket = db.tickets.find_one({"id": ticket_id}, {"_id": 0}) or ticket
        # Prefer ticket.customer_email (Feature 1), fall back to company email.
        customer_email = updated_ticket.get("customer_email")
        if not customer_email:
            company = db.companies.find_one(
                {"id": updated_ticket.get("company_id")}, {"_id": 0}
            ) if updated_ticket.get("company_id") else None
            customer_email = (company or {}).get("client_email") or (company or {}).get("email")

        pdf_path = updated_ticket.get("pdf_path")
        pdf_bytes = None
        if pdf_path:
            try:
                data, _ = get_object(pdf_path)
                pdf_bytes = data
            except Exception as e:
                logger.error(f"Could not load PDF {pdf_path} for closure email: {e}")

        if customer_email:
            email_result = send_ticket_closed_email(
                customer_email, updated_ticket, pdf_bytes,
                sender_name=admin.get("name"),
                sender_email=admin.get("email"),
            )
            db.tickets.update_one(
                {"id": ticket_id},
                {"$set": {
                    "closure_email_sent_to": customer_email,
                    "closure_email_sent_at": now_iso(),
                    "closure_email_status": email_result,
                }},
            )
        else:
            logger.warning(f"No customer_email on ticket {ticket.get('ticket_no')} - closure email skipped")
    except Exception as e:
        logger.error(f"Email on ticket close failed: {e}")

    return _ticket_full(db.tickets.find_one({"id": ticket_id}, {"_id": 0}))


@api.post("/tickets/{ticket_id}/notify-customer")
async def notify_customer(ticket_id: str, user=Depends(require_sub_admin)):
    """Manually send a status notification email to the customer."""
    ticket = db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    company = db.companies.find_one({"id": ticket.get("company_id")}, {"_id": 0}) if ticket.get("company_id") else None
    client_email = (company or {}).get("client_email") or (company or {}).get("email")
    if not client_email:
        raise HTTPException(status_code=400, detail="No client email set for this company")
    pdf_path = ticket.get("pdf_path")
    pdf_bytes = get_object(pdf_path) if pdf_path else None
    send_ticket_email(
        client_email, ticket, pdf_bytes,
        subject_prefix="Update: ",
        sender_name=user.get("name"),
        sender_email=user.get("email"),
    )
    return {"ok": True, "sent_to": client_email}


# ---------- REPORTS ----------
@api.get("/reports/{ticket_id}")
async def get_report(ticket_id: str, user=Depends(get_current_user)):
    ticket = db.tickets.find_one({"id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if user["role"] == "engineer" and ticket.get("assigned_engineer_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Not your ticket")
    report = db.service_reports.find_one({"ticket_id": ticket_id}, {"_id": 0})
    if not report:
        raise HTTPException(status_code=404, detail="No report for this ticket")
    return report


# ---------- FILES (local storage server) ----------
@api.get("/files/{path:path}")
async def serve_file(path: str, request: Request):
    """Serve files from local storage. Auth via header or ?auth=token."""
    from auth import extract_token
    token = extract_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_token(token)
    user = db.users.find_one({"id": payload["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    attachment = db.attachments.find_one({
        "storage_path": path, "is_deleted": False
    })
    if attachment:
        if user["role"] == "engineer":
            ticket = db.tickets.find_one({"id": attachment["ticket_id"]})
            if not ticket or ticket.get("assigned_engineer_id") != user["id"]:
                raise HTTPException(status_code=403, detail="Access denied")
    try:
        data, _ = get_object(path)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found")
    content_type = "application/pdf" if path.endswith(".pdf") else \
                   "image/jpeg" if path.endswith((".jpg", ".jpeg")) else \
                   "image/png" if path.endswith(".png") else \
                   "application/octet-stream"
    filename = os.path.basename(path)
    return Response(content=data, media_type=content_type, headers={
        "Content-Disposition": f'inline; filename="{filename}"'
    })


# Back-compat endpoint
@api.get("/tickets/{ticket_id}/pdf")
async def get_ticket_pdf(ticket_id: str, request: Request):
    from auth import extract_token
    token = extract_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_token(token)
    user = db.users.find_one({"id": payload["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    ticket = db.tickets.find_one({"id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if user["role"] == "engineer" and ticket.get("assigned_engineer_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Not your ticket")
    if not ticket.get("pdf_path"):
        raise HTTPException(status_code=404, detail="PDF not generated yet")
    try:
        data, _ = get_object(ticket["pdf_path"])
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="PDF file missing")
    return Response(content=data, media_type="application/pdf", headers={
        "Content-Disposition": f"inline; filename=\"{ticket['ticket_no']}.pdf\""
    })


# ---------- NOTIFICATIONS ----------
@api.get("/notifications")
async def list_notifications(user=Depends(get_current_user)):
    target = "admin" if user["role"] == "admin" else user["id"]
    notes = list(db.notifications.find(
        {"user_id": target}, {"_id": 0}
    ).sort("created_at", -1).limit(50))
    for n in notes:
        if "read" not in n:
            n["read"] = n.get("read_status", False)
    return notes


@api.post("/notifications/{nid}/read")
async def mark_read(nid: str, user=Depends(get_current_user)):
    db.notifications.update_one(
        {"id": nid}, {"$set": {"read": True, "read_status": True}}
    )
    return {"ok": True}


# ---------- ATTENDANCE ----------
@api.post("/attendance/check-in")
async def check_in(payload: AttendanceAction, user=Depends(require_engineer)):
    today = date.today().isoformat()
    existing = db.attendance.find_one({"engineer_id": user["id"], "date": today})
    if existing and existing.get("check_in_time"):
        raise HTTPException(status_code=400, detail="Already checked in today")
    doc = {
        "id": new_id(),
        "engineer_id": user["id"],
        "date": today,
        "check_in_time": now_iso(),
        "check_in_location": {"lat": payload.latitude, "lng": payload.longitude}
            if payload.latitude is not None else None,
        "check_out_time": None,
        "attendance_status": "present",
        "created_at": now_iso(),
    }
    if existing:
        db.attendance.update_one({"id": existing["id"]}, {"$set": doc})
        doc["id"] = existing["id"]
    else:
        db.attendance.insert_one(doc)
    doc["check_in"] = doc["check_in_time"]
    doc["check_out"] = doc["check_out_time"]
    doc.pop("_id", None)
    return doc


@api.post("/attendance/check-out")
async def check_out(payload: AttendanceAction, user=Depends(require_engineer)):
    today = date.today().isoformat()
    existing = db.attendance.find_one({"engineer_id": user["id"], "date": today})
    if not existing or not existing.get("check_in_time"):
        raise HTTPException(status_code=400, detail="Not checked in")
    if existing.get("check_out_time"):
        raise HTTPException(status_code=400, detail="Already checked out")
    db.attendance.update_one(
        {"id": existing["id"]},
        {"$set": {
            "check_out_time": now_iso(),
            "check_out_location": {"lat": payload.latitude, "lng": payload.longitude}
                if payload.latitude is not None else None,
        }}
    )
    doc = db.attendance.find_one({"id": existing["id"]}, {"_id": 0})
    doc["check_in"] = doc.get("check_in_time")
    doc["check_out"] = doc.get("check_out_time")
    return doc


@api.get("/attendance/today")
async def attendance_today(user=Depends(require_engineer)):
    today = date.today().isoformat()
    doc = db.attendance.find_one({"engineer_id": user["id"], "date": today},
                                 {"_id": 0})
    if doc:
        doc["check_in"] = doc.get("check_in_time")
        doc["check_out"] = doc.get("check_out_time")
    return doc or {}


@api.get("/attendance/history")
async def attendance_history(user=Depends(require_engineer)):
    docs = list(db.attendance.find(
        {"engineer_id": user["id"]}, {"_id": 0}
    ).sort("date", -1).limit(60))
    for d in docs:
        d["check_in"] = d.get("check_in_time")
        d["check_out"] = d.get("check_out_time")
    return docs


# ---------- DASHBOARD ----------
@api.get("/dashboard/admin", dependencies=[Depends(require_admin)])
async def admin_dashboard():
    try:
        # ---- Ticket counts (ONE QUERY instead of MANY) ----
        ticket_counts_raw = list(db.tickets.aggregate([
            {
                "$group": {
                    "_id": "$status",
                    "count": {"$sum": 1}
                }
            }
        ]))

        counts = {s: 0 for s in TICKET_STATUSES}

        for item in ticket_counts_raw:
            counts[item["_id"]] = item["count"]

        counts["total"] = sum(counts.values())
        counts["active"] = sum(
            counts.get(s, 0) for s in [
                "open", "assigned", "accepted", "travelling",
                "reached_site", "in_progress", "resolved",
                "completed_with_signature", "report_generated"
            ]
        )

        # ---- Engineers (already good) ----
        total_eng = db.users.count_documents({
            "role": "engineer",
            "is_active": True
        })

        available = db.users.count_documents({
            "role": "engineer",
            "is_active": True,
            "is_available": True
        })

        # ---- Companies ----
        total_co = db.companies.count_documents({"status": "active"})

        # ---- Recent activity (LIMITED) ----
        logs = list(
            db.ticket_status_logs
            .find({}, {"_id": 0})
            .sort("timestamp", -1)
            .limit(5)
        )

        recent = [{
            "id": l["id"],
            "actor_id": l.get("changed_by"),
            "actor_name": l.get("changed_by_name"),
            "actor_role": l.get("changed_by_role"),
            "action": f"status_{l['new_status']}",
            "details": l.get("remarks"),
            "timestamp": l["timestamp"],
        } for l in logs]

        # ---- Warranty alerts (DB filter, not Python) ----
        today = date.today()
        in_30 = (today + timedelta(days=30)).isoformat()

        warranty_alerts = list(db.devices.find(
            {
                "warranty_status": "active",
                "warranty_expiry": {
                    "$gte": today.isoformat(),
                    "$lte": in_30
                }
            },
            {"_id": 0}
        ).limit(20))

        return {
            "ticket_counts": counts,
            "engineers": {
                "total": total_eng,
                "available": available
            },
            "companies": {
                "active": total_co
            },
            "recent_activity": recent,
            "warranty_alerts": warranty_alerts,
        }

    except Exception as e:
        print("DASHBOARD ERROR:", str(e))
        raise HTTPException(status_code=500, detail="Dashboard error")
# @api.get("/dashboard/admin", dependencies=[Depends(require_admin)])
# async def admin_dashboard():
#     counts = {}
#     for s in TICKET_STATUSES:
#         counts[s] = db.tickets.count_documents({"status": s})
#     counts["total"] = sum(counts.values())
#     counts["active"] = sum(
#         counts[s] for s in
#         ["open", "assigned", "accepted", "travelling",
#          "reached_site", "in_progress", "resolved",
#          "completed_with_signature", "report_generated"]
#     )
#     total_eng = db.users.count_documents({"role": "engineer", "is_active": True})
#     available = db.users.count_documents(
#         {"role": "engineer", "is_active": True, "is_available": True}
#     )
#     total_co = db.companies.count_documents({"status": "active"})
#     logs = list(db.ticket_status_logs.find({}, {"_id": 0})
#                 .sort("timestamp", -1).limit(15))
#     recent = [{
#         "id": l["id"],
#         "actor_id": l.get("changed_by"),
#         "actor_name": l.get("changed_by_name"),
#         "actor_role": l.get("changed_by_role"),
#         "action": f"status_{l['new_status']}",
#         "details": l.get("remarks"),
#         "timestamp": l["timestamp"],
#     } for l in logs]
#     today = date.today()
#     in_30 = (today + timedelta(days=30)).isoformat()
#     warranty_alerts = list(db.devices.find(
#         {"warranty_status": "active",
#          "warranty_expiry": {"$gte": today.isoformat(), "$lte": in_30}},
#         {"_id": 0}
#     ).limit(20))
#     return {
#         "ticket_counts": counts,
#         "engineers": {"total": total_eng, "available": available},
#         "companies": {"active": total_co},
#         "recent_activity": recent,
#         "warranty_alerts": warranty_alerts,
#     }


@api.get("/dashboard/engineer")
async def engineer_dashboard(user=Depends(require_engineer)):
    eid = user["id"]
    assigned = db.tickets.count_documents(
        {"assigned_engineer_id": eid, "status": {"$in": ["assigned", "accepted"]}}
    )
    in_progress = db.tickets.count_documents(
        {"assigned_engineer_id": eid,
         "status": {"$in": ["travelling", "reached_site", "in_progress"]}}
    )
    completed = db.tickets.count_documents(
        {"assigned_engineer_id": eid,
         "status": {"$in": ["closed", "report_generated", "completed_with_signature"]}}
    )
    resolved = db.tickets.count_documents(
        {"assigned_engineer_id": eid, "status": "resolved"}
    )
    return {
        "assigned": assigned,
        "in_progress": in_progress,
        "resolved": resolved,
        "completed": completed,
    }


# ---------- ANALYTICS ----------
@api.get("/analytics", dependencies=[Depends(require_admin)])
async def analytics():
    today = date.today()

    # 1. Per-day: single aggregation instead of 14 count_documents
    start_14 = (today - timedelta(days=13)).isoformat()
    per_day_raw = list(db.tickets.aggregate([
        {"$match": {"created_at": {"$gte": start_14}}},
        {"$group": {"_id": {"$substr": ["$created_at", 0, 10]}, "count": {"$sum": 1}}},
    ]))
    per_day_map = {r["_id"]: r["count"] for r in per_day_raw}
    per_day = [
        {"date": (today - timedelta(days=i)).isoformat(),
         "count": per_day_map.get((today - timedelta(days=i)).isoformat(), 0)}
        for i in range(13, -1, -1)
    ]

    # 2. Engineer performance: single aggregation instead of 2 queries per engineer
    eng_perf_raw = list(db.tickets.aggregate([
        {"$match": {"assigned_engineer_id": {"$ne": None}}},
        {"$group": {
            "_id": "$assigned_engineer_id",
            "completed": {"$sum": {"$cond": [{"$in": ["$status", ["closed", "report_generated"]]}, 1, 0]}},
            "active":    {"$sum": {"$cond": [{"$in": ["$status", ["closed", "rejected", "report_generated"]]}, 0, 1]}},
        }},
    ]))
    eng_name_map = {e["id"]: e["name"] for e in db.users.find(
        {"role": "engineer"}, {"_id": 0, "id": 1, "name": 1}
    )}
    perf = sorted([
        {"name": eng_name_map.get(r["_id"], r["_id"]),
         "completed": r["completed"], "active": r["active"]}
        for r in eng_perf_raw if r["_id"] in eng_name_map
    ], key=lambda x: -x["completed"])

    # 3. Repeat complaints: $lookup instead of per-row find_one
    repeats = list(db.tickets.aggregate([
        {"$group": {"_id": "$device_id", "count": {"$sum": 1}}},
        {"$match": {"count": {"$gt": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10},
        {"$lookup": {"from": "devices", "localField": "_id", "foreignField": "device_id", "as": "device"}},
        {"$unwind": {"path": "$device", "preserveNullAndEmptyArrays": True}},
        {"$project": {"_id": 0, "device_id": "$_id", "count": 1,
                      "brand": "$device.brand", "model": "$device.model"}},
    ]))

    # 4. Brand trend: $lookup instead of per-row find_one
    brand_trend = list(db.tickets.aggregate([
        {"$group": {"_id": "$device_id", "count": {"$sum": 1}}},
        {"$lookup": {"from": "devices", "localField": "_id", "foreignField": "device_id", "as": "device"}},
        {"$unwind": {"path": "$device", "preserveNullAndEmptyArrays": True}},
        {"$group": {"_id": {"$ifNull": ["$device.brand", "Unknown"]}, "tickets": {"$sum": "$count"}}},
        {"$sort": {"tickets": -1}},
        {"$limit": 8},
        {"$project": {"_id": 0, "brand": "$_id", "tickets": 1}},
    ]))

    # 5. Warranty alerts
    in_30 = (today + timedelta(days=30)).isoformat()
    warranty_alerts = list(db.devices.find(
        {"warranty_status": "active",
         "warranty_expiry": {"$gte": today.isoformat(), "$lte": in_30}},
        {"_id": 0}
    ).limit(20))

    return {
        "per_day": per_day,
        "engineer_performance": perf,
        "repeat_complaints": repeats,
        "brand_trend": brand_trend,
        "warranty_alerts": warranty_alerts,
    }


@api.get("/live-locations", dependencies=[Depends(require_admin)])
async def live_locations():
    tickets = list(db.tickets.find(
        {"engineer_location": {"$ne": None},
         "status": {"$in": ["travelling", "reached_site", "in_progress"]}},
        {"_id": 0}
    ).limit(200))
    out = []
    for t in tickets:
        eng = db.users.find_one(
            {"id": t.get("assigned_engineer_id")}, {"_id": 0, "name": 1}
        ) if t.get("assigned_engineer_id") else None
        out.append({
            "ticket_id": t["id"],
            "ticket_number": t.get("ticket_no") or t.get("ticket_number"),
            "engineer_name": eng["name"] if eng else "Unknown",
            "status": t["status"],
            "location": t["engineer_location"],
            "customer_name": t.get("customer_name"),
        })
    return out


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)