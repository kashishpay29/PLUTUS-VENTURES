# Test Credentials

## Admin (primary)
- Email: `admin@plutusventures.com`
- Password: `admin123`

## Admin (legacy)
- Email: `admin@serviceops.com` / Password: `admin123`

## Engineer (primary)
- Email: `engineer@plutusventures.com` / Password: `engineer123`

## Engineer (legacy)
- Email: `engineer@serviceops.com` / Password: `engineer123`

## Login flow
1. POST /api/auth/login -> returns `challenge_id` and `dev_otp`
2. POST /api/auth/verify-otp -> returns JWT `token`
3. Use `Authorization: Bearer <token>` for all subsequent calls
