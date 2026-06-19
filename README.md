# Kleos — CA in Your Pocket 🏦

**RAIT-ACM Kleos Hackathon 2026 — Team InItToWinIt**

GST invoice reconciliation & AI advisory app powered by Gemini + Expo.

---

## Quick Start

### 1. Prerequisites

| Tool | Version | Check |
|------|---------|-------|
| Python | 3.10+ | `python --version` |
| Node.js | 18+ | `node --version` |
| npm | 8+ | `npm --version` |

---

### 2. Backend Setup (FastAPI on port 8000)

**Open Terminal 1** in the project root:

```powershell
# Step 1: Activate the virtual environment
.\.venv\Scripts\Activate.ps1

# Step 2: Install dependencies (first time only)
pip install -r backend/requirements.txt

# Step 3: Add your Gemini API key
#   - Open backend/.env
#   - Replace YOUR_GEMINI_API_KEY with your actual key
#   - Get a free key at: https://aistudio.google.com/app/apikey

# Step 4: Start the backend
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

✅ You should see:
```
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000
```

Test it: open http://localhost:8000/api/health in your browser — you should get `{"status":"ok"}`.

---

### 3. App Setup (Expo / React Native)

**Open Terminal 2** in the project root:

```powershell
# Step 1: Go to the app directory
cd app

# Step 2: Install dependencies (first time only)
npm install

# Step 3: Check/update app/.env
#   - The file already has your LAN IP (10.136.215.59) pre-filled.
#   - Change it if you're on a different network.

# Step 4: Start Expo
npx expo start
```

✅ You should see a QR code and:
```
Starting Metro Bundler
Waiting on http://localhost:8081
```

**To open the app:**
- **Android Emulator:** Press `a` in the terminal
- **iOS Simulator (Mac only):** Press `i` in the terminal  
- **Physical device:** Scan the QR code with **Expo Go** app
- **Web browser:** Press `w` in the terminal

---

### 4. Backend `.env` Configuration

Edit [`backend/.env`](./backend/.env):

```env
# Required for AI features (invoice OCR, Ask-a-CA, advisory)
GEMINI_API_KEY=your_actual_key_here

# Optional: model override
# GEMINI_MODEL=gemini-2.5-flash
```

> Without a valid `GEMINI_API_KEY`, the server starts fine but AI endpoints return fallback/stub responses.

---

### 5. App `.env` Configuration

Edit [`app/.env`](./app/.env):

```env
# Physical device on same WiFi — use your machine's LAN IP
EXPO_PUBLIC_AI_API_URL=http://10.136.215.59:8000

# Android emulator
# EXPO_PUBLIC_AI_API_URL=http://10.0.2.2:8000

# iOS simulator
# EXPO_PUBLIC_AI_API_URL=http://localhost:8000
```

> The app auto-derives the URL from Expo's `hostUri` if this env var is not set, so this is only needed for deployed backends or if auto-detection fails.

---

### 6. About the `npm audit` Warning

Running `npm audit fix --force` is **not recommended** — it may downgrade Expo to a breaking version. The audit warnings about `uuid` are in `@expo/ngrok` (a devDependency only used for tunneling) and do **not** affect the app at runtime. You can safely ignore them.

---

## Project Structure

```
RAIT-ACM-Kleos-InItToWinIt/
├── backend/          # FastAPI Python server (OCR + AI + DB)
│   ├── main.py       # Entry point — run with uvicorn
│   ├── api/routes/   # API endpoints
│   ├── core/         # OCR, Gemini, extractor, matcher
│   ├── models/       # Pydantic schemas
│   ├── db/           # SQLAlchemy session
│   └── .env          # ← Your API keys go here
├── app/              # Expo React Native app
│   ├── App.tsx       # Root component
│   ├── src/          # Screens, navigation, API client
│   └── .env          # ← Backend URL goes here
└── docs/             # PRD, TRD, design system docs
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/v1/invoices/upload` | Upload invoice image |
| POST | `/api/analyze-invoice` | Analyze invoice (app-compatible) |
| POST | `/api/ai/gst-doubt` | Ask GST question |
| POST | `/api/ai/advice` | Get AI advisory |

Full docs available at http://localhost:8000/docs (Swagger UI) when backend is running.
