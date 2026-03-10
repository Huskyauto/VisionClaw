# AI Agent Memory System
## Never lose context. Never repeat mistakes. Never forget what matters.

---

## The Problem

AI agents wake up fresh every session. No memory of yesterday's decisions, last week's mistakes, or the customer who emailed. Without a memory system, your agent is Groundhog Day — competent but perpetually starting over.

## The Three-Layer Architecture

```
Layer 1: Daily Notes (raw)     → memory/YYYY-MM-DD.md
Layer 2: Long-term Memory      → MEMORY.md  
Layer 3: Working Context       → HEARTBEAT.md, engagement-log.json, etc.
```

### Layer 1: Daily Notes

Raw logs of what happened each day. The agent writes these during operation.

```markdown
# memory/2026-03-01.md

## What Happened
- Posted 6 tweets, best performer: "Revenue: $29..." (11 impressions)
- Replied to 3 mentions (SecEngineerX99, alexabelonix, martin_delannoy)
- Deployed website update with ClawMart section
- Published Dev.to article #2
- New follower count: 16 (+4 today)

## Decisions Made
- Switched from custom Twitter scripts to xurl CLI
- Added 3 free products on ClawMart as funnel
- Updated both guides with real analytics data

## Lessons Learned
- Engagement monitor cron was posting command text as tweets (bug) — fixed
- Reply tone matters: match the energy of the person, don't be random

## Tomorrow
- Launch Product #3 (Marketing Playbook PDF)
- Build Stripe webhook for auto-delivery
```

**Rule:** Write daily notes during operation, not at the end. By then you've forgotten half of it.

### Layer 2: Long-term Memory (MEMORY.md)

The distilled, curated version. Updated periodically (not daily).

```markdown
# MEMORY.md

## Key Learnings
- Twitter: personal/funny > sales tweets. 80/20 rule.
- Pricing: $29 impulse buy works. One-time > subscription.
- Content ranking: funny > personal > build-in-public > educational > sales
- Best tweet times for US: 15:00, 17:00, 21:00, 01:00 CET

## Boundaries
- Security is #1 — credentials only in .env.local
- Products never given away free via DMs
- Ask before destructive commands

## Active Projects
- [list current projects and status]

## People
- Bryan: advisor, hands-off, wants results not proposals
- [key contacts, preferences, relationships]
```

**Review schedule:** Every 3-5 days, read through daily notes and update MEMORY.md with what's worth keeping long-term. Delete outdated info.

### Layer 3: Working Context

Small, task-specific files that change frequently:

```
HEARTBEAT.md          — periodic check tasks (inbox, calendar, mentions)
engagement-log.json   — which tweets you've already replied to
heartbeat-state.json  — when you last checked email, calendar, etc.
```

## Memory Maintenance (Heartbeat Routine)

Every few days, during a heartbeat:

1. Read recent `memory/YYYY-MM-DD.md` files
2. Identify significant events, lessons, insights
3. Update `MEMORY.md` with distilled learnings
4. Remove outdated info from MEMORY.md
5. Archive old daily files (30+ days old) if needed

Think of it like a human reviewing their journal and updating their mental model.

## Security Rules

- **MEMORY.md only in private sessions** — contains personal context
- **Never load in group chats** — could leak info to strangers
- **No raw credentials in memory files** — reference .env.local instead
- **Daily files don't log full API responses** — just summaries

## Template Files

Copy these into your agent's workspace:

### memory/YYYY-MM-DD.md template
```markdown
# memory/YYYY-MM-DD.md

## What Happened
- 

## Decisions Made
- 

## Lessons Learned
- 

## Tomorrow
- 
```

### HEARTBEAT.md template
```markdown
# HEARTBEAT.md
# Periodic checks — agent runs these during heartbeat polls

- [ ] Check email inbox (unread messages)
- [ ] Check Twitter mentions (unreplied)
- [ ] Review today's analytics
```

---

*The exact memory system behind Maduro AI. 90 days of context, zero lost.*
