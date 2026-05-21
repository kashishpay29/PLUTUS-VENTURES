# Plutus Ventures – IT Service Management
## PRD & Implementation Log

### Original Problem Statement
Extend the existing Plutus Ventures FastAPI ticket-management backend (DO NOT
rebuild). Add three features while keeping backward compatibility:
1. **Ticket Creation enhancements** — `product_reference_number`, `oem_reference_number`, `customer_email` (required, email-validated).
2. **Email automation on ticket approval** — closure email with PDF on Approve & Close.
3. **Device History** — Excel export, filter by company + date range, soft-delete via `is_deleted`.

### Subsequent (Iteration 2) Asks
- Wire SMTP env values (Gmail placeholders) so email module is ready.
- Add a **Frontend Device History admin page** under existing admin layout.
- Default filter: last 30 days. Pagination 10/page. Confirmation popup before delete. Excel export of filtered data only. Deleted records hidden unless explicitly restored.

### Architecture
- **Backend**: FastAPI on `:8001`, MongoDB on `:27017` (`plutus`). Uvicorn + supervisor + hot reload.
- **Frontend**: React (CRA + craco) on `:3000`. shadcn/ui components, Tailwind, lucide-react icons.
- **Auth**: JWT (12h). Roles: `admin`, `sub_admin`, `engineer`.
- **Storage**: local FS for engineer-submitted PDFs (`backend/storage/reports/`).
- **Email**: SMTP via env. Now configured with placeholder Gmail creds — graceful failure if creds invalid (logged + `closure_email_status: {sent:false, error:...}` on the ticket). Ticket close always persists.

### User Personas
- **Admin** — full CRUD on companies / engineers / tickets, approves and closes tickets, manages device history (filter/export/delete/restore).
- **Sub-admin** — same operational permissions for tickets, approval, device history.
- **Engineer** — assigned to tickets, submits signed service reports (PDF).
- **Customer** — receives ticket closure email with PDF report attached.

### Core Requirements (static)
- Backward compatibility for existing endpoints — no breaking changes.
- `customer_email` validated via Pydantic `EmailStr` (422 on bad/missing).
- Soft-deleted records hidden from `GET /api/tickets` and default `/api/device-history*` listings/exports.
- Approval emails non-blocking — failures logged; ticket close persists regardless.
- Frontend Device History page surfaces all admin operations on history records.

### What's Been Implemented

**Iteration 1 — May 21, 2026 (Backend extensions)**
- Bug fixes (blocking app startup): `from email import date` → `from datetime import date`; added missing `require_sub_admin` import.
- **Feature 1**: `TicketCreate` extended with `customer_email` (EmailStr), `product_reference_number`, `oem_reference_number`. Persisted on the ticket document.
- **Feature 2**: `POST /api/tickets/{id}/approve` (admin or sub_admin) sets `approved_at`, `approved_by(_name)`, status `closed`. Sends `Ticket Closed - {ticket_no}` email via new `send_ticket_closed_email()` helper — PDF attached from `pdf_path` (tuple correctly unpacked from `get_object`). Two-attempt retry. Stores `closure_email_sent_to/at/status` audit fields.
- **Feature 3 — Device History endpoints** (admin + sub_admin):
  - `GET /api/device-history` and `/api/device-history/filter?company=&start_date=&end_date=` → JSON `{items, total}`.
  - `GET /api/device-history/export?company=&start_date=&end_date=` → `.xlsx` (openpyxl) with the 9 spec columns. Filename: `device_history_<company|all>_<YYYY-MM-DD>_<YYYY-MM-DD>.xlsx`.
  - `DELETE /api/device-history/{ticket_id}` → soft delete (`is_deleted=true`); rejects open/in-progress tickets with 400.
  - `POST /api/device-history/{ticket_id}/restore` → undo soft delete.
- `GET /api/tickets` excludes `is_deleted=true` records.

**Iteration 2 — May 21, 2026 (SMTP wiring + Frontend Device History page)**
- Backend `.env` extended with SMTP placeholders (`SMTP_HOST/PORT/USER/PASS/FROM_EMAIL/COMPANY_NAME`). Email module is fully wired — picks up env at startup.
- Backend filter endpoints (`/device-history`, `/device-history/filter`) accept `include_deleted` and `only_deleted` query params so the frontend can fetch deleted records for restore.
- Frontend new route: `/admin/device-history` (and visible in both `ADMIN_NAV` and `SUB_ADMIN_NAV`).
- Frontend file: `/app/frontend/src/pages/admin/DeviceHistoryPage.jsx`:
  - Filters: company name (text, partial match), start/end dates (default last 30 days), Apply + Reset.
  - 9-column table per spec + Actions (Delete / Restore).
  - Pagination: 10 records/page with Prev/Next.
  - Search input filters loaded rows client-side.
  - "Show deleted records" toggle triggers `only_deleted=1` fetch and swaps Delete → Restore action.
  - "Export to Excel" downloads filtered xlsx with the correct ISO-date filename.
  - Delete uses an `AlertDialog` confirmation popup; Cancel and Yes-delete both wired.
- Frontend `.env` `REACT_APP_BACKEND_URL` corrected from broken `http://localhost:8000` to the platform preview URL.
- Installed missing pre-existing deps (`framer-motion`, `leaflet`, `react-leaflet`) so the frontend compiles.

### Verification
- **Iteration 1** testing subagent: **15/15 backend tests pass** ([iteration_3.json](/app/test_reports/iteration_3.json)).
- **Iteration 2** testing subagent: **16/16 backend + 100% frontend flows** ([iteration_4.json](/app/test_reports/iteration_4.json)). Verified end-to-end: filters, apply, default dates, search, pagination, export download with correct filename, delete with confirmation dialog (cancel + confirm), Show-deleted toggle + restore, SMTP graceful failure path during approve.
- Screenshot capture confirmed UI matches the existing admin theme (navy sidebar, blue accents, white cards, slate type scale).

### Backlog / Next Action Items
- **P0 (security)**: Replace the placeholder SMTP password in `/app/backend/.env` with a valid Gmail App Password before going live. Plain SMTP credentials should not be committed — consider moving to a secrets manager.
- **P1**: Frontend `DeviceHistoryPage` export uses `localStorage.getItem('token')` directly instead of the shared `api` axios instance. Refactor to `api.get(..., { responseType: 'blob' })` for consistency.
- **P2**: Refactor `server.py` (~2,374 lines) into modules (`auth`, `tickets`, `device_history`, `email`, `dashboards`).
- **P3**: Pre-existing `get_object()` tuple bug in `submit_report` engineer-report email and `notify_customer` (acknowledged in iteration 1; left untouched).
- **P3**: Standardise list-endpoint response shapes (`/api/companies` returns paginated object; `/api/tickets` returns a flat list).

### Test Credentials
See `/app/backend/memory/test_credentials.md`.
- **Admin**: `admin@plutusventures.com` / `admin123`
- **Engineer**: `engineer@plutusventures.com` / `engineer123`
- Login: direct `POST /api/auth/login` (no OTP required in current flow).
