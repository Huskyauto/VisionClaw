---
name: three-tier-memory
description: Persistent three-layer memory system for OpenClaw agents — knowledge graph (PARA method), daily notes timeline, and tacit knowledge. Use when setting up long-term memory, fact extraction, memory decay, entity tracking, or structured recall across sessions.
---

# Three-Tier Memory System

A structured approach to agent memory that scales. Three layers serve different purposes — durable facts, chronological events, and user patterns.

## Quick Setup

### 1. Create the directory structure

```
~/life/                          # Layer 1: Knowledge Graph (PARA)
├── projects/                    # Active work with goals/deadlines
│   └── <name>/
│       ├── summary.md           # Quick context (load first)
│       └── items.json           # Atomic facts (load when needed)
├── areas/                       # Ongoing responsibilities
│   ├── people/<name>/
│   └── companies/<name>/
├── resources/                   # Reference material, topics
│   └── <topic>/
├── archives/                    # Inactive items
└── index.md

memory/                          # Layer 2: Daily Notes
└── YYYY-MM-DD.md                # One file per day

MEMORY.md                        # Layer 3: Tacit Knowledge
```

### 2. Configure memory search

Set `memory.backend = "qmd"` in your OpenClaw config to enable semantic search across all layers. Add your `~/life/` directory as an indexed path.

### 3. Add heartbeat extraction

Add a fact extraction step to your HEARTBEAT.md so durable facts flow from conversations into the knowledge graph automatically.

## Layer 1: Knowledge Graph (`~/life/`)

Entity-based storage organized by the PARA method:

- **Projects** → Active work with a goal/deadline. Move to archives when done.
- **Areas** → Ongoing responsibilities (people, companies). No end date.
- **Resources** → Reference material, topics of interest.
- **Archives** → Inactive items from any category.

### Tiered Retrieval

1. Load `summary.md` first — quick context.
2. Load `items.json` when you need specific facts.

### When to Create an Entity

- Mentioned 3+ times, OR
- Has direct relationship to the user (family, coworker, client), OR
- Significant project/company in the user's life.
- Otherwise, just note in daily notes.

### Atomic Fact Schema (`items.json`)

```json
{
  "id": "entity-001",
  "fact": "The actual fact",
  "category": "relationship|milestone|status|preference",
  "timestamp": "YYYY-MM-DD",
  "source": "YYYY-MM-DD",
  "status": "active|superseded",
  "supersededBy": "entity-002",
  "relatedEntities": ["companies/acme", "people/jane"],
  "lastAccessed": "YYYY-MM-DD",
  "accessCount": 0
}
```

### Fact Rules

- Save durable facts immediately to `items.json`.
- Weekly: rewrite `summary.md` from active facts.
- Never delete facts — supersede instead (`status: "superseded"`, add `supersededBy`).
- When an entity becomes inactive, move its folder to `archives/`.

## Layer 2: Daily Notes (`memory/YYYY-MM-DD.md`)

Raw timeline of events — the "when" layer.

- Write continuously during conversations.
- Extract durable facts to Layer 1 during heartbeats.
- Track active processes, decisions, and context that matters today.

## Layer 3: Tacit Knowledge (`MEMORY.md`)

How the user operates — patterns, preferences, lessons learned.

- Not facts about the world; facts about the user.
- Update when you learn new operating patterns.
- Examples: communication preferences, tool choices, decision-making style, security rules.

## Memory Decay & Recency Weighting

Facts decay in retrieval priority over time. This prevents stale info from crowding out recent context.

### Access Tracking

When a fact is used in conversation (retrieved, referenced in a reply):
- Bump `accessCount` and set `lastAccessed` to today.
- High `accessCount` facts resist decay — frequently used facts stay warm longer.

### Recency Tiers (for `summary.md` rewriting)

| Tier | Rule | In summary.md? |
|------|------|-----------------|
| **Hot** | Accessed in last 7 days | Yes, prominently |
| **Warm** | Accessed 8–30 days ago | Yes, lower priority |
| **Cold** | Not accessed in 30+ days | No (still in items.json) |

### Weekly Synthesis

When rewriting `summary.md`, sort facts by recency tier, then by `accessCount` within tier. Cold facts drop out of the summary but remain in `items.json`. If a cold fact becomes relevant again, accessing it reheats it.

**No deletion.** Decay only affects retrieval priority via `summary.md` curation. The full record always lives in `items.json`.

## Heartbeat Extraction Checklist

Add this to your HEARTBEAT.md:

1. Check for new conversations since last extraction.
2. Extract durable facts: relationships, status changes, milestones, preferences, decisions.
3. Skip: casual chat, temporary info, already-known facts.
4. Write facts to relevant entity in `~/life/` (PARA structure).
5. Update `memory/YYYY-MM-DD.md` with timeline entries.
6. Bump `lastAccessed` and `accessCount` on facts referenced today.

## Retrieval Pattern

Before answering anything about prior work, decisions, dates, people, preferences, or todos:

1. Run `memory_search` with a relevant query.
2. Use `memory_get` to pull only the needed lines.
3. If low confidence after search, say you checked.
4. Cite sources: `Source: <path#line>` when it helps the user verify.
