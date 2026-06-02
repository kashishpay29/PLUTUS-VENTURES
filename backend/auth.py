import os
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException, Request, Depends
from typing import Optional

JWT_ALGORITHM = "HS256"

def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=12),
        "type": "access",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def extract_token(request: Request) -> Optional[str]:
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:]
    token = request.cookies.get("access_token")
    if token:
        return token
    # support query param for downloads (img tags / PDFs)
    return request.query_params.get("auth")

async def get_current_user(request: Request):
    from server import db
    token = extract_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_token(token)
    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token type")
    user = db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

async def require_admin(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

async def require_engineer(user=Depends(get_current_user)):
    if user.get("role") != "engineer":
        raise HTTPException(status_code=403, detail="Engineer access required")
    return user

async def require_sub_admin(user=Depends(get_current_user)):
    if user.get("role") not in ("admin", "sub_admin"):
        raise HTTPException(status_code=403, detail="Admin or Sub-admin access required")
    return user

async def require_admin_console(user=Depends(get_current_user)):
    if user.get("role") not in ("admin", "sub_admin", "ticket_admin"):
        raise HTTPException(status_code=403, detail="Admin console access required")
    return user

async def require_ticket_operator(user=Depends(get_current_user)):
    if user.get("role") not in ("admin", "sub_admin", "ticket_admin"):
        raise HTTPException(status_code=403, detail="Ticket operator access required")
    return user
