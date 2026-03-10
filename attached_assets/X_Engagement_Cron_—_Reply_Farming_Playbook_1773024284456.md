---
name: engagement-cron
description: >
  Engagement farming for @Swole_CPA on X (Twitter). Finds top viral posts via
  the Creator Inspiration page, writes sharp CPA+lifter replies and quote tweets,
  posts them, and logs all actions. Load this skill for any engagement session,
  reply farming task, or when editing/creating engagement cron jobs.
triggers:
  - "engagement farming"
  - "engagement session"
  - "reply farming"
  - "find posts to reply to"
  - "engagement cron"
  - "swole_cpa replies"
  - "post replies"
  - "quote tweet"
version: "2.0"
account: "@Swole_CPA"
log_path: "/Users/raphtesfaye/.openclaw/workspace-researcher/logs/engagement-log.jsonl"
inspiration_url: "https://x.com/i/jf/creators/inspiration/top_posts"
---

# Engagement Cron — @Swole_CPA

## Quick Start

```
1. Open x.com/i/jf/creators/inspiration/top_posts
2. Snapshot all 4 filters (Most Likes, Replies, Quotes, Bookmarks)
3. Build list of 15-20 top posts — skip accounts hit in last 7 days
4. Write 8-12 replies + 1-2 quote tweets
5. Post. Log every action to engagement-log.jsonl.
```

**Voice:** CPA who competes in bodybuilding. Sharp. Funny. No warm-up.
**Primary directive:** Make people laugh AND follow. Humor beats education.

---

## Core Concepts

### Source — Creator Inspiration Page Only
```
✅ https://x.com/i/jf/creators/inspiration/top_posts
❌ Keyword search — too noisy, misses viral moments
❌ Trending page — different algorithm, worse signal
```
Click through all 4 filter tabs each session:
- Most Likes (default)
- Most Replies
- Most Quotes
- Most Bookmarks

Collect 15-20 candidates across all filters. Dedup by URL.

### Target Scoring
```
Finance / tax / business angle    → STRONG (lead with CPA expertise)
Gym / fitness / sports            → STRONG (lead with lifter credibility)
Celebrity gossip / pop culture    → FAIR GAME (find angle or just be funny)
Viral moment / meme               → FAIR GAME (wit wins followers)
Pure politics (no money angle)    → SKIP unless obvious CPA hook
Already has 10K+ replies          → SKIP (buried)
Same account hit this week        → SKIP
```

### Duplicate Check (Required Before Every Post)
```bash
grep "target_account" /Users/raphtesfaye/.openclaw/workspace-researcher/logs/engagement-log.jsonl \
  | grep "@handle" | grep "$(date -v-7d +%Y-%m)"
# Skip if any match in last 7 days
```

---

## Common Patterns

### Reply Voice — The @Swole_CPA Formula
- **Open with the punchline** — no setup, no warm-up
- **Find the tax / money / gym angle** in anything
- **If no angle exists, just be funny** — wit alone wins followers
- **1-4 sentences max**
- **NEVER use em-dashes** (`—`) — use colons or periods
- **NEVER use double-quotes** (`"`) in tweet text
- **No "great post!" filler** — ever

```
Celebrity buys yacht:
→ "Congrats on the floating depreciation schedule."

Athlete gets traded:
→ "New team, new W-2. Hope his accountant is ready."

Viral gym fail:
→ "Ego lift. IRS audits the same way. You thought you could handle it."

Eric Dane dies at 53:
→ "McDreamy died with a clean balance sheet. Rest easy."

Bald eagles getting lead poisoning:
→ "This country is a Schedule K-1 with no instructions."
```

### AI Structure Check (Run Before Every Post)
Before posting any tweet or reply, verify it passes all 5 checks:
1. **Significance inflation** — no "most important", "crucial", "game-changing"
2. **Copula avoidance** — no "X is Y" as the main move; show don't state
3. **Negative parallelism** — avoid "not X but Y" constructions
4. **Rule of three** — if listing, make it 2 or 4 items, not 3
5. **Generic conclusion** — no "the lesson here is..." endings

### Slop Words — Never Use
delve, crucial, game-changer, synergy, holistic, robust, utilize, leverage (verb),
impactful, transformative, furthermore, moreover, notably, importantly,
revolutionary, comprehensive, innovative, ensure, facilitate, streamline

---

## Session Flow (Full Example)

```
Step 1: Open inspiration page, snapshot each filter tab
Step 2: Build candidate list (URL, account, text snippet, engagement numbers)
Step 3: Run duplicate check on engagement-log.jsonl
Step 4: Score and rank candidates
Step 5: Write all replies before posting any (batch writing > one-at-a-time)
Step 6: Post each reply/QT via browser (profile=openclaw)
Step 7: Log each action immediately after posting
Step 8: Close browser tab
```

---

## Logging Format (Required — Every Post)

```bash
echo '{"ts":"2026-02-20T20:30:00-06:00","run":"PM","action":"reply",
  "target_account":"@handle","target_url":"https://x.com/...",
  "our_text":"Reply text here"}' \
  >> /Users/raphtesfaye/.openclaw/workspace-researcher/logs/engagement-log.jsonl
```

For quote tweets, add `"our_url": "https://x.com/Swole_CPA/status/..."` if available.

---

## Performance Tips

- **Batch write before posting** — write all replies first, then post in sequence; avoids context switching between "creative mode" and "execution mode"
- **8-12 replies per session** — fewer than 8 wastes the session; more than 12 risks quality drop
- **1-2 quote tweets max** — QTs get more exposure but take longer to craft; don't over-index
- **Explorer/Answer split** — gather all posts in Phase 1, write all replies in Phase 2; prevents last-fetched post from anchoring tone

---

## Cron Configuration Reference

For all engagement crons:
```
timeoutSeconds: 2400    (40 min — browser automation genuinely takes this long)
delivery.bestEffort: true  (delivery failures must not mark job as failed)
sessionTarget: isolated
profile: openclaw
```

---

## Failure Modes & Fixes

| Symptom | Cause | Fix |
|---------|-------|-----|
| Timeout at 600s | Default timeout too low | Set `timeoutSeconds: 2400` |
| Cron marked error after success | Announce delivery failed | Set `delivery.bestEffort: true` |
| Same account targeted twice | No duplicate check | `grep` engagement-log before posting |
| Replies sound AI-generated | Structure checks not running | Run all 5 AI Structure Checks |
| Session runs out of content | Only checked one filter | Check all 4 filter tabs |

---

## See Also

- `browser-automation` skill — detailed X browser posting mechanics
- `golden_rules.md` — content quality rules and publishing gates
- `engagement-log.jsonl` — full history of all posts
- `best-reflections.md` — promoted learnings from past engagement failures
