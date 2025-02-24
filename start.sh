#!/bin/bash

# Activate virtual environment
source venv/bin/activate

# Start backend server in the background
uvicorn app.main:app --reload &

# Navigate to frontend directory and install dependencies
cd frontend

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
fi

# Start frontend server
npm run dev -- --host 