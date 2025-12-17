#!/bin/bash

# StaffAdmin - Start All Services Script
# This script starts all three services for local development

echo "🚀 Starting StaffAdmin Services..."
echo "=================================="

# Colors for output
GREEN='\033[0.32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Kill any existing services on our ports
echo -e "${YELLOW}Cleaning up existing services...${NC}"
lsof -ti:8000,9001,3000 | xargs kill -9 2>/dev/null || true
sleep 2

# Start Backend API
echo -e "${BLUE}Starting Backend API on port 8000...${NC}"
cd api
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"
cd ..

# Wait a moment
sleep 2

# Start Optimizer API
echo -e "${BLUE}Starting Optimizer API on port 9001...${NC}"
cd opti
python3 optimizer_api.py > /tmp/optimizer.log 2>&1 &
OPTIMIZER_PID=$!
echo "Optimizer PID: $OPTIMIZER_PID"
cd ..

# Wait a moment
sleep 2

# Start Frontend
echo -e "${BLUE}Starting Frontend on port 3000...${NC}"
cd web
npm run dev > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"
cd ..

# Wait for services to start
echo -e "${YELLOW}Waiting for services to start...${NC}"
sleep 5

# Check service health
echo ""
echo "=================================="
echo -e "${GREEN}Service Status:${NC}"
echo "=================================="

# Check Backend
if curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Backend API:    http://localhost:8000    (PID: $BACKEND_PID)"
else
    echo -e "${YELLOW}⚠${NC} Backend API:    Starting... (check /tmp/backend.log for errors)"
fi

# Check Optimizer
if curl -s http://localhost:9001/ > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Optimizer API:  http://localhost:9001    (PID: $OPTIMIZER_PID)"
else
    echo -e "${YELLOW}⚠${NC} Optimizer API:  Starting... (check /tmp/optimizer.log for errors)"
fi

# Check Frontend
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Frontend:       http://localhost:3000    (PID: $FRONTEND_PID)"
else
    echo -e "${YELLOW}⚠${NC} Frontend:       Starting... (check /tmp/frontend.log for errors)"
fi

echo ""
echo "=================================="
echo -e "${GREEN}Health Dashboard:${NC} http://localhost:3000/health"
echo "=================================="
echo ""
echo "Logs are available at:"
echo "  - Backend:   tail -f /tmp/backend.log"
echo "  - Optimizer: tail -f /tmp/optimizer.log"
echo "  - Frontend:  tail -f /tmp/frontend.log"
echo ""
echo "To stop all services, run: ./stop-all-services.sh"
echo ""
