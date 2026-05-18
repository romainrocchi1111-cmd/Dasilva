from datetime import datetime, timedelta
from collections import defaultdict
import threading

_lock = threading.Lock()
_requests: dict[str, datetime] = defaultdict(lambda: datetime.min)
COOLDOWN_MINUTES = 10


def check_rate_limit(ip: str) -> tuple[bool, int]:
    """Returns (allowed: bool, wait_minutes: int)."""
    with _lock:
        last = _requests[ip]
        now = datetime.utcnow()
        if now - last < timedelta(minutes=COOLDOWN_MINUTES):
            remaining = COOLDOWN_MINUTES - int((now - last).total_seconds() / 60)
            return False, remaining
        _requests[ip] = now
        return True, 0
