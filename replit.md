# VisionClaw — Personal AI Assistant

## Overview
VisionClaw is a web-based personal AI assistant designed to demonstrate the potential of advanced AI integration. It features a sophisticated chat interface powered by OpenAI via Replit AI Integrations, emphasizing multi-agent delegation, structured memory, and autonomous heartbeat tasks. The project aims to provide a highly capable and customizable AI assistant experience, offering a competitive edge in the personal AI market through its modular design and extensive feature set. VisionClaw's ambition is to evolve into a leading platform for personalized AI interaction, catering to diverse user needs with a focus on efficiency, intelligence, and user-centric design.

## User Preferences
I prefer iterative development with clear communication on progress.
Ask before making major architectural changes or introducing new external dependencies.
I prefer detailed explanations for complex features or design choices.
Do not make changes to the `shared/schema.ts` file without explicit approval.
All API routes should be documented clearly.

## System Architecture

VisionClaw is built on a React + TypeScript frontend with shadcn/ui and TailwindCSS for a modern, responsive user interface supporting dark/light modes. The backend is an Express.js + TypeScript application, utilizing PostgreSQL with Drizzle ORM for data persistence.

**Core Features & Implementations:**
- **Multi-conversation chat:** Manages multiple threads with streaming AI responses via SSE.
- **Agentic Tool Calling:** Supports 14 built-in server-side tools with multi-round tool loops and SSRF protection. Tool calls stream as SSE events. Tools: `test_api_keys`, `check_system_status`, `list_models`, `search_memory`, `create_memory`, `update_memory`, `search_knowledge`, `create_knowledge`, `get_daily_notes`, `write_daily_note`, `list_conversations`, `web_fetch`, `web_search`, `delegate_task`.
- **Thinking mode:** Provides a "Think then Act" reasoning process using an LLM, displaying step-by-step thoughts in a collapsible block before the final response.
- **Model Selection & Routing:** Dynamic model list from various providers (Replit, OpenAI, Anthropic, xAI, Google, OpenRouter), with cost tier indicators.
- **Persona System:** Customizable agent personas with 8 document fields (Soul, Identity, Memory Doc, Operating Loop, Heartbeat Instructions, Tool Preferences, Agents & Delegation, Brand Voice) whose configurations are composed into the system prompt. Full 12-persona roster: VisionClaw, Felix, Forge, Teagan, Agent Blueprint, Chief of Staff, Scribe, Proof, Radar, Neptune, Apollo, Atlas.
- **Memory System:** Semantic memory with hybrid retrieval (recency + semantic similarity), auto-extracted durable facts, manual entries, and daily notes. Supports vector embeddings (OpenAI `text-embedding-3-small`) with a keyword fallback. Includes memory lifecycle management and token budget controls.
- **Knowledge Base:** Persistent agent knowledge with priority levels, persona scoping, and hybrid ranking.
- **Skills Panel:** Over 50 agent capabilities, with 34+ enhanced skills injecting prompt content into the system prompt. Includes Vibe Marketing, Browser Automation, Caption Generation, Coding Agent Loops, and all prior skills.
- **Multi-agent Heartbeat System:** Autonomous background task engine with persona-scoped execution, supporting delegation, self-task creation, and cross-agent communication. Heartbeat agents follow OpenClaw behavioral patterns: safety boundaries, anti-slop communication rules, delivery loop discipline. Includes chain-of-command enforcement (Neptune only on Radar escalation, no direct CEO access) and content two-gate rule (Scribe creates → Proof reviews before shipping).
- **OpenClaw Behavioral Patterns:** System prompt incorporates session protocol (Orient→Act→Write→Verify), Forge delivery loop (Clarify→Plan→Execute→Verify→Summarize), internal/external safety boundaries, tool discipline rules, anti-AI-slop word list, and communication etiquette from the OpenClaw Agent Ops Playbook.
- **File & Image Upload:** Chat supports file/image attachments via paperclip button. Images sent to vision-capable models as base64 multimodal content. Supports PNG/JPG/GIF/WebP images and TXT/MD/CSV/JSON/PDF files. Max 10MB per file. Stored in `uploads/` with cryptographic filenames. Attachment metadata persisted as `<!-- attachments:[...] -->` prefix in message content.
- **PIN-Based Authentication:** Optional HMAC-SHA256 hashed PIN for API route protection with 7-day sessions.
- **Input Validation:** All PATCH/PUT endpoints are validated using Zod schemas.

