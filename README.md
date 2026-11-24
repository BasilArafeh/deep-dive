# Deep Dive

![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?style=flat&logo=fastapi&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat&logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=flat&logo=typescript&logoColor=white)
![LangGraph](https://img.shields.io/badge/LangGraph-Agent-F97316?style=flat)
![GPT-4o](https://img.shields.io/badge/GPT--4o-LLM-412991?style=flat&logo=openai&logoColor=white)
![Pinecone](https://img.shields.io/badge/Pinecone-Vector_DB-00C2A8?style=flat)
![Railway](https://img.shields.io/badge/Railway-Deployed-0B0D0E?style=flat&logo=railway&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-Deployed-000000?style=flat&logo=vercel&logoColor=white)

**An agentic research report generator.** Type a topic → the agent searches the web and academic papers, synthesizes a structured cited report, and lets you interrogate it in a RAG-powered chat.

🔗 **Live demo:** [deep-dive-eta.vercel.app](https://deep-dive-eta.vercel.app)

---

## What it does

1. You enter a research topic
2. A LangGraph agent autonomously plans sub-questions, searches Tavily and arXiv, scrapes and reads sources, summarizes findings, and synthesizes a full structured report
3. The report streams to the screen section by section with inline citations
4. A multi-route chat system lets you ask questions — answered from the report via RAG, or from the web if the answer isn't in the report

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Next.js Frontend                         │
│  Landing → Research mode (SSE timeline) → Report + Chat panel   │
└─────────────────┬───────────────────────────────────┬───────────┘
                  │ SSE stream                        │ SSE stream
                  ▼                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FastAPI Backend (Railway)                  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    LangGraph Agent                      │    │
│  │                                                         │    │
│  │  Planner → Searcher → Scraper → Summarizer → Synthesizer│    │
│  │    GPT-4o   Tavily+     httpx+    GPT-4o       GPT-4o   │    │
│  │             arXiv       BS4                   (6000tok) │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │               Multi-Route Chat Orchestrator             │    │
│  │                                                         │    │
│  │  Intent Classifier → Router                             │    │
│  │  GPT-4o                                                 │    │
│  │    ├─ specific    → RAG (Pinecone similarity)           │    │
│  │    ├─ broad       → Full report context (Pinecone fetch)│    │
│  │    ├─ out_of_report → Web search offer (Tavily)         │    │
│  │    ├─ out_of_domain → Domain redirect message           │    │
│  │    └─ irrelevant  → Gentle redirect                     │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                  │ embed + upsert          │ query
                  ▼                         ▼
          ┌───────────────────────────────────┐
          │     Pinecone Vector Store         │
          │  (session-namespaced chunks)      │
          └───────────────────────────────────┘
```

---

## Tech Stack

### Backend
| Layer | Technology |
|---|---|
| Framework | FastAPI (async) |
| Agent | LangGraph — 5-node sequential graph |
| LLM | GPT-4o (planner, summarizer, synthesizer, chat) |
| Embeddings | text-embedding-3-small |
| Vector store | Pinecone (session-namespaced) |
| Web search | Tavily API |
| Academic search | arXiv API |
| Scraping | httpx + BeautifulSoup4 |
| Observability | LangSmith |
| Deployment | Railway (Docker) |

### Frontend
| Layer | Technology |
|---|---|
| Framework | Next.js 15 App Router |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Markdown | react-markdown + remark-gfm |
| Streaming | Server-Sent Events (SSE) |
| Deployment | Vercel |

---

## Agent Pipeline

The research pipeline is a 5-node LangGraph graph. Each node runs sequentially; intra-node concurrency is used where possible.

### Node 1 — Planner
- Takes the user's topic
- Produces exactly 5 sub-questions covering: background, current state and latest news, key mechanisms, debates and challenges, and future directions
- Sub-question 2 always targets recent developments explicitly

### Node 2 — Searcher
- Runs all 5 sub-questions concurrently via `asyncio.gather`
- For each sub-question: 5 Tavily results + 3 arXiv results in parallel
- Results are collected with full metadata (URL, title, snippet)

### Node 3 — Scraper
- Deduplicates by URL across all search results (arXiv prioritized)
- Caps at 15 sources before scraping begins — avoiding wasted summarization calls
- Scrapes each URL with httpx (12,000 char max per source)
- Skips sources under 500 characters — thin content wastes the synthesizer's context

### Node 4 — Summarizer
- Produces 2-3 paragraph summaries per source (150 words minimum)
- Extracts specific facts, figures, dates, and statistics
- Runs all sources concurrently
- Summary truncated to 1,000 characters for the synthesizer

### Node 5 — Synthesizer
- Receives up to 15 summaries as structured context
- Produces a full structured JSON report (6,000 max tokens)
- Uses `response_format: json_object` to guarantee valid JSON
- Handles `finish_reason: length` with truncated-JSON recovery
- Falls back to a shorter-prompt retry if recovery fails
- 120 second timeout

---

## Report Schema

```python
{
  "title": str,
  "executive_summary": str,      # 80-120 words, punchy overview
  "background": str,             # 200-300 words, foundational context
  "current_state": str,          # 200-300 words, latest developments
  "analysis": str,               # 400-600 words, the centrepiece synthesis
  "key_findings": [              # 6-10 atomic cited findings
    {
      "finding": str,
      "citation": int
    }
  ],
  "academic_context": str,       # 150-200 words, research literature synthesis
  "implications": str,           # 150-200 words, what it means going forward
  "open_questions": [str],       # 4-6 unresolved questions
  "sources": [
    {
      "title": str,
      "url": str,
      "type": "web" | "arxiv"
    }
  ]
}
```

Total target: 2,000-2,500 words of body content — 2-3 printed pages of rich analytical prose.

---

## Chat Router

Every user message goes through a multi-route orchestrator before any Pinecone or GPT call is made.

### Intent Classifier
- GPT-4o classifies each message into one of five labels
- Uses: research topic + report executive summary (fetched from Pinecone) as context
- Fast keyword pre-classification handles obvious cases without LLM cost
- Falls back to `specific` on failure — never crashes the chat

### Routes

| Label | Condition | Handler |
|---|---|---|
| `specific` | Concrete question answerable from the report | RAG: embed → Pinecone → GPT-4o answer |
| `broad` | Generic question about the report (summarize, key points) | Fetch all Pinecone chunks → reconstruct full report → GPT-4o |
| `out_of_report` | In topic domain but answer not in report | Offer Tavily web search |
| `out_of_domain` | Unrelated to research topic entirely | Redirect: "Start a new research on this topic" |
| `irrelevant` | Conversational / zero research intent | Gentle redirect back to report |

### RAG Details
- Query rewrite: GPT-4o rewrites user question to dense keyword query before embedding
- Similarity threshold: 0.5 (lowered from default to catch broad-but-relevant questions)
- Namespace: each session gets its own Pinecone namespace
- Chunks stored with `section` metadata for targeted retrieval
- All 9 report sections are embedded after synthesis (including background, current_state, analysis, implications)

---

## Production Features

### Security
- `X-API-Key` authentication on all endpoints (HMAC constant-time comparison)
- Input sanitization and prompt injection detection
- Topic and question validation with length and content checks

### Reliability
- `@with_retry` decorator with exponential backoff + jitter on all LLM and external API calls
- Per-node timeouts: planner 30s, searcher 15s/call, scraper 60s total, summarizer 120s, synthesizer 120s
- SSE auto-reconnect on the frontend: up to 3 attempts with exponential backoff
- Pinecone embedding failures only log — never block report delivery

### Observability
- `@traceable` on agent nodes and chat router for LangSmith visibility
- Structured JSON logging (python-json-logger)
- In-memory metrics at `/metrics`: request counts, error rates, p50/p95/p99 latency

### Rate Limiting & Middleware
- SlowAPI rate limiting: 20/minute chat, 10/minute research
- Request size limits: 50KB for chat (carries report context), 10KB for research
- 180 second global request timeout
- Request ID middleware for tracing
- Centralized exception handlers for 404/405/422/500

---

## Project Structure

```
deep-dive/
├── backend/
│   ├── app/
│   │   ├── agent/
│   │   │   ├── graph.py          # LangGraph graph definition
│   │   │   ├── state.py          # AgentState dataclass
│   │   │   └── nodes/
│   │   │       ├── planner.py
│   │   │       ├── searcher.py
│   │   │       ├── scraper.py
│   │   │       ├── summarizer.py
│   │   │       └── synthesizer.py
│   │   ├── routers/
│   │   │   ├── research_router.py  # SSE research stream
│   │   │   └── chat_router.py      # Multi-route chat orchestrator
│   │   ├── prompts/
│   │   │   └── system_prompts.py   # All LLM prompts with XML delimiters
│   │   ├── services/
│   │   │   ├── openai_client.py
│   │   │   ├── pinecone_client.py
│   │   │   ├── embedder.py
│   │   │   └── retry.py
│   │   ├── middleware/
│   │   │   ├── auth.py
│   │   │   ├── request_id.py
│   │   │   ├── access_log.py
│   │   │   ├── timeout.py
│   │   │   └── request_size.py
│   │   ├── config.py             # Pydantic-settings BaseSettings
│   │   ├── schemas.py            # Request/response models
│   │   ├── security.py           # Input validation
│   │   ├── limiter.py            # Rate limiting
│   │   ├── metrics.py            # In-memory metrics
│   │   └── main.py               # App entrypoint
│   ├── Dockerfile
│   ├── railway.toml
│   └── requirements.txt
│
├── frontend/
│   ├── app/
│   │   ├── page.tsx              # Landing page
│   │   ├── research/page.tsx     # Agent timeline
│   │   ├── report/[session_id]/  # Report + chat split view
│   │   └── api/
│   │       ├── research/route.ts # SSE proxy (hides API key)
│   │       └── chat/route.ts     # SSE proxy
│   ├── components/
│   │   ├── report/
│   │   │   ├── ReportPanel.tsx
│   │   │   ├── CitationBadge.tsx
│   │   │   └── ReportSkeleton.tsx
│   │   └── chat/
│   │       ├── ChatPanel.tsx
│   │       ├── ChatMessage.tsx
│   │       ├── OutOfDomainCard.tsx
│   │       └── WebSearchOffer.tsx
│   ├── hooks/
│   │   ├── useResearch.ts        # SSE stream + reconnect logic
│   │   └── useChat.ts            # Chat state + all event types
│   └── lib/
│       ├── api.ts                # sendChatMessage, startResearch
│       ├── types.ts              # Report, ChatMessage, AgentEvent
│       └── utils.ts              # cn, truncateText, storageKeys
│
└── .github/workflows/
    └── backend.yml               # CI: test → deploy to Railway on main
```

---

## Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+
- OpenAI API key
- Pinecone account + index
- Tavily API key
- LangSmith account (optional, for tracing)

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# Fill in your API keys in .env

uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install

# Create .env.local
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
echo "NEXT_PUBLIC_API_KEY=your_api_key" >> .env.local

npm run dev
```

### Environment Variables

**Backend (.env)**
```
OPENAI_API_KEY=
PINECONE_API_KEY=
PINECONE_INDEX_NAME=deep-dive
TAVILY_API_KEY=
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=
LANGCHAIN_PROJECT=deep-dive
ENVIRONMENT=development
API_KEY=
FRONTEND_URL=http://localhost:3000
```

**Frontend (.env.local)**
```
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_API_KEY=
```

---

## Deployment

### Backend → Railway
1. Connect GitHub repo to Railway
2. Set root directory to `backend`
3. Builder: Dockerfile
4. Add all environment variables
5. Set `ENVIRONMENT=production` and `FRONTEND_URL` to your Vercel URL

### Frontend → Vercel
1. Connect GitHub repo to Vercel
2. Set root directory to `frontend`
3. Framework: Next.js (auto-detected)
4. Add `NEXT_PUBLIC_API_URL` (Railway URL) and `NEXT_PUBLIC_API_KEY`

After both are deployed, update `FRONTEND_URL` in Railway to the live Vercel URL and redeploy.

---

## Key Design Decisions

**Why LangGraph?** The research pipeline has clear sequential stages with state that flows through all of them. LangGraph's graph model makes the pipeline explicit, observable in LangSmith, and easy to extend with new nodes.

**Why Pinecone with session namespaces?** Each research session produces a unique report. Namespacing by session_id means similarity search only returns chunks from the current report — no cross-contamination between users or sessions.

**Why cap sources before scraping (not after)?** Summarization costs a GPT-4o call per source. Capping at 15 before scraping saves ~25 GPT-4o calls per research run compared to capping at the synthesizer.

**Why a multi-route chat router instead of pure RAG?** Pure RAG fails on broad questions ("summarize the report") because generic queries don't embed close to specific chunks. The router bypasses RAG entirely for broad questions, fetching all report chunks from Pinecone and sending full context to GPT-4o.

**Why SSE instead of WebSockets?** SSE is unidirectional (server → client), stateless, and works over HTTP/1.1. Research and chat responses are purely streaming outputs — no need for bidirectional communication. SSE is simpler to proxy through Next.js API routes.

---

## Author

**Basil Arafeh** — AI Engineer  
[github.com/BasilArafeh](https://github.com/BasilArafeh)
