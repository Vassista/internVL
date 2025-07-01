#!/usr/bin/env python3
"""
Main entry point for the InternVL API Server
"""

import sys
import os

# Add the src directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

# Now import and run the API server
from api.api_server import app
import uvicorn

if __name__ == "__main__":
    print("🚀 Starting InternVL API Server...")
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        reload=False
    )
