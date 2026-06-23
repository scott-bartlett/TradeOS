# TradeOS

AI-first operating system for small skilled trades businesses.

> "TradeOS makes the invisible time visible — and then eliminates it."

## Stack

- **Backend:** Python + FastAPI
- **Database:** PostgreSQL
- **Queue:** Redis
- **AI:** OpenAI (abstracted — swappable)
- **Media:** Cloudflare R2
- **Hosting:** Railway → AWS

## Structure

```
TradeOS/
├── backend/          FastAPI API
│   ├── main.py
│   ├── requirements.txt
│   └── app/
│       ├── routes/   API endpoints
│       ├── models/   Database models
│       └── services/ Business logic + AI
├── frontend/         Next.js (coming Phase 1)
└── .gitignore
```

## Local Development

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env      # Fill in your values
uvicorn main:app --reload
```

API docs available at: `http://localhost:8000/docs`

## Environment Variables

See `backend/.env.example` for required variables.
Never commit `.env` to GitHub.
