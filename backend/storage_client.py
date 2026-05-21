"""
Pluggable file storage providers: local fs (default), AWS S3, Cloudinary.
Select via STORAGE_PROVIDER env: "local" | "s3" | "cloudinary".
"""
import os
import io
import uuid
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

PROVIDER = os.environ.get("STORAGE_PROVIDER", "local").lower()
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
STORAGE_ROOT = Path(os.environ.get("STORAGE_PATH", BASE_DIR / "storage"))


# ---------- Local ----------
class LocalStorage:
    def __init__(self):
        STORAGE_ROOT.mkdir(parents=True, exist_ok=True)

    def _resolve(self, path: str) -> Path:
        safe = path.lstrip("/")
        if ".." in safe.split("/"):
            raise ValueError(f"Illegal path: {path}")
        full = (STORAGE_ROOT / safe).resolve()
        if not str(full).startswith(str(STORAGE_ROOT.resolve())):
            raise ValueError(f"Path escapes storage root: {path}")
        return full

    def put(self, path, data, content_type):
        full = self._resolve(path)
        full.parent.mkdir(parents=True, exist_ok=True)
        full.write_bytes(data)
        return {"path": path, "size": len(data), "content_type": content_type}

    def get(self, path):
        full = self._resolve(path)
        if not full.exists():
            raise FileNotFoundError(path)
        return full.read_bytes(), None

    def delete(self, path):
        try:
            full = self._resolve(path)
            if full.exists():
                full.unlink()
            return True
        except Exception as e:
            logger.error(f"Delete failed for {path}: {e}")
            return False


# ---------- S3 ----------
class S3Storage:
    def __init__(self):
        import boto3
        self.bucket = os.environ["S3_BUCKET"]
        self.prefix = os.environ.get("S3_PREFIX", "")
        self.client = boto3.client(
            "s3",
            region_name=os.environ.get("AWS_REGION", "us-east-1"),
            aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY"),
        )

    def _key(self, path):
        return f"{self.prefix.rstrip('/')}/{path.lstrip('/')}" if self.prefix else path

    def put(self, path, data, content_type):
        self.client.put_object(
            Bucket=self.bucket, Key=self._key(path),
            Body=data, ContentType=content_type
        )
        return {"path": path, "size": len(data), "content_type": content_type}

    def get(self, path):
        obj = self.client.get_object(Bucket=self.bucket, Key=self._key(path))
        return obj["Body"].read(), obj.get("ContentType")

    def delete(self, path):
        try:
            self.client.delete_object(Bucket=self.bucket, Key=self._key(path))
            return True
        except Exception as e:
            logger.error(f"S3 delete failed: {e}")
            return False


# ---------- Cloudinary ----------
class CloudinaryStorage:
    def __init__(self):
        import cloudinary
        import cloudinary.uploader
        cloudinary.config(
            cloud_name=os.environ["CLOUDINARY_CLOUD_NAME"],
            api_key=os.environ["CLOUDINARY_API_KEY"],
            api_secret=os.environ["CLOUDINARY_API_SECRET"],
        )
        self.uploader = cloudinary.uploader
        self.api = cloudinary.api
        self._cache = {}

    def put(self, path, data, content_type):
        bio = io.BytesIO(data)
        resource_type = "raw" if "pdf" in (content_type or "") else "auto"
        public_id = path.rsplit(".", 1)[0]
        res = self.uploader.upload(
            bio, public_id=public_id, resource_type=resource_type,
            overwrite=True,
        )
        self._cache[path] = res["secure_url"]
        return {"path": path, "size": len(data), "content_type": content_type,
                "url": res["secure_url"]}

    def get(self, path):
        # For Cloudinary, fetch the public URL contents
        import requests
        url = self._cache.get(path)
        if not url:
            raise FileNotFoundError(path)
        r = requests.get(url, timeout=30)
        r.raise_for_status()
        return r.content, r.headers.get("Content-Type")

    def delete(self, path):
        try:
            public_id = path.rsplit(".", 1)[0]
            self.uploader.destroy(public_id, resource_type="raw")
            return True
        except Exception as e:
            logger.error(f"Cloudinary delete failed: {e}")
            return False


_backend = None


def get_backend():
    global _backend
    if _backend:
        return _backend
    if PROVIDER == "s3":
        _backend = S3Storage()
        logger.info("Storage provider: AWS S3")
    elif PROVIDER == "cloudinary":
        _backend = CloudinaryStorage()
        logger.info("Storage provider: Cloudinary")
    else:
        _backend = LocalStorage()
        logger.info("Storage provider: Local filesystem")
    return _backend


# Public API used by server.py
def init_storage():
    get_backend()
    return True


def put_object(path: str, data: bytes, content_type: str = "application/octet-stream"):
    return get_backend().put(path, data, content_type)


def get_object(path: str):
    return get_backend().get(path)


def delete_object(path: str) -> bool:
    return get_backend().delete(path)
