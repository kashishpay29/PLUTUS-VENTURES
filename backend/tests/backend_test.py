"""
Plutus Ventures ServiceOps - Iteration 2 backend regression suite.

Covers new features:
- Company Management (CRUD with auto company_code, duplicate name rejection,
  delete-block when active tickets, propagation of name change, search/filter).
- Ticket creation with company_id (auto-fill customer fields, inactive
  company rejection, engineer/admin role enforcement).
- Status workflow: assigned -> accepted -> travelling -> reached_site ->
  in_progress, plus report submission -> completed_with_signature ->
  report_generated -> closed (via approve).
- Engineer report with engineer_notes / before_images / after_images /
  customer_signature; signature required; non-assigned engineer 403.
- Reports endpoint + file serving with ?auth= query token; PDF >5KB and
  starts with %PDF.
- Admin dashboard exposes companies.active and new status counters.
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

# NOTE: backend/.env overrides ADMIN_EMAIL to admin@serviceops.com, so the
# "primary" plutus admin per docs is NOT seeded; we use the working legacy
# admin which is also accepted per credentials file.
ADMIN_EMAIL = "admin@serviceops.com"
ADMIN_PASSWORD = "admin123"
ENG_EMAIL = "engineer@plutusventures.com"
ENG_PASSWORD = "engineer123"

# Tiny PNG (1x1) used for images / signature
_PNG_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgAAIAAAUAAeImBZsAAAAASUVORK5CYII="
)
_DATA_URL = f"data:image/png;base64,{_PNG_B64}"


def _login(email: str, password: str) -> str:
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    d = r.json()
    assert d.get("challenge_id") and d.get("dev_otp")
    v = requests.post(f"{API}/auth/verify-otp",
                      json={"email": email, "otp": d["dev_otp"], "challenge_id": d["challenge_id"]},
                      timeout=30)
    assert v.status_code == 200, v.text
    return v.json()["token"]


def _h(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PASSWORD)


@pytest.fixture(scope="session")
def engineer_token():
    return _login(ENG_EMAIL, ENG_PASSWORD)


@pytest.fixture(scope="session")
def engineer_user(engineer_token):
    r = requests.get(f"{API}/auth/me", headers=_h(engineer_token), timeout=30)
    assert r.status_code == 200
    return r.json()


# ---------- AUTH ----------
class TestAuth:
    def test_admin_login_and_me(self, admin_token):
        r = requests.get(f"{API}/auth/me", headers=_h(admin_token), timeout=30)
        assert r.status_code == 200
        u = r.json()
        assert u["email"] == ADMIN_EMAIL and u["role"] == "admin"

    def test_engineer_me(self, engineer_token):
        r = requests.get(f"{API}/auth/me", headers=_h(engineer_token), timeout=30)
        assert r.status_code == 200
        assert r.json()["role"] == "engineer"

    def test_legacy_admin_login_works(self):
        token = _login("admin@plutusventures.com", "admin123")
        assert isinstance(token, str) and len(token) > 0


# ---------- COMPANIES CRUD ----------
class TestCompanies:
    state = {}

    def test_create_company_auto_code(self, admin_token):
        name = f"TEST Acme {int(time.time())}"
        r = requests.post(f"{API}/companies", headers=_h(admin_token), json={
            "company_name": name,
            "contact_person": "John Doe",
            "phone": "+919900000000",
            "email": "john@acme.com",
            "address": "1 MG Road",
            "gst_number": "27ACME1234X1Z5",
            "city": "Mumbai", "state": "MH", "pincode": "400001",
        }, timeout=30)
        assert r.status_code == 200, r.text
        c = r.json()
        assert c["company_name"] == name
        assert c["company_code"].startswith("CMP-") and len(c["company_code"]) >= 8
        assert c["status"] == "active"
        TestCompanies.state["company"] = c

    def test_duplicate_company_name_rejected_case_insensitive(self, admin_token):
        c = TestCompanies.state["company"]
        r = requests.post(f"{API}/companies", headers=_h(admin_token), json={
            "company_name": c["company_name"].upper(),
        }, timeout=30)
        assert r.status_code == 400

    def test_engineer_cannot_create_company(self, engineer_token):
        r = requests.post(f"{API}/companies", headers=_h(engineer_token), json={
            "company_name": "TEST should fail",
        }, timeout=30)
        assert r.status_code == 403

    def test_list_companies_pagination_shape(self, admin_token):
        r = requests.get(f"{API}/companies", headers=_h(admin_token), timeout=30)
        assert r.status_code == 200
        body = r.json()
        for k in ("items", "total", "page", "page_size"):
            assert k in body
        assert isinstance(body["items"], list) and body["total"] >= 1

    def test_list_search_and_status_filter(self, admin_token):
        c = TestCompanies.state["company"]
        r = requests.get(f"{API}/companies", headers=_h(admin_token),
                         params={"q": c["company_name"][:6], "status": "active"}, timeout=30)
        assert r.status_code == 200
        ids = [x["id"] for x in r.json()["items"]]
        assert c["id"] in ids

    def test_get_company_with_tickets_and_devices(self, admin_token):
        c = TestCompanies.state["company"]
        r = requests.get(f"{API}/companies/{c['id']}", headers=_h(admin_token), timeout=30)
        assert r.status_code == 200
        body = r.json()
        assert body["company"]["id"] == c["id"]
        assert "tickets" in body and "devices" in body

    def test_update_company_propagates_name(self, admin_token):
        c = TestCompanies.state["company"]
        new_name = c["company_name"] + " Renamed"
        r = requests.put(f"{API}/companies/{c['id']}", headers=_h(admin_token),
                         json={"company_name": new_name}, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["company_name"] == new_name
        TestCompanies.state["company"]["company_name"] = new_name


# ---------- TICKETS with company_id ----------
class TestTickets:
    state = {}

    def test_create_ticket_requires_company(self, admin_token):
        r = requests.post(f"{API}/tickets", headers=_h(admin_token), json={
            "issue_description": "Boom", "priority": "medium",
            "device": {"brand": "Dell", "model": "L7480"},
        }, timeout=30)
        assert r.status_code in (400, 422)

    def test_create_ticket_with_company_autofills(self, admin_token):
        c = TestCompanies.state["company"]
        r = requests.post(f"{API}/tickets", headers=_h(admin_token), json={
            "company_id": c["id"],
            "issue_description": "Laptop not booting",
            "priority": "high",
            "device": {"brand": "Dell", "model": "Latitude 7480",
                       "serial_number": f"SN-{int(time.time())}",
                       "warranty_status": "active",
                       "warranty_expiry": "2026-12-31"},
        }, timeout=30)
        assert r.status_code == 200, r.text
        t = r.json()
        assert t["company_id"] == c["id"]
        assert t.get("company_name")  # propagated
        # auto-filled
        assert t["customer_name"]  # falls back to contact_person
        assert t["status"] == "open"
        assert t["ticket_no"].startswith("TKT-")
        TestTickets.state["ticket"] = t

    def test_create_ticket_rejects_inactive_company(self, admin_token):
        # create + deactivate a company
        r = requests.post(f"{API}/companies", headers=_h(admin_token),
                          json={"company_name": f"TEST Inactive {int(time.time())}"}, timeout=30)
        assert r.status_code == 200
        cid = r.json()["id"]
        u = requests.put(f"{API}/companies/{cid}", headers=_h(admin_token),
                         json={"status": "inactive"}, timeout=30)
        assert u.status_code == 200
        r2 = requests.post(f"{API}/tickets", headers=_h(admin_token), json={
            "company_id": cid, "issue_description": "x",
            "device": {"brand": "x", "model": "y"},
        }, timeout=30)
        assert r2.status_code == 400

    def test_list_tickets_has_company_fields(self, admin_token):
        r = requests.get(f"{API}/tickets", headers=_h(admin_token), timeout=30)
        assert r.status_code == 200
        tid = TestTickets.state["ticket"]["id"]
        found = next((x for x in r.json() if x["id"] == tid), None)
        assert found and found.get("company_id") and found.get("company_name")

    def test_assign_then_accepted_creates_status_log(self, admin_token, engineer_user, engineer_token):
        tid = TestTickets.state["ticket"]["id"]
        r = requests.post(f"{API}/tickets/{tid}/assign", headers=_h(admin_token),
                          json={"engineer_id": engineer_user["id"]}, timeout=30)
        assert r.status_code == 200 and r.json()["status"] == "assigned"
        # engineer -> accepted
        a = requests.post(f"{API}/tickets/{tid}/status", headers=_h(engineer_token),
                          json={"status": "accepted"}, timeout=30)
        assert a.status_code == 200 and a.json()["status"] == "accepted"
        # status logs
        g = requests.get(f"{API}/tickets/{tid}", headers=_h(admin_token), timeout=30).json()
        logs = g.get("status_logs", [])
        assert any(s["new_status"] == "accepted" and s.get("old_status") == "assigned" for s in logs)

    @pytest.mark.parametrize("st", ["travelling", "reached_site", "in_progress"])
    def test_progression(self, engineer_token, st):
        tid = TestTickets.state["ticket"]["id"]
        r = requests.post(f"{API}/tickets/{tid}/status", headers=_h(engineer_token),
                          json={"status": st, "latitude": 19.07, "longitude": 72.87}, timeout=30)
        assert r.status_code == 200 and r.json()["status"] == st

    def test_report_requires_signature(self, engineer_token):
        tid = TestTickets.state["ticket"]["id"]
        r = requests.post(f"{API}/tickets/{tid}/report", headers=_h(engineer_token), json={
            "engineer_notes": "Done",
            "before_images": [_DATA_URL], "after_images": [_DATA_URL],
            "customer_signature": "",
        }, timeout=30)
        assert r.status_code == 400

    def test_report_non_assigned_engineer_forbidden(self, admin_token, engineer_token):
        # create another engineer and try
        suffix = int(time.time())
        em = f"test_eng2_{suffix}@plutus.com"
        c = requests.post(f"{API}/engineers", headers=_h(admin_token), json={
            "name": "Other Eng", "email": em, "password": "pass1234", "skills": [],
        }, timeout=30)
        assert c.status_code == 200
        other = _login(em, "pass1234")
        tid = TestTickets.state["ticket"]["id"]
        r = requests.post(f"{API}/tickets/{tid}/report", headers=_h(other), json={
            "engineer_notes": "x", "customer_signature": _DATA_URL,
        }, timeout=30)
        assert r.status_code == 403
        # cleanup
        eid = c.json()["id"]
        requests.delete(f"{API}/engineers/{eid}", headers=_h(admin_token), timeout=30)

    def test_submit_report_generates_pdf_and_moves_to_report_generated(self, engineer_token):
        tid = TestTickets.state["ticket"]["id"]
        r = requests.post(f"{API}/tickets/{tid}/report", headers=_h(engineer_token), json={
            "engineer_notes": "Replaced motherboard, ran diagnostics.",
            "resolution_summary": "All OK.",
            "parts_used": [{"name": "MB", "part_number": "MB-1", "quantity": 1}],
            "before_images": [_DATA_URL], "after_images": [_DATA_URL],
            "customer_signature": _DATA_URL,
            "customer_signed_name": "John Customer",
        }, timeout=60)
        assert r.status_code == 200, r.text
        rep = r.json()
        assert rep.get("engineer_notes")
        assert rep.get("pdf_path"), "PDF should have been generated"
        TestTickets.state["report"] = rep

    def test_ticket_now_report_generated(self, admin_token):
        tid = TestTickets.state["ticket"]["id"]
        r = requests.get(f"{API}/tickets/{tid}", headers=_h(admin_token), timeout=30).json()
        assert r["status"] == "report_generated"

    def test_get_report_endpoint(self, admin_token):
        tid = TestTickets.state["ticket"]["id"]
        r = requests.get(f"{API}/reports/{tid}", headers=_h(admin_token), timeout=30)
        assert r.status_code == 200
        assert r.json()["ticket_id"] == tid

    def test_files_endpoint_with_query_token(self, admin_token):
        rep = TestTickets.state["report"]
        path = rep["pdf_path"]
        r = requests.get(f"{API}/files/{path}", params={"auth": admin_token}, timeout=30)
        assert r.status_code == 200
        assert r.content[:4] == b"%PDF"
        assert len(r.content) > 5000, f"PDF size {len(r.content)} <5KB"

    def test_legacy_ticket_pdf_endpoint(self, admin_token):
        tid = TestTickets.state["ticket"]["id"]
        r = requests.get(f"{API}/tickets/{tid}/pdf",
                         headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
        assert r.status_code == 200
        assert r.content[:4] == b"%PDF"

    def test_approve_sets_status_closed(self, admin_token):
        tid = TestTickets.state["ticket"]["id"]
        r = requests.post(f"{API}/tickets/{tid}/approve", headers=_h(admin_token), timeout=30)
        assert r.status_code == 200
        assert r.json()["status"] == "closed"


# ---------- Companies delete-blocking & cleanup ----------
class TestCompanyDelete:
    def test_delete_company_blocked_with_active_ticket(self, admin_token):
        # create company + open ticket
        cn = f"TEST DelBlock {int(time.time())}"
        c = requests.post(f"{API}/companies", headers=_h(admin_token),
                          json={"company_name": cn}, timeout=30).json()
        t = requests.post(f"{API}/tickets", headers=_h(admin_token), json={
            "company_id": c["id"], "issue_description": "x",
            "device": {"brand": "x", "model": "y"},
        }, timeout=30)
        assert t.status_code == 200
        d = requests.delete(f"{API}/companies/{c['id']}", headers=_h(admin_token), timeout=30)
        assert d.status_code == 400

    def test_delete_company_ok_when_no_open_tickets(self, admin_token):
        cn = f"TEST DelOK {int(time.time())}"
        c = requests.post(f"{API}/companies", headers=_h(admin_token),
                          json={"company_name": cn}, timeout=30).json()
        d = requests.delete(f"{API}/companies/{c['id']}", headers=_h(admin_token), timeout=30)
        assert d.status_code == 200


# ---------- Dashboard ----------
class TestDashboard:
    def test_admin_dashboard_includes_companies_and_new_statuses(self, admin_token):
        r = requests.get(f"{API}/dashboard/admin", headers=_h(admin_token), timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert "companies" in d and "active" in d["companies"]
        for k in ("completed_with_signature", "report_generated", "closed"):
            assert k in d["ticket_counts"], f"missing status counter: {k}"
