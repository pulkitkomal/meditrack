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
- **One drop zone**: Drop or pick up to 20 files at once, choose a type and an optional record date
- **Searchable records list**: Grouped by month, with type filters and analysis status; the analysis queue only appears while documents are being processed

### AI Analysis
- Automatic extraction of lab values, medications, and diagnoses
- Smart document summary generation
- Medical advisor chatbot for health questions
- Health insights and trend analysis

### Health Dashboard
- **Home shows what needs attention**: Out-of-range results, documents being analysed or failed, and a reminder when no reading has been logged today
- **Insights**: Metric cards with sparklines for your conditions, latest lab values, lab trends, predictions, and questions for your doctor
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

### Profile Management
- Personal health profile (date of birth, gender, blood type); age is calculated from date of birth
- Medical conditions and allergies entered as tags
- Glucose unit, dry weight, and timezone preferences
- Light, dark, or match-device appearance
- Telegram connection management
- Daily Health Assistant allowance
- Terms & Conditions and Privacy Policy

## Design

The app features a premium, clean design inspired by Apple Health:

- **Clean aesthetic**: White/slate background with teal accents, plus a dark theme
- **Mobile-first**: Bottom navigation with responsive layouts
- **Smooth animations**: Fade-in transitions, hover effects
- **Premium components**: Rounded cards, soft shadows, modern typography

## Recent Updates

- **UI refresh**: Dark mode, a needs-attention Home, sparkline metric cards, a single upload drop zone with a searchable month-grouped records list, tag inputs and new preferences in Settings, text labels on every coloured status, and loading placeholders instead of spinners

- **Vitals on the website**: Add, edit, and delete glucose (mg/dL or mmol/L), blood pressure, and weight readings from the Vitals tab, not just Telegram
- **Correct AI-extracted lab values**: Fix a misread value on any record; the AI's original is kept, and the health score, chat assistant, and report use the corrected value. A side-by-side view shows the original document next to the values on wide screens
- **Doctor visit report**: Download a PDF with 30-day vitals, the last 12 months of lab results (out-of-range first, with previous values), medications, diagnoses, and questions to ask

- **Semantic Search for Chatbot**: AI-powered medical advisor now uses sentence-transformers embeddings with cross-encoder reranking for highly relevant context retrieval
- **Improved PDF Processing**: Added poppler-utils (pdftoppm/pdftotext) as primary PDF engine with pymupdf fallback for better compatibility
- **S3 Document Extraction**: Documents stored on S3 are now downloaded locally for text extraction and analysis
- **Embeddings Backfill Script**: `backend/scripts/update_embeddings.py` to generate embeddings for existing documents
- **Clinical Reasoning Prompts**: Enhanced chatbot prompts with clinical reasoning, empathetic communication, and pathophysiological explanations
- **PWA Support**: Install as a standalone app on mobile and desktop
- **Original Document Viewer**: View original PDF/image files directly in the app
- **Bug Fixes**: Fixed null status handling in lab values, improved document loading

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
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# OpenAI
OPENAI_API_KEY=sk-your-openai-key
OPENAI_MODEL=gpt-4o-mini

# Telegram Bot
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
USE_OPENAI_VISION=true

# Comma-separated list of origins allowed to call the API from a browser
CORS_ORIGINS=http://localhost:6363
# Set to true when serving over HTTPS so the auth cookie is only sent over TLS
COOKIE_SECURE=false
# Per-user OpenAI token budget for the chat assistant over a rolling 24 hours
DAILY_CHAT_TOKEN_LIMIT=100000

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

This starts four services: `frontend`, `backend` (API), `worker` (document analysis and title generation), and `bot` (Telegram).

Access the app:
- **Frontend**: http://localhost:6363
- **Backend API**: http://localhost:8000 (bound to localhost only; browsers use the frontend's `/api` proxy)
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

### Maintenance Scripts

One-off scripts live in `backend/scripts/` and run inside the backend container:

```bash
# Remove chunks, analyses, tasks, and S3 files left behind by deleted documents (dry run unless --apply)
docker exec medical-backend python -m scripts.cleanup_orphans
# Generate chatbot embeddings for documents analyzed before semantic search existed
docker exec medical-backend python -m scripts.update_embeddings
```

### Running Tests

```bash
cd backend
pip install -r requirements-dev.txt
python -m pytest tests
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
- `POST /api/auth/login` - Login (sets an httpOnly auth cookie)
- `POST /api/auth/logout` - Logout and revoke the current token
- `POST /api/auth/logout-all` - Revoke every token for the account

### Documents
- `GET /api/documents/` - List documents
- `POST /api/documents/upload` - Upload document
- `POST /api/documents/bulk-upload` - Upload up to 20 files with one category and an optional `document_date`
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
- `GET /api/users/me/export` - Download all of your records as JSON
- `DELETE /api/users/me` - Permanently delete the account and all its data (requires password)
- `POST /api/users/telegram/generate-link` - Generate Telegram link

## Security

- JWT-based authentication stored in an httpOnly, SameSite=Strict cookie
- Login rate limiting (5 failed attempts per account per 15 minutes)
- Password hashing with bcrypt (minimum 8 characters)
- Uploaded files are checked against their real file signature, not just the declared type
- TLS/SSL encryption for data transmission
- Encrypted storage on AWS S3
- Secure API endpoints

## License

MIT License - feel free to use and modify.