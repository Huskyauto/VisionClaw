---
name: browser-automation
description: >
  Browser automation for X (Twitter) — posting tweets, replies, quote tweets,
  uploading files, and navigating the X web interface via profile=openclaw.
  Load this skill whenever automating any X browser action: posting, replying,
  uploading images, navigating X articles, or checking the engagement feed.
triggers:
  - "post tweet"
  - "reply to tweet"
  - "quote tweet"
  - "upload to X"
  - "open browser.*x.com"
  - "engagement farming"
  - "post to twitter"
  - "browser.*profile=openclaw"
  - "X article"
version: "2.0"
profile: "openclaw"
log_path: "/Users/raphtesfaye/.openclaw/workspace-researcher/logs/engagement-log.jsonl"
---

# Browser Automation — X (Twitter)

## Quick Start

```python
# Always profile=openclaw. Never profile=chrome for automated work.
browser(action="open", profile="openclaw", targetUrl="https://x.com")
snap = browser(action="snapshot", profile="openclaw", targetId=TAB_ID)
# Re-snapshot after EVERY click — refs go stale immediately
```

**The 3 non-negotiable rules before any X automation:**
1. `profile=openclaw` only — Chrome relay drops on clicks
2. Full snapshot always — `efficient` mode skips the Post textbox
3. Re-snapshot after every single click — refs go stale

---

## Core Concepts

### Profile Selection
```
profile=openclaw  ✅ Stays logged in as @Swole_CPA. Use for ALL automated work.
profile=chrome    ❌ Drops on click actions. Requires manual tab re-attach.
                     Never use for automated posting.
```

### Snapshot Mode
```python
# CORRECT — full snapshot captures Post textbox ref
snap = browser(action="snapshot", profile="openclaw")

# WRONG — efficient mode skips critical refs
snap = browser(action="snapshot", profile="openclaw", mode="efficient")
```

### Ref Staleness
Every click invalidates all previously captured refs. Pattern:
```python
browser(action="act", request={"kind": "click", "ref": "e12"})
snap = browser(action="snapshot", ...)  # MUST re-snapshot immediately
# Now use refs from the NEW snapshot only
```

### Concurrent Agent Rule
**Never run two browser-automation agents on `profile=openclaw` simultaneously.**
They share the same browser session and steal each other's active tab.
- If a sub-agent is doing browser work: wait for it to finish before starting your own
- Check `subagents(action=list)` before opening any browser tab

---

## Common Patterns

### Post a Tweet
```python
# 1. Open compose
browser(action="open", profile="openclaw", targetUrl="https://x.com/compose/tweet")
snap = browser(action="snapshot", profile="openclaw", targetId=TAB_ID)

# 2. Click the text area (use ref from snapshot)
browser(action="act", profile="openclaw", targetId=TAB_ID,
        request={"kind": "click", "ref": "<textbox_ref>"})
snap = browser(action="snapshot", ...)  # re-snapshot

# 3. Type tweet text
browser(action="act", profile="openclaw", targetId=TAB_ID,
        request={"kind": "type", "ref": "<textbox_ref>", "text": "Tweet content here"})

# 4. Click Post button
browser(action="act", profile="openclaw", targetId=TAB_ID,
        request={"kind": "click", "ref": "<post_button_ref>"})
snap = browser(action="snapshot", ...)  # confirm success
```

### Reply to a Tweet
```python
# Navigate to the tweet URL first
browser(action="open", profile="openclaw", targetUrl="https://x.com/user/status/ID")
snap = browser(action="snapshot", ...)

# Click Reply button → type → Post
```

### Upload an Image
```python
import shutil, os

# Stage file to uploads dir first — direct path upload fails
os.makedirs("/tmp/openclaw/uploads", exist_ok=True)
shutil.copy("/path/to/image.jpg", "/tmp/openclaw/uploads/image.jpg")

# Then upload via browser
browser(action="upload", profile="openclaw", targetId=TAB_ID,
        selector="input[type=file]",
        paths=["/tmp/openclaw/uploads/image.jpg"])
```

### Get Top Posts (Engagement Source)
```python
# Official source — do NOT use keyword search
browser(action="open", profile="openclaw",
        targetUrl="https://x.com/i/jf/creators/inspiration/top_posts")
snap = browser(action="snapshot", ...)

# Click through filters: Most Likes → Most Replies → Most Quotes → Most Bookmarks
```

---

## Logging (Required after every post action)

```bash
echo '{"ts":"<ISO8601>","run":"<run_id>","action":"tweet|reply|quote",
       "target_account":"@handle","target_url":"<url>","our_text":"<text>"}' \
  >> /Users/raphtesfaye/.openclaw/workspace-researcher/logs/engagement-log.jsonl
```

Check for duplicate targeting before posting:
```bash
grep "@handle" /Users/raphtesfaye/.openclaw/workspace-researcher/logs/engagement-log.jsonl
# Skip account if replied within last 7 days
```

---

## Performance Tips

- **Close tabs when done** — `browser(action="close", targetId=TAB_ID)` after every session
- **Session cleanup before engagement windows** — context bloat (150K+ tokens) causes timeouts; LaunchAgent auto-runs cleanup at 11:50AM + 5:20PM CT. Manual: `bash ~/.openclaw/scripts/session-cleanup.sh`
- **Timeouts for browser crons** — minimum `timeoutSeconds: 2400` (40 min). Browser automation genuinely takes 20-25 min per session.
- **bestEffort on delivery** — always set `delivery.bestEffort: true` on tweet/engagement crons so announce failures don't mark the job as failed

---

## Failure Modes & Fixes

| Symptom | Cause | Fix |
|---------|-------|-----|
| Ref not found after click | Stale ref | Re-snapshot immediately after every click |
| Post button not visible | Efficient snapshot | Switch to full snapshot |
| Login screen appears | Wrong profile | Use `profile=openclaw`, not `profile=chrome` |
| Tab collision / wrong content | Two agents running | Check `subagents(action=list)`, wait for other agent |
| Upload fails | File not staged | Copy to `/tmp/openclaw/uploads/` first |
| Cron times out | Session bloat | Run session-cleanup, increase `timeoutSeconds` |

---

## See Also

- `golden_rules.md` — full publishing gates and content quality rules
- `engagement-log.jsonl` — historical post log
- `best-reflections.md` — promoted learnings from past browser automation failures
