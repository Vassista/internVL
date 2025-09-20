#!/usr/bin/env python3
"""
Main entry point for the AutoEval API Server
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))
from api.api_server import app
import uvicorn

if __name__ == "__main__":
    print("🚀 Starting AutoEval API Server...")
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        reload=False
    )
