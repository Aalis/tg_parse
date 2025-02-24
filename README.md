# Telegram Group Parser

A modern web application for parsing Telegram groups using bot tokens. Built with FastAPI and React.

## Features
- Parse Telegram groups using bot token
- Modern, responsive UI
- Secure authentication
- Data persistence
- Real-time updates

## Setup

### Backend Setup
1. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Linux/Mac
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Create a `.env` file in the root directory with:
```
TELEGRAM_BOT_TOKEN=your_bot_token_here
SECRET_KEY=your_secret_key_here
```

4. Run the backend:
```bash
uvicorn app.main:app --reload
```

### Frontend Setup
1. Install Node.js dependencies:
```bash
cd frontend
npm install
```

2. Run the frontend development server:
```bash
npm run dev
```

## Project Structure
```
.
├── app/                    # Backend FastAPI application
│   ├── api/               # API routes
│   ├── core/              # Core functionality
│   ├── models/            # Database models
│   └── services/          # Business logic
├── frontend/              # React frontend
│   ├── src/              # Source code
│   └── public/           # Static files
├── alembic/              # Database migrations
├── requirements.txt      # Python dependencies
└── .env                  # Environment variables
``` 