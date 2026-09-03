# Trains

MBTA map: FastAPI backend and Vite/React frontend.

## Requirements

- Python 3.12+
- Node.js
- An [MBTA API key](https://api-v3.mbta.com/)

## Backend

```sh
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Create `backend/.env`:

```
MBTA_API_KEY=your_key_here
```

```sh
uvicorn main:app --reload --port 8000
```

## Frontend

```sh
cd frontend
npm install
```

Create `frontend/.env`:

```
VITE_API_BASE_URL=http://localhost:8000
```

```sh
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173).
