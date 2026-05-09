# HealthSync - Personal Health Records App

A full-stack health records management application with Telegram bot integration for tracking blood glucose and blood pressure readings. AI-powered document analysis and insights to help you manage your health.

> **Created with [OpenCode](https://opencode.ai)** - An AI-powered coding assistant

## Features

### Document Management
- Upload medical documents (PDF, JPG, PNG)
- **AI-Powered Title Prediction**: Automatically generates descriptive titles for uploaded documents
- Secure cloud storage with AWS S3
- View and download original documents
- Organize by category (lab reports, prescriptions, radiology, etc.)
- **Carousel View**: Horizontal scrolling carousel with filter controls, view/analyze/delete actions

### AI Analysis
- Automatic extraction of lab values, medications, and diagnoses
- Smart document summary generation
- Medical advisor chatbot for health questions
- Health insights and trend analysis

### Health Dashboard
- **Key Health Metrics Display**: Shows latest HbA1c, Hemoglobin, Glucose, Creatinine, TSH, and other important lab values
- **Sophisticated Health Score**: Multi-factor scoring based on specific lab values with different weights (e.g., HbA1c deducts more than cholesterol)
- Trend analysis for lab values over time
- User profile conditions factored into health score
- Active conditions tracking
- Predicted health risks

### Telegram Bot Integration
- Track blood glucose readings (e.g., `150`)
- Log blood pressure (e.g., `120/80`)
- Send photos of your meters for automatic reading
- Set automatic reminders at scheduled times
- Receive health notifications

### Mobile & Tablet
- Mobile-first design with bottom navigation
- Optimized tablet view (breakpoint at 1024px)
- Desktop sidebar navigation for larger screens
- Touch-friendly carousel with scroll indicators

### Profile Management
- Personal health profile (age, gender, blood type)
- Medical conditions and allergies tracking
- Height and weight monitoring
- Telegram connection management
- API usage statistics

## Design

The app features a premium, clean design inspired by Apple Health:

- **Clean aesthetic**: White/slate background with teal accents
- **Mobile-first**: Bottom navigation with responsive layouts
- **Smooth animations**: Fade-in transitions, hover effects
- **Premium components**: Rounded cards, soft shadows, modern typography

## Tech Stack

- **Frontend**: React + TypeScript + TailwindCSS + Vite
- **Backend**: FastAPI + Python
- **Database**: MongoDB (Atlas)
- **Storage**: AWS S3
- **AI**: OpenAI GPT-4 Vision
- **Telegram**: python-telegram-bot

## Getting Started

### Prerequisites

- Docker & Docker Compose
- OpenAI API key
- Telegram Bot Token (from @BotFather)
- AWS S3 bucket (optional, for cloud storage)

### Environment Variables

Create a `.env` file in the root directory:

```env
# MongoDB
MONGO_URL=mongodb+srv://user:password@cluster.mongodb.net/?appName=appname
MONGO_DB_NAME=medical_records

# Authentication
SECRET_KEY=your-super-secret-key
ACCESS_TOKEN_EXPIRE_MINUTES=30

# OpenAI
OPENAI_API_KEY=sk-your-openai-key
OPENAI_MODEL=gpt-4o-mini

# Telegram Bot
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
USE_OPENAI_VISION=true

# AWS S3 (optional)
AWS_S3_BUCKET=your-bucket-name
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
```

### Running the App

```bash
# Clone the repository
git clone https://github.com/pulkitkomal/meditrack.git
cd meditrack

# Start with Docker Compose
docker-compose up -d
```

Access the app:
- **Frontend**: http://localhost:6363
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

### Running Without Docker

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend
cd frontend
npm install
npm run dev
```

## Connecting Telegram

1. Go to the Settings page in the app
2. Click "Connect Telegram"
3. Open the generated link in Telegram
4. Send `/start` to complete the connection

Once connected, you can:
- Send readings directly from Telegram
- Set up reminders
- Get health notifications

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout

### Documents
- `GET /api/documents/` - List documents
- `POST /api/documents/upload` - Upload document
- `POST /api/documents/bulk-upload` - Bulk upload
- `GET /api/documents/file/{doc_id}` - Get file
- `DELETE /api/documents/{doc_id}` - Delete document

### Analysis
- `POST /api/analysis/analyze/{doc_id}` - Trigger document analysis
- `GET /api/analysis/{doc_id}` - Get analysis results
- `GET /api/analysis/history` - Get analysis history
- `GET /api/analysis/summary` - Get health summary
- `POST /api/analysis/chat` - Chat with medical advisor

### Telegram
- `GET /api/telegram/config` - Get Telegram settings
- `PUT /api/telegram/config` - Update Telegram settings
- `POST /api/telegram/disconnect` - Disconnect Telegram
- `GET /api/telegram/readings` - Get health readings

### Users
- `GET /api/users/me` - Get current user
- `PATCH /api/users/me` - Update profile
- `POST /api/users/telegram/generate-link` - Generate Telegram link

## Security

- JWT-based authentication
- Password hashing with bcrypt
- TLS/SSL encryption for data transmission
- Encrypted storage on AWS S3
- Secure API endpoints

## License

MIT License - feel free to use and modify.