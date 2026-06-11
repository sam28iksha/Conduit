<<<<<<< HEAD


# Conduit

> Autonomous data pipeline incident response, powered by Gemini and Arize Phoenix.

Conduit monitors your Fivetran data pipelines 24/7, diagnoses failures, fixes what it can autonomously, and escalates to humans with full context when it cannot. Every decision is traced, scored by an LLM judge, and fed back into the agent as lessons — so it gets measurably better over time.

Built for the **Google Cloud Rapid Agent Hackathon** — Arize track.

![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)
![Python](https://img.shields.io/badge/python-3.12-blue.svg)
![Framework](https://img.shields.io/badge/framework-Google%20ADK-orange.svg)
![Partner](https://img.shields.io/badge/partner-Arize%20Phoenix-purple.svg)

---

## What It Does

| Failure Type | Conduit's Response |
|---|---|
| Schema drift | Triggers re-sync, verifies connector moves to `syncing` |
| Rate limit (429) | Triggers re-sync after backoff window |
| Auth expiry | Escalates to human with full credentials context |
| Network error | Triggers re-sync, monitors recovery |
| Unknown | Pulls connector logs, classifies, decides |

After every run, a second Gemini call scores the agent's decisions across four dimensions — **diagnosis accuracy**, **action appropriateness**, **reasoning clarity**, and **escalation judgment**. Low-scoring runs are injected into the agent's system prompt as lessons before the next incident. The agent reads its own failures and improves.

---

## Architecture

┌─────────────────────────────────────────────────────────┐ │ Next.js Frontend │ │ Overview · Live Reasoning · Evaluations · Traces │ └──────────────────────┬──────────────────────────────────┘ │ SSE stream + REST ┌──────────────────────▼──────────────────────────────────┐ │ FastAPI Backend │ │ api/server.py (Cloud Run) │ └──────────────────────┬──────────────────────────────────┘ │ ┌──────────────────────▼──────────────────────────────────┐ │ Google ADK Agent │ │ Gemini 2.5 Flash reasoning │ │ │ │ Tools Self-improvement │ │ ├─ list_connectors ├─ LLM-as-a-Judge evaluator │ │ ├─ get_connector_details ├─ eval_scores.jsonl │ │ ├─ get_connector_logs └─ memory.py lesson injector │ │ ├─ trigger_resync │ │ ├─ pause_connector Observability │ │ └─ resume_connector └─ Arize Phoenix (all spans) │ └──────────────────────┬──────────────────────────────────┘ │ ┌──────────────────────▼──────────────────────────────────┐ │ Fivetran REST API │ │ Real connector data · Sync management │ └─────────────────────────────────────────────────────────┘
---

## Tech Stack

| Layer | Technology |
|---|---|
| Agent runtime | [Google ADK](https://google.github.io/adk-docs/) (code-first Agent Builder path) |
| LLM | Gemini 2.5 Flash via Vertex AI |
| Observability | [Arize Phoenix](https://phoenix.arize.com/) + OpenInference auto-instrumentation |
| Data pipelines | [Fivetran REST API](https://fivetran.com/docs/rest-api) |
| Backend | FastAPI + Server-Sent Events |
| Frontend | Next.js 16 + Tailwind |
| Hosting | Google Cloud Run (backend) + Vercel (frontend) |

---
=======
This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:
>>>>>>> 06a17a1 (Readme.md)

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

<<<<<<< HEAD
- Python 3.12+
- Node.js 18+
- [uv](https://github.com/astral-sh/uv) (`pip install uv`)
- Google Cloud project with Vertex AI enabled
- Arize Phoenix Cloud account ([free tier](https://app.phoenix.arize.com/))
- Fivetran account ([14-day free trial](https://fivetran.com/signup))

---

## Local Setup

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/conduit.git
cd conduit
2. Install Python dependencies
cd gemini-hackathon
uv sync
3. Configure environment variables
cp .env.example .env
Open .env and fill in:
# Google Cloud / Vertex AI
GOOGLE_GENAI_USE_VERTEXAI=true
GOOGLE_CLOUD_PROJECT=your-gcp-project-id
GOOGLE_CLOUD_LOCATION=us-central1

# Arize Phoenix
PHOENIX_API_KEY=px_live_xxxxxxxxxxxx
PHOENIX_COLLECTOR_ENDPOINT=https://app.phoenix.arize.com/s/your-space-id
PHOENIX_PROJECT_NAME=conduit

# Fivetran
FIVETRAN_API_KEY=your_fivetran_key
FIVETRAN_API_SECRET=your_fivetran_secret

# Set to true to use realistic mock connectors (recommended for local dev)
USE_MOCK_DATA=true
4. Authenticate with Google Cloud
gcloud auth application-default login
gcloud config set project your-gcp-project-id
gcloud auth application-default set-quota-project your-gcp-project-id
5. Run the agent (CLI)
make run MESSAGE='Check all pipeline connectors and report their current status.'
You should see the agent reason through connector failures, take actions, and print an evaluator score.
6. Run the full stack
Terminal 1 — Backend:
cd gemini-hackathon
uv run uvicorn api.server:app --reload --port 8000
Terminal 2 — Frontend:
cd gemini-hackathon/frontend
npm install
npm run dev
Open http://localhost:3000.

Project URL:https://conduit-eta-puce.vercel.app/


Mock Data vs Live Fivetran

Mock mode simulates five connectors: Salesforce (schema drift), Stripe (rate limit), Postgres (auth expiry), HubSpot (healthy), BigQuery (healthy). The mock is stateful — after trigger_resync is called, subsequent list_connectors calls return syncing state for that connector, exactly as the real API would.

Project Structure
conduit/
├── gemini-hackathon/
│   ├── agent/
│   │   ├── conduit/
│   │   │   ├── agent.py        # ADK root_agent definition
│   │   │   ├── tools.py        # Fivetran API tool functions
│   │   │   ├── evaluator.py    # LLM-as-a-Judge scoring
│   │   │   ├── memory.py       # Lesson injection from past runs
│   │   │   ├── mock.py         # Stateful mock Fivetran responses
│   │   │   └── eval_scores.jsonl
│   │   ├── instrumentation.py  # Phoenix tracing setup
│   │   └── main.py             # CLI entry point
│   ├── api/
│   │   └── server.py           # FastAPI + SSE backend
│   ├── frontend/
│   │   └── app/
│   │       └── page.tsx        # Full Next.js dashboard
│   ├── .env.example
│   ├── Makefile
│   └── pyproject.toml
└── README.md

Self-Improvement Loop
Every agent run produces an evaluation stored in eval_scores.jsonl:
{
  "incident_id": "a3f9c2b1",
  "diagnosis_accuracy": 5,
  "action_appropriateness": 4,
  "reasoning_clarity": 5,
  "escalation_judgment": 5,
  "overall_score": 5,
  "key_finding": "Agent correctly identified rate limit and triggered resync.",
  "improvement_suggestion": "Consider logging retry-after header value explicitly."
}
Before each new run, memory.py reads all past scores below 4, formats them as lessons, and prepends them to the agent's system prompt. The agent literally reads what it did wrong and adjusts.

Arize Phoenix Integration
All agent activity is automatically traced via openinference-instrumentation-google-adk:
Every Gemini call (inputs, outputs, token counts, latency)
Every Fivetran tool call (function name, arguments, return value)
Every evaluator run (score breakdown, finding, suggestion)
Traces are visible in your Phoenix Cloud dashboard under the conduit project in real time.

Deployment
Backend — Google Cloud Run
gcloud run deploy conduit-api \
  --source . \
  --project your-gcp-project-id \
  --region us-central1 \
  --allow-unauthenticated \
  --min-instances 1 \
  --set-env-vars "GOOGLE_GENAI_USE_VERTEXAI=true,GOOGLE_CLOUD_PROJECT=your-gcp-project-id,GOOGLE_CLOUD_LOCATION=us-central1,USE_MOCK_DATA=true,PHOENIX_API_KEY=your_key,PHOENIX_PROJECT_NAME=conduit"
--min-instances 1 keeps the container warm so judges get instant response when they open your project URL.
Frontend — Vercel
cd frontend
npx vercel --prod
Set NEXT_PUBLIC_API_URL to your Cloud Run service URL when prompted.

Environment Variables Reference

*Not required when USE_MOCK_DATA=true

License
Apache 2.0 — see LICENSE for details.

Acknowledgements
Built with Google ADK, Arize Phoenix, Fivetran, and Gemini for the Google Cloud Rapid Agent Hackathon 2026.

=======
Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
>>>>>>> 06a17a1 (Readme.md)
