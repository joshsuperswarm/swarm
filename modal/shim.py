#!/usr/bin/env python3

# Compatibility shim for backward compatibility with tests and imports
from modal.web.app import app  # re-export app
from modal.services.storage import DictProxy

# compatibility exports for tests:
SANDBOXES = DictProxy(app.state.storage, 'sandboxes')
PROCS = DictProxy(app.state.storage, 'processes')

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)