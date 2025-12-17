#!/bin/bash

# StaffAdmin - Stop All Services Script

echo "🛑 Stopping StaffAdmin Services..."
echo "=================================="

# Kill services on ports
lsof -ti:8000,9001,3000 | xargs kill -9 2>/dev/null

if [ $? -eq 0 ]; then
    echo "✓ All services stopped"
else
    echo "✓ No services were running"
fi

echo "=================================="
