# VisionClaw

**A Self-Actualizing Personal AI Corporation Platform**

VisionClaw is a full-stack, multi-agent AI assistant platform built with React, TypeScript, Express, and PostgreSQL. It features streaming multi-model chat, a 12-persona agent team, autonomous background tasks, semantic memory, voice conversations, payment processing, cloud backups, a public commercial landing page, and intelligent model cost routing — all in a single deployable application.

**Total codebase**: ~11,400 lines of TypeScript across 101 files, 14 page components, 50+ API endpoints.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Dashboard and Navigation](#dashboard-and-navigation)
- [Public Landing Page](#public-landing-page)
- [Feature List](#feature-list)
  - [Multi-Conversation Streaming Chat](#multi-conversation-streaming-chat)
  - [Multi-Provider AI Routing](#multi-provider-ai-routing)
  - [Intelligent Model Cost Router](#intelligent-model-cost-router)
  - [12-Persona Agent System](#12-persona-agent-system)
  - [Agentic Tool Calling](#agentic-tool-calling)
  - [Semantic Three-Tier Memory](#semantic-three-tier-memory)
  - [Knowledge Base](#knowledge-base)
  - [Autonomous Heartbeat Engine](#autonomous-heartbeat-engine)
  - [Voice Conversations](#voice-conversations)
  - [File and Image Upload](#file-and-image-upload)
  - [Analytics Dashboard](#analytics-dashboard)
  - [Conversation Templates](#conversation-templates)
  - [Skills System](#skills-system)
  - [Inline Chart Generation](#inline-chart-generation)
  - [Smart Context Injection](#smart-context-injection)
  - [Stripe Payments](#stripe-payments)
  - [Google Drive Cloud Backup](#google-drive-cloud-backup)
  - [PIN-Based Authentication](#pin-based-authentication)
  - [Export and Import](#export-and-import)
  - [Mobile PWA Support](#mobile-pwa-support)
  - [Dark and Light Mode](#dark-and-light-mode)
  - [Discord Bot Integration](#discord-bot-integration)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [API Reference](#api-reference)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)

---

## Architecture Overview

VisionClaw is a modular monolith — frontend and backend live in one repository, deployed as a single service.

- **Frontend**: React 18 + TypeScript, styled with TailwindCSS and shadcn/ui, routed with Wouter, state-managed with TanStack Query v5.
- **Backend**: Express.js + TypeScript, using Drizzle ORM over PostgreSQL, with SSE (Server-Sent Events) for real-time streaming.
- **Shared**: A common `shared/schema.ts` defines all database tables, Zod validation schemas, and TypeScript types used by both frontend and backend.

The application serves both the Vite-built frontend and the Express API on a single port (5000). AI responses stream in real-time via SSE, tool calls execute server-side with multi-round loops, and the heartbeat engine runs autonomous background tasks on configurable cron schedules.

### Routing Architecture

The app has two distinct presentation modes:

1. **Public pages** (`/landing`, `/signup`, `/login`) — full-width standalone layouts without sidebar, accessible without authentication
2. **App pages** (everything else) — sidebar navigation layout with authentication gate

When a user visits the site:
- **Unauthenticated** (PIN enabled) — sees the public landing page. Can navigate to Sign In or Sign Up.
- **Authenticated** (or no PIN set) — goes directly to the dashboard. Can still access `/landing` for the marketing page.

---

## Dashboard and Navigation

### Home Dashboard (`/`)

The home dashboard is the central hub showing:

- **Stats cards** — total conversations, messages, memories, and system uptime
- **Conversation templates** — 10 pre-built templates as clickable cards for one-click conversation starts (Weekly Business Review, Code Review, Email Drafting, Brainstorming, Content Strategy, and more)
- **Agent activity feed** — the last 10 heartbeat execution logs showing which agents ran, what they did, and their status
- **Quick start** — new conversation button and recent conversations

### Sidebar Navigation

The sidebar is the primary navigation for the authenticated application and includes:

| Section | Page | Description |
|---------|------|-------------|
| **Home** | `/` | Dashboard with stats, templates, and activity feed |
| **Conversations** | `/chat/:id` | Chat threads with search, create, and delete |
| **Personas** | `/personas` | 12-persona agent management with full CRUD and 8 document fields |
| **Memory** | `/memory` | Long-term memory entries with search, edit, and category filtering |
| **Knowledge** | `/knowledge` | Permanent knowledge base with priority and persona scoping |
| **Heartbeat** | `/heartbeat` | Autonomous task scheduler with logs, templates, and controls |
| **Skills** | `/skills` | 50+ toggleable agent capabilities organized by category |
| **Analytics** | `/analytics` | Recharts-powered usage analytics with charts and KPIs |
| **Payments** | `/payments` | Stripe product catalog and transaction history |
| **Settings** | `/settings` | API keys, PIN auth, agent config, export/import, cloud backup |
| **Log Out** | — | Clears session token (visible only when PIN auth is active) |
| **Install App** | — | PWA install button (visible when browser supports it) |

The sidebar also includes:
- **Conversation list** with grouped headers (Today, Yesterday, This Week, Older)
- **Full-text search** with 300ms debounce and match snippets
- **Infinite scroll** with Load More pagination
- **New conversation button** at the top

---

## Public Landing Page

The landing page at `/landing` (and `/` for unauthenticated visitors) is a full-width, standalone marketing page that showcases VisionClaw's capabilities and commercial offering.

### Navigation Bar

Sticky top nav with:
- **VisionClaw logo** — links to top of page
- **Section tabs** — Demo, Agents, Features, Pricing (smooth-scroll to each section)
- **Sign In** — navigates to PIN login page
- **Sign Up** — navigates to plan selection and registration
- **Theme toggle** — dark/light mode switch

### Sections

1. **Hero** — "The AI Corporation Platform" headline, "Platform Online" live badge, Get Started and View Demo CTAs
2. **Live Activity Demo** — animated simulation showing the AI corporation in action:
   - Real-time agent activity feed with events cycling every 3.2 seconds
   - Color-coded by type: blue (tasks), green (revenue), amber (delegations), purple (memory), cyan (intel)
   - Revenue badges showing dollar amounts (+$18.4K, +$12.5K, etc.)
   - Four live-updating stat cards: Revenue Generated, Tasks Completed, Agent Delegations, Memories Stored
   - "Live Simulation" badge with animated green indicator
   - Accessible: `aria-live="polite"` log region, `prefers-reduced-motion` support
3. **Agent Team Showcase** — grid of all 12 personas with names, roles, and icons
4. **Features Grid** — 6 key capabilities: Multi-Agent Team, Autonomous Operations, Semantic Memory, Voice Conversations, Analytics Dashboard, Payment Processing
5. **Live Platform Stats** — real numbers from `/api/public/stats` (conversations, messages, autonomous tasks, memories, uptime) refreshed every 30 seconds
6. **Pricing** — 3 tiers with feature comparison:
   - **Starter** ($29/mo) — 1 persona, 100 conversations/mo, basic memory
   - **Pro** ($99/mo, highlighted) — 5 personas, unlimited conversations, full memory + voice
   - **Enterprise** ($299/mo) — Full 12-agent team, autonomous heartbeat, analytics, priority support
7. **Footer CTA** — "Ready to build your AI corporation?" with Get Started Now button
8. **Footer** — copyright and branding

### Sign Up Page (`/signup`)

- Plan selection with 3 clickable cards (Pro pre-selected with "Popular" badge)
- Name and email form fields
- "Continue to Payment" button — connects to Stripe Checkout
- Inline error handling (stays on page with clear messages if checkout fails)
- Cross-links to Sign In for existing users
- Back arrow to return to landing page

### Sign In Page (`/login`)

- PIN entry form with "Welcome Back" heading
- Back arrow to return to landing page
- Cross-link to Sign Up for new users
- Error display for invalid PIN attempts

---

## Feature List

### Multi-Conversation Streaming Chat

The core chat interface supports unlimited concurrent conversations, each with its own model selection, persona assignment, and full message history.

- **Real-time streaming** via Server-Sent Events (SSE) — tokens appear as they're generated
- **Markdown rendering** with syntax highlighting, LaTeX math, and code blocks
- **Thinking mode** — "Think then Act" reasoning displays step-by-step thoughts in a collapsible block before the final answer
- **Conversation management** — create, rename, delete, and search conversations
- **Message actions** — copy to clipboard, view raw content
- **Auto-titling** — conversations are automatically named based on the first message
- **Abort generation** — stop a response mid-stream with a cancel button

### Multi-Provider AI Routing

VisionClaw routes requests across 6+ AI providers with dynamic model discovery and cost tier indicators.

| Provider | Models | Connection |
|----------|--------|------------|
| **OpenAI** | GPT-4o, GPT-4.1, o3-mini, GPT-5.1 | Replit AI Integrations |
| **Anthropic** | Claude 3.5 Sonnet, Claude 4 Opus | Replit AI Integrations |
| **Google** | Gemini 2.0, Gemini 2.5 Pro | Replit AI Integrations |
| **xAI** | Grok-3, Grok-3-mini | Direct API key |
| **Perplexity** | Sonar, Sonar Pro | Direct API key |
| **OpenRouter** | Any model on OpenRouter | Direct API key |

- Dynamic model list fetched from each provider's API
- Cost tier badges (Free, Low, Medium, High, Premium) displayed per model
- Per-conversation model selection — switch models mid-conversation
- Provider API key management UI in Settings with connection testing
- Automatic fallback if a provider is unavailable

### Intelligent Model Cost Router

The heartbeat engine includes an intelligent cost routing system that automatically assigns the cheapest appropriate model to each autonomous task based on the persona's cost tier.

| Tier | Personas | Default Model | Use Case |
|------|----------|---------------|----------|
| **Fast** ($) | Radar, Atlas, Scribe, Chief of Staff | gpt-5-nano | Background scans, metrics, content drafts, routing |
| **Balanced** ($$) | Apollo, Forge, Proof | gpt-5-mini | Revenue analysis, engineering, content review |
| **Powerful** ($$$) | VisionClaw, Felix, Neptune | Conversation model | Complex reasoning, strategy, deep research |

- `resolveTaskModel()` in heartbeat.ts applies routing at execution time
- User-created tasks keep their explicit model selection (no override)
- System/persona-created tasks are routed to the optimal cost tier
- Heartbeat logs record the effective (routed) model for accurate cost analytics
- Atlas's cost analysis shows real savings from model routing

### 12-Persona Agent System

Every AI interaction is shaped by a **persona** — a structured identity configuration with 8 document fields that compose the system prompt.

#### Persona Document Fields

| Field | Purpose |
|-------|---------|
| **Soul** | Voice, tone, personality, and core values |
| **Identity** | Mission statement, scoreboard (success metrics), archetype |
| **Memory Doc** | Persona-specific preferences, guardrails, and rules |
| **Operating Loop** | Step-by-step execution protocol (e.g., Clarify, Plan, Execute, Verify) |
| **Heartbeat Doc** | Scheduled task instructions and daily routines |
| **Tools Doc** | Rules and preferences for tool usage |
| **Agents Doc** | Chain of command and cross-agent communication rules |
| **Brand Voice Doc** | Writing style, vocabulary, and brand consistency guidelines |

#### Default Persona Roster

| Persona | Role | Specialty |
|---------|------|-----------|
| **VisionClaw** | Personal Assistant | Default conversational agent |
| **Felix** | CEO | Revenue growth, high-leverage execution |
| **Forge** | Staff Engineer | Code quality, reliability, engineering standards |
| **Teagan** | Content Marketing | Content strategy and sharp copy |
| **Chief of Staff** | Operations Director | Task routing, chain of command hub |
| **Scribe** | Content Creator | Blog posts, social media, email drafts |
| **Proof** | Content Reviewer | Quality gate — approves/revises Scribe's output |
| **Radar** | Intelligence Analyst | Daily surface scans, trend detection |
| **Neptune** | Deep Research | Activated on Radar escalation for deep analysis |
| **Apollo** | Revenue & Pipeline | Sales tracking, deal progression |
| **Atlas** | Metrics & Reporting | ROI tracking, cost analysis, dashboards |
| **Agent Blueprint** | Multi-Agent Operator | Agent orchestration and coordination |

- **Quick-switch dropdown** in chat header to change persona without leaving the conversation
- **Chain of command enforcement** — Neptune only activates via Radar; no direct CEO access
- **Content two-gate rule** — Scribe drafts content, Proof must review before shipping
- Full CRUD for creating custom personas with all 8 document fields

### Agentic Tool Calling

The AI can invoke 15 server-side tools with multi-round execution loops. Tool calls stream as real-time SSE events showing the tool name, arguments, and results inline in the chat.

| Tool | Description |
|------|-------------|
| `test_api_keys` | Tests all configured provider API keys for connectivity and latency |
| `check_system_status` | Returns system health: uptime, counts, memory stats, heartbeat status |
| `list_models` | Lists all available models across all configured providers |
| `search_memory` | Searches long-term memory for stored facts about the user |
| `create_memory` | Stores a new fact in long-term memory |
| `update_memory` | Updates or archives an existing memory entry |
| `search_knowledge` | Searches the permanent knowledge base |
| `create_knowledge` | Adds a new entry to the knowledge base |
| `get_daily_notes` | Retrieves activity logs for a specific date or the last 7 days |
| `write_daily_note` | Logs events, decisions, or lessons to today's daily notes |
| `list_conversations` | Lists recent conversations with titles and metadata |
| `web_fetch` | Fetches clean text content from a URL (via Jina AI reader) |
| `web_search` | Searches the web via Wikipedia and Jina AI |
| `generate_chart` | Creates inline interactive charts (bar, line, pie, area) in chat |
| `delegate_task` | Delegates a task to another persona via the heartbeat system |

- Multi-round tool loops — the AI can chain multiple tool calls in sequence
- SSRF protection on web_fetch and web_search
- Tool results rendered inline with collapsible detail sections

### Semantic Three-Tier Memory

VisionClaw maintains persistent memory about the user across all conversations using a hybrid retrieval system.

- **Durable Facts** — long-term memories categorized as preferences, relationships, milestones, or status updates
- **Daily Notes** — date-scoped activity logs with sections for events, decisions, lessons, and tomorrow's plan
- **Auto-extraction** — the system automatically extracts memorable facts from conversations
- **Semantic search** — vector embeddings via OpenAI `text-embedding-3-small` with keyword fallback
- **Recency tiers** — memories are ranked as Hot (< 7 days), Warm (7-30 days), or Cold (> 30 days)
- **Memory lifecycle** — automatic archival of expired/stale entries during maintenance cycles
- **Token budget controls** — memory injection into system prompts respects configurable token limits
- **Persona scoping** — memories can be scoped to specific personas
- **Manual management** — add, edit, search, and delete memories through the Memory page

### Knowledge Base

A permanent, structured reference library distinct from the fluid memory system.

- Entries have title, content, category (insight, decision, plan, reference), and priority (1-5)
- Hybrid ranking combines semantic similarity with priority weighting
- Persona-scoped — knowledge can be assigned to specific agents
- Full CRUD with category and persona filtering
- Injected into system prompts during chat for contextual grounding

### Autonomous Heartbeat Engine

A background task engine that enables personas to work independently on schedules, delegate to each other, and maintain their own state.

- **Cron-based scheduling** — tasks run on configurable cron expressions (e.g., every 30 minutes, daily at 9 AM)
- **60-second tick loop** — checks for due tasks every minute
- **Maintenance cycles** — every 10 ticks, archives expired memories and prunes old logs
- **Multi-round execution** — tasks build full context (memory, notes, knowledge, other agent status) before executing
- **Intelligent cost routing** — automatically assigns cheapest appropriate model based on persona tier

#### Supported Task Types

| Type | Behavior |
|------|----------|
| `routine` | General-purpose scheduled tasks |
| `daily_planning` | Generates daily notes based on previous activity |
| `reflection` | Analyzes recent activity to update internal state |
| `memory_consolidation` | Reviews and archives stale memories, creates new facts |
| `knowledge` | Extracts structured insights and saves to knowledge base |
| `model_scout` | Analyzes available AI models and recommends configurations |
| `delegation` | Tasks created by one agent for another |
| `content` | Content creation (triggers Scribe-to-Proof review workflow) |
| `content_review` | Quality review of content before shipping |
| `cloud_backup` | Automated Google Drive backup |

- **One-click task templates** — pre-built configurations for 6 agents (Radar, Chief of Staff, Apollo, Forge, Atlas, Scribe)
- **Self-task creation** — agents can schedule follow-up tasks for themselves
- **Cross-agent delegation** — agents delegate work via structured JSON blocks
- **Chain of command** — hierarchical routing enforced (e.g., Neptune activates only via Radar)
- **Activity feed** — last 10 execution logs shown on the home dashboard

### Voice Conversations

Full voice input and output powered by ElevenLabs via Replit Connectors.

- **Speech-to-text** — mic button records audio, transcribed via ElevenLabs Scribe
- **Text-to-speech** — AI responses played back using ElevenLabs Flash v2.5
- **Audio streaming** — PCM16 audio streamed via SSE with AudioWorklet playback
- **TTS toggle** — persisted in localStorage, enable/disable per session
- **Multiple voices** — voice selection from available ElevenLabs voices

### File and Image Upload

Chat supports file and image attachments with multimodal AI processing.

- **Supported image formats**: PNG, JPG, GIF, WebP
- **Supported file formats**: TXT, MD, CSV, JSON, PDF
- **Max file size**: 10MB per file
- **Image handling**: Sent to vision-capable models as base64 multimodal content
- **Secure storage**: Files stored in `uploads/` with cryptographic filenames
- **Attachment preview**: Thumbnails shown in chat before sending
- **Auth-aware serving**: Upload URLs include auth tokens for PIN-protected instances

### Analytics Dashboard

A dedicated `/analytics` page with Recharts-powered visualizations of AI usage patterns.

- **Messages per day** — area chart showing daily message volume
- **Model usage** — pie chart breaking down which models are used most
- **Hourly activity** — bar chart showing peak usage hours
- **Tool usage** — ranked bar chart of most-used agentic tools
- **KPI cards** — total conversations, total messages, and period summaries
- All data computed via SQL `GROUP BY` queries for performance

### Conversation Templates

10 pre-built templates for common workflows, shown as a card grid on the home dashboard.

- Weekly Business Review, Code Review, Email Drafting, Brainstorming, Content Strategy, and more
- One-click start — creates a new conversation with pre-configured model, persona, and starter messages
- System prompt prefix injection for specialized behavior
- Full CRUD — create, edit, and delete custom templates

### Skills System

Over 50 toggleable agent capabilities that inject specialized prompt content into the system prompt.

- Organized by category: Reasoning, Writing, Coding, Research, Marketing, Operations
- Toggle switches to enable/disable individual skills
- 34+ enhanced skills with dedicated prompt content (e.g., Vibe Marketing, Browser Automation, Caption Generation, Coding Agent Loops)
- Skills are injected into the system prompt at chat time when enabled

### Inline Chart Generation

The AI can generate interactive charts directly in chat messages using the `generate_chart` tool.

- **Chart types**: Bar, Line, Pie, Area
- **Rendered inline** using Recharts with responsive containers
- **Supports both** tool-call output and ` ```chart ``` ` code blocks in message text
- **Customizable** colors, axis keys, and titles

### Smart Context Injection

New chat screens display a contextual greeting card with relevant information.

- Time-of-day greeting with active persona info
- Recent conversations for quick context
- Remembered facts about the user
- Dismissible card that hides once you start chatting
- Backend injects temporal context (day, time, season) into system prompts

### Stripe Payments

Full payment processing integrated via Stripe and Replit Connectors.

- **Product catalog** — create products with one-time or subscription pricing
- **3 subscription tiers** — Starter ($29/mo), Pro ($99/mo), Enterprise ($299/mo)
- **Stripe Checkout** — generates checkout sessions for seamless payment
- **Transaction history** — view recent payment intents and their status
- **Webhook-driven sync** — automatic data synchronization via Stripe webhooks
- **Payments page** at `/payments` with product cards and transaction table
- **Public checkout** — rate-limited (5 requests/min/IP) public endpoint for signup flow
- **Product seeding** — auth-protected endpoint to create tier products in Stripe

### Google Drive Cloud Backup

Automated full-system backup to Google Drive.

- **Daily automated backups** at 3 AM UTC via heartbeat task
- **Complete data export** — conversations, messages, memories, knowledge, personas, settings, skills, heartbeat data
- **Stored as JSON** in a `VisionClaw Backups` folder on Google Drive
- **30-backup retention** with automatic cleanup of older files
- **Manual backup** via "Backup to Google Drive" button in Settings

### PIN-Based Authentication

Optional security layer for protecting the entire application.

- HMAC-SHA256 hashed PIN with salt
- 7-day session tokens stored in localStorage
- All API routes protected when PIN is configured
- Centralized `authFetch` helper ensures every client-side request includes auth headers
- Auth-aware file serving with query parameter token support for images
- Log Out button in sidebar (visible only when PIN auth is active)
- Unauthenticated users see the public landing page instead of a blank login screen

### Export and Import

Full data portability for backup and migration.

- **Export** (`GET /api/export`) — downloads all data as a JSON file with API keys redacted
- **Import** (`POST /api/import`) — restores data from an export file
- Available in the Settings page with one-click buttons

### Mobile PWA Support

VisionClaw is installable as a Progressive Web App on mobile devices.

- `manifest.json` with app name, icons (192px and 512px), and theme colors
- Service worker (`sw.js`) with network-first caching strategy
- Apple-specific meta tags for iOS home screen support
- Viewport optimization for mobile screens
- "Install App" button in sidebar (appears when browser supports installation)

### Dark and Light Mode

Full theme support with system-aware defaults.

- Toggle switch in the sidebar and on the landing page
- CSS custom properties for all color tokens
- Dark class applied to `<html>` element
- Persisted in localStorage across sessions

### Discord Bot Integration

Optional Discord bot that mirrors the AI chat experience to Discord channels.

- Bot token configured in Settings
- Status endpoint at `GET /api/discord/status`
- Responds to Discord messages using the active persona and model configuration

---

## Tech Stack

### Frontend
| Technology | Purpose |
|-----------|---------|
| React 18 | UI framework |
| TypeScript | Type safety |
| TailwindCSS | Utility-first styling |
| shadcn/ui | Component library |
| Wouter | Client-side routing |
| TanStack Query v5 | Server state management |
| Recharts | Data visualization |
| ReactMarkdown | Markdown rendering |
| Lucide React | Icon library |

### Backend
| Technology | Purpose |
|-----------|---------|
| Express.js | HTTP server |
| TypeScript | Type safety |
| Drizzle ORM | Database queries and schema |
| Zod | Request validation |
| SSE | Real-time streaming |
| cron-parser v5 | Heartbeat scheduling |

### Infrastructure
| Technology | Purpose |
|-----------|---------|
| PostgreSQL | Primary database |
| Replit AI Integrations | OpenAI, Anthropic, Google model access |
| Replit Connectors | ElevenLabs, Stripe, Google Drive |
| Vite | Frontend build tool |

---

## Project Structure

```
VisionClaw/
├── client/
│   ├── src/
│   │   ├── pages/                # 14 page components
│   │   │   ├── home.tsx          # Dashboard with stats, templates, activity feed
│   │   │   ├── chat.tsx          # Chat interface with streaming, tools, voice
│   │   │   ├── analytics.tsx     # Usage analytics with Recharts
│   │   │   ├── personas.tsx      # 12-persona management with 8 doc fields
│   │   │   ├── memory.tsx        # Semantic memory with search and edit
│   │   │   ├── knowledge.tsx     # Knowledge base with priority and filtering
│   │   │   ├── skills.tsx        # 50+ toggleable agent skills
│   │   │   ├── heartbeat.tsx     # Autonomous task scheduler and logs
│   │   │   ├── payments.tsx      # Stripe products and transactions
│   │   │   ├── settings.tsx      # Global config, API keys, export/import
│   │   │   ├── landing.tsx       # Public landing page with demo and pricing
│   │   │   ├── signup.tsx        # Plan selection and registration
│   │   │   ├── login.tsx         # PIN authentication
│   │   │   └── not-found.tsx     # 404 page
│   │   ├── components/
│   │   │   ├── app-sidebar.tsx   # Main navigation sidebar with logout
│   │   │   ├── error-state.tsx   # Reusable error component
│   │   │   ├── theme-provider.tsx # Dark/light mode provider
│   │   │   ├── theme-toggle.tsx  # Theme switch button
│   │   │   └── ui/              # shadcn/ui components
│   │   ├── lib/
│   │   │   ├── queryClient.ts    # TanStack Query + authFetch + apiRequest
│   │   │   ├── auth.tsx          # Auth context provider (login, logout, token)
│   │   │   └── utils.ts          # Utility functions
│   │   ├── hooks/
│   │   │   └── use-toast.ts      # Toast notifications
│   │   ├── App.tsx               # Router, layout, AuthGate
│   │   └── main.tsx              # Entry point
│   └── public/
│       ├── sw.js                 # Service worker
│       ├── manifest.json         # PWA manifest
│       └── icons/                # App icons
├── server/
│   ├── index.ts                  # Express server entry
│   ├── routes.ts                 # All API route definitions (50+ endpoints)
│   ├── storage.ts                # Database access layer (IStorage interface)
│   ├── chat-engine.ts            # AI chat logic, streaming, system prompt building
│   ├── providers.ts              # Multi-provider model routing and discovery
│   ├── tools.ts                  # 15 agentic tool definitions
│   ├── heartbeat.ts              # Autonomous task engine with cost router
│   ├── embeddings.ts             # Vector embedding generation
│   ├── auth.ts                   # PIN authentication with HMAC-SHA256
│   ├── voice.ts                  # ElevenLabs voice integration
│   ├── seed.ts                   # Database seeding (personas, skills, templates, tasks)
│   ├── db.ts                     # Database connection
│   ├── cron-utils.ts             # Cron expression utilities
│   └── vite.ts                   # Vite dev server integration
├── shared/
│   └── schema.ts                 # Database schema + Zod types (13 tables)
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
└── drizzle.config.ts
```

---

## Database Schema

VisionClaw uses 13 PostgreSQL tables managed by Drizzle ORM.

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `personas` | Agent identity configurations | name, role, soul, identity, operatingLoop, + 5 more doc fields |
| `conversations` | Chat sessions | title, model, thinking, personaId |
| `messages` | Chat messages | conversationId, role, content |
| `memory_entries` | Long-term durable facts | fact, category, status, embedding, accessCount, expiresAt |
| `daily_notes` | Date-scoped activity logs | date, content, personaId |
| `agent_knowledge` | Permanent knowledge base | title, content, category, priority, embedding |
| `agent_settings` | Global configuration | agentName, personality, defaultModel, accessPin |
| `skills` | Toggleable capabilities | name, description, enabled, promptContent |
| `provider_keys` | AI provider API keys | provider, apiKey, baseUrl, enabled |
| `heartbeat_tasks` | Scheduled background tasks | name, cronExpression, promptContent, model, personaId, createdBy |
| `heartbeat_logs` | Task execution history | taskName, status, output, model, durationMs |
| `conversation_templates` | Pre-built chat templates | name, systemPromptPrefix, starterMessages |
| `users` | Authentication accounts | username, password |

---

## API Reference

### Public Endpoints (No Auth Required)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/public/stats` | Live platform stats (conversations, messages, tasks, memories, uptime) |
| GET | `/api/public/stripe/products` | Stripe product catalog with prices |
| POST | `/api/public/stripe/checkout` | Create Stripe checkout session (rate-limited: 5/min/IP) |

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Authenticate with PIN |
| GET | `/api/auth/status` | Check session status and auth requirement |

### Conversations
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/conversations` | List conversations (paginated: limit, offset) |
| POST | `/api/conversations` | Create new conversation |
| GET | `/api/conversations/:id` | Get conversation with messages |
| PATCH | `/api/conversations/:id` | Update conversation (title, model, persona, thinking) |
| DELETE | `/api/conversations/:id` | Delete conversation and its messages |
| POST | `/api/conversations/:id/messages` | Send message (SSE stream response) |
| GET | `/api/search` | Search conversations and messages (q parameter) |

### Personas
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/personas` | List all personas |
| GET | `/api/personas/active` | Get active persona |
| POST | `/api/personas` | Create persona |
| GET | `/api/personas/:id` | Get persona details |
| PATCH | `/api/personas/:id` | Update persona |
| DELETE | `/api/personas/:id` | Delete persona |
| POST | `/api/personas/:id/activate` | Set active persona |

### Memory
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/memory` | List memory entries (paginated) |
| POST | `/api/memory` | Create memory entry |
| PATCH | `/api/memory/:id` | Update memory entry |
| DELETE | `/api/memory/:id` | Delete memory entry |
| GET | `/api/memory/stats` | Memory statistics (total, by category, by status) |
| POST | `/api/memory/backfill-embeddings` | Generate missing vector embeddings |

### Knowledge
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/knowledge` | List knowledge entries (paginated) |
| POST | `/api/knowledge` | Create knowledge entry |
| PATCH | `/api/knowledge/:id` | Update knowledge entry |
| DELETE | `/api/knowledge/:id` | Delete knowledge entry |

### Daily Notes
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/daily-notes` | List all daily notes |
| GET | `/api/daily-notes/:date` | Get note by date |
| PUT | `/api/daily-notes/:date` | Create or update note |

### Heartbeat
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/heartbeat/tasks` | List scheduled tasks |
| POST | `/api/heartbeat/tasks` | Create task |
| PATCH | `/api/heartbeat/tasks/:id` | Update task |
| DELETE | `/api/heartbeat/tasks/:id` | Delete task |
| GET | `/api/heartbeat/logs` | Task execution logs |
| GET | `/api/heartbeat/status` | Engine status (running, task count, next runs) |
| POST | `/api/heartbeat/start` | Start engine |
| POST | `/api/heartbeat/stop` | Stop engine |
| POST | `/api/heartbeat/delegate` | Delegate task from chat |

### Settings and Providers
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/settings` | Get global settings |
| PUT | `/api/settings` | Update settings |
| GET | `/api/models` | List available AI models across all providers |
| GET | `/api/provider-keys` | List provider keys (masked) |
| PUT | `/api/provider-keys/:provider` | Set provider API key |
| DELETE | `/api/provider-keys/:provider` | Remove provider key |
| POST | `/api/provider-keys/test` | Test provider connectivity |

### Files and Voice
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/upload` | Upload file (max 10MB) |
| GET | `/uploads/:filename` | Serve uploaded file (auth-aware) |
| POST | `/api/voice/conversations/:id/messages` | Voice message (STT + AI + TTS) |
| GET | `/api/voice/voices` | List available ElevenLabs voices |

### Stripe Payments
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stripe/publishable-key` | Get Stripe public key |
| GET | `/api/stripe/products` | List products and prices |
| POST | `/api/stripe/checkout` | Create checkout session (authenticated) |
| POST | `/api/stripe/create-product` | Create product |
| POST | `/api/stripe/seed-products` | Seed Starter/Pro/Enterprise products (auth-protected) |
| GET | `/api/stripe/payments` | Transaction history |

### Templates and Skills
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/templates` | List templates |
| POST | `/api/templates` | Create template |
| PATCH | `/api/templates/:id` | Update template |
| DELETE | `/api/templates/:id` | Delete template |
| POST | `/api/templates/:id/start` | Start conversation from template |
| GET | `/api/skills` | List skills |
| PATCH | `/api/skills/:id` | Toggle skill |

### System
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stats` | System statistics (authenticated) |
| GET | `/api/analytics` | Usage analytics data |
| GET | `/api/context/summary` | Context summary for new chats |
| GET | `/api/discord/status` | Discord bot status |
| POST | `/api/backup/cloud` | Trigger Google Drive backup |
| GET | `/api/export` | Export all data as JSON |
| POST | `/api/import` | Import data from JSON |

---

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL database
- At least one AI provider API key (OpenAI, Anthropic, Google, xAI, Perplexity, or OpenRouter)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up the database:
   ```bash
   npm run db:push
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```
5. Open `http://localhost:5000` in your browser

### First-Time Setup

1. Navigate to **Settings** and configure your AI provider API keys
2. (Optional) Set a PIN for authentication — this enables the public landing page and Sign In/Sign Up flow
3. (Optional) Configure ElevenLabs for voice, Stripe for payments, or Google Drive for backups
4. Start chatting — the default VisionClaw persona is ready to go

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `SESSION_SECRET` | Yes | Session signing secret |
| `REPLIT_CONNECTORS_HOSTNAME` | Auto | Replit Connectors host (auto-injected) |
| `REPL_IDENTITY` | Auto | Replit identity token (auto-injected) |

AI provider keys are stored in the database via the Settings page — not as environment variables. This allows runtime configuration without redeployment.

---

Built with care on [Replit](https://replit.com).
