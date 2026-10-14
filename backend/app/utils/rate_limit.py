import time
from collections import defaultdict, deque


class FailedAttemptLimiter:
    """In-memory sliding-window limiter for failed attempts, keyed by e.g. account email.

    State is per process, so with several API processes the effective limit is multiplied.
    """

    def __init__(self, max_attempts: int, window_seconds: int):
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self._attempts: dict[str, deque] = defaultdict(deque)

    def _prune(self, key: str, now: float) -> deque:
        attempts = self._attempts[key]
        while attempts and now - attempts[0] > self.window_seconds:
            attempts.popleft()
        if not attempts:
            del self._attempts[key]
        return attempts

    def is_blocked(self, key: str) -> bool:
        return len(self._prune(key, time.monotonic())) >= self.max_attempts

    def record_failure(self, key: str) -> None:
        now = time.monotonic()
        self._prune(key, now)
        self._attempts[key].append(now)

    def reset(self, key: str) -> None:
        self._attempts.pop(key, None)
