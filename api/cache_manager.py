"""
Query Caching Manager for Performance Optimization
Implements in-memory caching with TTL for frequently accessed data.
"""

import time
import hashlib
import json
from typing import Any, Optional, Callable
from functools import wraps
from datetime import datetime, timedelta


class CacheManager:
    """
    Simple in-memory cache with TTL support.
    For production, consider using Redis or Memcached.
    """

    def __init__(self):
        self._cache = {}
        self._timestamps = {}
        self._default_ttl = 300  # 5 minutes default TTL

    def _generate_key(self, prefix: str, *args, **kwargs) -> str:
        """Generate a unique cache key from function arguments."""
        # Create a string representation of args and kwargs
        key_data = {
            'prefix': prefix,
            'args': args,
            'kwargs': sorted(kwargs.items())
        }
        key_string = json.dumps(key_data, sort_keys=True, default=str)
        return hashlib.md5(key_string.encode()).hexdigest()

    def get(self, key: str, default: Any = None) -> Any:
        """Get value from cache if not expired."""
        if key not in self._cache:
            return default

        # Check if expired
        if key in self._timestamps:
            timestamp, ttl = self._timestamps[key]
            if time.time() - timestamp > ttl:
                # Expired - remove from cache
                del self._cache[key]
                del self._timestamps[key]
                return default

        return self._cache[key]

    def set(self, key: str, value: Any, ttl: Optional[int] = None):
        """Set value in cache with TTL."""
        self._cache[key] = value
        self._timestamps[key] = (time.time(), ttl or self._default_ttl)

    def delete(self, key: str):
        """Delete specific key from cache."""
        if key in self._cache:
            del self._cache[key]
        if key in self._timestamps:
            del self._timestamps[key]

    def clear(self):
        """Clear entire cache."""
        self._cache.clear()
        self._timestamps.clear()

    def invalidate_pattern(self, pattern: str):
        """Invalidate all keys matching a pattern (prefix)."""
        keys_to_delete = [k for k in self._cache.keys() if k.startswith(pattern)]
        for key in keys_to_delete:
            self.delete(key)

    def get_stats(self) -> dict:
        """Get cache statistics."""
        return {
            'total_keys': len(self._cache),
            'cache_size_bytes': sum(
                len(str(v).encode()) for v in self._cache.values()
            )
        }


# Global cache instance
_cache = CacheManager()


def cached(ttl: int = 300, prefix: str = ""):
    """
    Decorator for caching function results.

    Args:
        ttl: Time to live in seconds (default 5 minutes)
        prefix: Cache key prefix for organizing related caches

    Example:
        @cached(ttl=600, prefix="employees")
        def get_employees(dept_id):
            return expensive_query()
    """
    def decorator(func: Callable):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Generate cache key
            cache_key = _cache._generate_key(
                prefix or func.__name__,
                *args,
                **kwargs
            )

            # Try to get from cache
            result = _cache.get(cache_key)
            if result is not None:
                return result

            # Execute function and cache result
            result = func(*args, **kwargs)
            _cache.set(cache_key, result, ttl)

            return result

        # Add cache control methods to wrapper
        wrapper.clear_cache = lambda: _cache.invalidate_pattern(prefix or func.__name__)
        wrapper.cache_manager = _cache

        return wrapper
    return decorator


def invalidate_cache(prefix: str):
    """Invalidate all cache entries with given prefix."""
    _cache.invalidate_pattern(prefix)


def clear_all_cache():
    """Clear entire cache."""
    _cache.clear()


def get_cache_stats() -> dict:
    """Get cache statistics."""
    return _cache.get_stats()


# Cache invalidation triggers for data mutations
def invalidate_on_write(table: str):
    """
    Decorator to invalidate related caches when data is written.

    Example:
        @invalidate_on_write("employees")
        def create_employee(data):
            return insert_employee(data)
    """
    def decorator(func: Callable):
        @wraps(func)
        def wrapper(*args, **kwargs):
            result = func(*args, **kwargs)
            # Invalidate related caches after successful write
            invalidate_cache(table)
            return result
        return wrapper
    return decorator
