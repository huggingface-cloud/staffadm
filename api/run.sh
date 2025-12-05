#!/bin/bash

# Activate virtual environment
source venv/bin/activate

# Run FastAPI server
echo "Starting Staff Admin & Rostering API..."
echo "API: http://localhost:8001"
echo "Docs: http://localhost:8001/docs"
echo ""

python main.py
