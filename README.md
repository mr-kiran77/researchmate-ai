# ResearchMate AI

> **"Research Smarter. Discover Faster. Make Better Decisions."**

ResearchMate AI is an autonomous, multi-source AI research assistant built with **React + Vite + Tailwind CSS + Recharts** and **Python + FastAPI + PyMuPDF + SQLite**. Rather than behaving like a generic chatbot, ResearchMate AI acts as a structured research agent: it analyzes questions into sub-questions, retrieves evidence across multiple independent source types, cross-checks claims, exposes conflicting information without hiding disagreements, synthesizes a 14-section report with clickable citations and PDF export, and powers a context-aware follow-up research chat.

---

## Key Features

1. **AI Research Question Analyzer**: Breaks any research question into a structured Research Objective, decomposed Sub-Questions (`SQ1..SQN`), required evidence specifications, and an editable/previewable execution plan.
2. **Multi-Source Research Engine**: Independently searches each sub-question across:
   - **Web Search** (Tavily Search API when `TAVILY_API_KEY` is configured, plus live Wikipedia & DuckDuckGo retrieval)
   - **Academic Research Papers** (OpenAlex & arXiv APIs)
   - **Uploaded PDF Documents** (PyMuPDF page-level extraction & search)
   - **Knowledge Base Documents** (curated & user-saved research briefs in SQLite)
   Deduplicates overlapping URLs/titles and ranks sources by relevance, credibility, and recency.
3. **AI Information Verification**: Compares claims across sources, strictly separates multi-source verified facts (`>= 2` independent corroborating sources) from single-source claims, interpretations/assumptions, outdated data, and insufficient evidence. Never marks a claim verified merely on AI generation authority.
4. **Conflict Detection System**: Dedicated **Conflicting Information** section showing side-by-side claims from Source A vs. Source B, references, possible reasons for disagreement, and a neutral explanation of what remains uncertain.
5. **14-Section Structured Report & PDF Export**: Generates all 14 required sections (Title, Executive Summary, Research Objective, Research Questions, Methodology & Sources, Key Findings, Detailed Analysis, Source Comparison + Recharts Analytics, Conflicting Information, Evidence & Citations, Limitations, Open Questions, Conclusion, References) with clickable `[S#]` source drawers and one-click PDF & Markdown download.
6. **AI Research Chat**: Persistent conversational assistant connected to the active report, sources, conflicts, and PDFs, featuring quick starter prompts.
7. **PDF Upload & Analysis**: Drag-and-drop PDF upload using PyMuPDF to extract text, summarize papers, extract findings with page citations, save to the Knowledge Base, and compare uploaded PDFs directly against web & academic sources.

---

## Setup & Running Locally

### 1. Environment Variables
Copy `.env.example` to `backend/.env` and configure any optional keys (never expose secret keys in frontend code):

```bash
cp .env.example backend/.env
```

- `GEMINI_API_KEY`: Enables Gemini (`gemini-3.8-flash` via `google-genai` Interactions API)
- `OPENAI_API_KEY`: Optional OpenAI provider (`gpt-4o-mini`)
- `TAVILY_API_KEY`: Optional Tavily Web Search API (live OpenAlex, arXiv, Wikipedia, DuckDuckGo, Knowledge Base, and PyMuPDF work even without `TAVILY_API_KEY`; without an LLM key, the transparent Evidence-Grounded Extractive Synthesizer runs instead)

### 2. Backend (FastAPI)

```powershell
cd backend
.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

### 3. Frontend (React + Vite)

```powershell
cd frontend
npm run dev
```

Open `http://localhost:5173`.

### 4. Running Backend Tests

```powershell
backend\.venv\Scripts\python.exe -m pytest backend\tests\test_api.py -v
```
