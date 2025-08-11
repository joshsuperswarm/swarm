import modal
from typing import Dict, Any
from collections import defaultdict, deque


class InMemoryStorage:
    """In-memory storage for sandboxes and processes with dict-like interface."""
    
    def __init__(self):
        self.sandboxes: Dict[str, modal.Sandbox] = {}
        self.processes: Dict[str, Dict[str, Any]] = {}
        self.log_buffers = defaultdict(lambda: {"stdout": deque(), "stderr": deque()})
    
    def clear_sandboxes(self):
        """Clear all sandboxes (for compatibility with tests)."""
        self.sandboxes.clear()
    
    def clear_processes(self):
        """Clear all processes (for compatibility with tests)."""
        self.processes.clear()


class DictProxy:
    """Proxy to make storage.sandboxes behave like the old SANDBOXES dict for tests."""
    
    def __init__(self, storage, attr_name):
        self._storage = storage
        self._attr_name = attr_name
    
    def __getitem__(self, key):
        return getattr(self._storage, self._attr_name)[key]
    
    def __setitem__(self, key, value):
        getattr(self._storage, self._attr_name)[key] = value
    
    def __delitem__(self, key):
        del getattr(self._storage, self._attr_name)[key]
    
    def __contains__(self, key):
        return key in getattr(self._storage, self._attr_name)
    
    def clear(self):
        getattr(self._storage, self._attr_name).clear()
    
    def get(self, key, default=None):
        return getattr(self._storage, self._attr_name).get(key, default)
    
    def keys(self):
        return getattr(self._storage, self._attr_name).keys()
    
    def values(self):
        return getattr(self._storage, self._attr_name).values()
    
    def items(self):
        return getattr(self._storage, self._attr_name).items()