**UI/UX Enhancements:**
- **Conversation Search:** Full-text search across conversation titles and message content via sidebar search input. Backend `GET /api/search?q=` with SQL ILIKE.
- **Export/Import System:** Full data export as JSON (`GET /api/export`) and import (`POST /api/import`) for backup and local hosting migration prep. Available in Settings page. API keys redacted in exports.
- **Memory Search + Edit:** Client-side keyword filtering of memory facts plus inline edit dialog for updating fact text and category.
- **Persona Quick-Switch:** Dropdown in chat header to switch active persona system-wide without leaving the chat.
- **Dashboard Agent Activity Feed:** Real-time feed of last 10 heartbeat execution logs on the home dashboard.
- **Heartbeat Task Templates:** Pre-built one-click deployable task configurations for 6 agents (Radar, Chief of Staff, Apollo, Forge, Atlas, Scribe).
- **Voice Conversations (ElevenLabs):** Mic button in chat for voice input (STT via ElevenLabs Scribe), with TTS playback of AI responses using ElevenLabs Flash v2.5. Audio streamed as PCM16 via SSE with AudioWorklet playback. TTS toggle persisted in localStorage. Server routes: `POST /api/voice/conversations/:id/messages`, `GET /api/voice/voices`.
- **Stripe Payments:** Full payment processing via Replit Connectors. Product creation, pricing (one-time + subscriptions), Stripe Checkout sessions, transaction history. Uses `stripe-replit-sync` for automatic schema management and webhook-driven data sync. Payments page at `/payments`. Routes: `GET /api/stripe/products`, `POST /api/stripe/checkout`, `POST /api/stripe/create-product`, `GET /api/stripe/payments`. Webhook at `/api/stripe/webhook` (registered before express.json).
- **Google Drive Cloud Backup:** Automated daily full-system backup to Google Drive via Replit Connectors. Exports all conversations, messages, memories, knowledge, personas, settings, skills, heartbeat data to a JSON file in `VisionClaw Backups` folder. Runs daily at 3 AM UTC via heartbeat task (type: `cloud_backup`). Keeps last 30 backups with automatic cleanup. Manual backup available via `POST /api/backup/cloud` and "Backup to Google Drive" button in Settings. Google Drive connection: `conn_google-drive_01K6TCZJMABVZ9Q5WY6TKFH44C`.

**Five High-Impact Features (Integrated):**
- **Analytics Dashboard** (`/analytics`): Recharts-powered page with messages/day area chart, model usage pie chart, hourly activity bar chart, tool usage bars, and top topics. Route: `GET /api/analytics`.
- **Smart Context Injection**: Dismissible context card on new chat screens showing greeting, active persona, recent conversations, and remembered facts. Backend builds temporal context (day-of-week, time-of-day) into system prompts. Route: `GET /api/context/summary`.
- **Conversation Templates**: 10 seeded templates (Weekly Business Review, Code Review, Email Drafting, Brainstorming, etc.) shown as a grid on the home dashboard. Clicking a template creates a pre-configured conversation with starter messages. Schema: `conversationTemplates` table. Routes: `GET/POST/DELETE /api/templates`, `POST /api/templates/:id/start`.
- **Multi-Modal Chart Output**: `generate_chart` agentic tool outputs chart data as JSON. `ChartRenderer` component renders inline Recharts (bar/line/pie/area) in chat messages. Supports both tool-call output detection and ```chart``` code blocks in message text.
- **Mobile PWA**: `manifest.json`, service worker (`sw.js`) with network-first caching, `apple-mobile-web-app` meta tags, 192/512px icons, viewport optimization, and "Install App" button in sidebar (via `beforeinstallprompt` event).

**Platform Improvements (Round 2):**
- **Auth Consistency**: `/uploads/:filename` accepts `?token=xxx` query param for image rendering under PIN auth. `chat.tsx` `getAuthUrl()` helper appends token to upload URLs.
- **Pagination**: `getConversations()`, `getMemoryEntries()`, `getKnowledge()` return `PaginatedResult<T>` with `{ data, total, hasMore }`. Sidebar uses `useInfiniteQuery` with Load More button. Knowledge and Memory pages use `useInfiniteQuery` for proper page accumulation.
- **SQL-Optimized Stats**: `/api/stats` uses `COUNT(*)` SQL. `/api/analytics` uses SQL `GROUP BY` for messages/day, model usage, hourly activity. Heartbeat status batches tasks in-memory instead of N+1 per-persona queries.
- **Error State UI**: Reusable `ErrorState` component (`client/src/components/error-state.tsx`) with title, message, retry button. Added to all 9 main pages.
- **Enhanced Search**: 300ms debounce on sidebar search, backend returns match snippets (80 chars around match), result count display in sidebar.

**UI/UX Decisions:**
- Modern, responsive design using shadcn/ui components and TailwindCSS.
- Full dark/light mode support.
- Clear navigation with a sidebar for conversations and main sections (Dashboard, Chat, Settings, Skills, Personas, Memory, Knowledge, Analytics, Payments).

**System Design Choices:**
- **Modular Monolith:** Frontend and backend separated but managed within a single repository for streamlined development.
- **Event-Driven Interactions:** SSE for real-time AI response streaming and tool call indicators.
- **Context Management:** Robust system prompt construction dynamically incorporating persona configuration, memory entries, and knowledge base content within defined token budgets.
- **Asynchronous Operations:** Embedding generation and heartbeat tasks leverage asynchronous processing to avoid blocking the main request flow.

## GitHub Backup
- Repository: https://github.com/Huskyauto/VisionClaw
- Push method: GitHub API (git tree/blob/commit) using personal access token
- Token provided by user (not stored in secrets — must be re-provided if needed)

## External Dependencies

- **AI Providers:**
    - OpenAI (via Replit AI Integrations)
    - Anthropic
    - xAI (Grok)
    - Google Gemini
    - Perplexity
    - OpenRouter
- **Database:** PostgreSQL
- **Frontend Libraries:** React, TypeScript, shadcn/ui, TailwindCSS, Wouter, TanStack Query
- **Backend Libraries:** Express.js, TypeScript, Drizzle ORM, Zod
- **Payments:** stripe, stripe-replit-sync (via Replit Connectors)
- **External Services:**
    - Discord (for Discord bot integration)
    - ElevenLabs (via Replit Connectors SDK for TTS + STT voice conversations)
    - Stripe (via Replit Connectors for payment processing, product catalog, checkout)
    - Google Drive (via Replit Connectors for automated cloud backups)