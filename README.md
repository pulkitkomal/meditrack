# MediTrack - Personal Health Records App

A full-stack health records management application with Telegram bot integration for tracking blood glucose and blood pressure readings.

> **Created with [OpenCode](https://opencode.ai)** - An AI-powered coding assistant

## Features

- **Document Management**: Upload and analyze medical documents
- **AI Analysis**: Get insights from your health documents using OpenAI
- **Telegram Bot**: Track health readings via Telegram
  - Log glucose readings (e.g., `150`)
  - Log blood pressure (e.g., `120/80`)
  - Send photos of your meters
  - Automatic reminders at scheduled times
- **Health Insights**: View trends and patterns in your health data
- **Profile Management**: Manage your personal health profile

## Tech Stack

- **Frontend**: React + TypeScript + TailwindCSS
- **Backend**: FastAPI + Python
- **Database**: MongoDB
- **Telegram**: python-telegram-bot

## Getting Started

### Prerequisites

- Docker & Docker Compose
- OpenAI API key
- Telegram Bot Token

### Environment Variables

Create a `.env` file in the root directory:

```env
MONGO_URL=mongodb://mongo:27017
MONGO_DB_NAME=medical_records
SECRET_KEY=your-secret-key
ACCESS_TOKEN_EXPIRE_MINUTES=30
OPENAI_API_KEY=sk-your-openai-key
OPENAI_MODEL=gpt-4o-mini
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
USE_OPENAI_VISION=true
```

### Running the App

```bash
docker-compose up -d
```

- Frontend: http://localhost:6363
- Backend: http://localhost:8000
- MongoDB: localhost:27017

### Connecting Telegram

1. Go to Profile page in the app
2. Click "Connect Telegram"
3. Open the generated link in Telegram
4. Send `/start` to complete the connection

## API Endpoints

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/documents/` - List documents
- `POST /api/documents/upload` - Upload document
- `POST /api/analysis/analyze/{doc_id}` - Analyze document
- `GET /api/telegram/config` - Get Telegram settings
- `GET /api/telegram/readings` - Get health readings

## License

MIT