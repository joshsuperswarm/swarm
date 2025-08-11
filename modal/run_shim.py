#!/usr/bin/env python3
"""
Start the modal sandbox shim service.
"""
import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


def main():
    """Start the FastAPI service."""
    # Set default port if not specified
    port = int(os.getenv("PORT", "8000"))
    host = os.getenv("HOST", "0.0.0.0")

    print(f"Starting Modal Sandbox Shim on {host}:{port}")

    # Import and run with uvicorn
    import uvicorn
    from modal.web.app import app

    uvicorn.run(
        app,
        host=host,
        port=port,
        log_level="info",
        reload=False,
        workers=1,
    )


if __name__ == "__main__":
    main()
