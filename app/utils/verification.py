import secrets
from datetime import datetime, timedelta
from typing import Tuple
from zoneinfo import ZoneInfo

def generate_verification_token() -> Tuple[str, datetime]:
    """Generate a verification token and its expiration time."""
    token = secrets.token_urlsafe(32)
    expires = datetime.now(ZoneInfo("UTC")) + timedelta(hours=24)  # Token expires in 24 hours
    return token, expires

def is_token_expired(expires: datetime) -> bool:
    """Check if a token has expired."""
    if expires is None:
        return True
    current_time = datetime.now(ZoneInfo("UTC"))
    return current_time > expires.astimezone(ZoneInfo("UTC")) 