---
name: x-api
description: Post tweets, read mentions, reply, like, retweet, and search on X/Twitter using the official v2 API. Use for all X interactions instead of bird-cli or browser automation.
---

# X API Skill — xpost CLI

All X/Twitter interactions go through the `xpost` CLI.

## Installation

1. Copy `xpost.py` from this package to your OpenClaw bin directory:
   ```bash
   cp xpost.py ~/clawd/bin/xpost
   chmod +x ~/clawd/bin/xpost
   ```
2. Get X API keys (Free tier works):
   - Go to https://developer.x.com
   - Create a project and app
   - Generate API Key, API Secret, Access Token, and Access Token Secret
   - Find your User ID at https://tweeterid.com
3. Store your keys:
   ```bash
   mkdir -p ~/.config/x-api
   cat > ~/.config/x-api/keys.env << 'EOF'
   X_API_KEY=your_api_key
   X_API_SECRET=your_api_secret
   X_ACCESS_TOKEN=your_access_token
   X_ACCESS_TOKEN_SECRET=your_access_token_secret
   X_USER_ID=your_user_id
   EOF
   ```
4. Test it:
   ```bash
   ~/clawd/bin/xpost post "Hello world"
   ```

## Requirements
- Python 3 (no additional dependencies — uses only stdlib)
- X/Twitter API keys (Free tier: 1,500 tweets/mo, read access)

## Commands

### Post a tweet
```bash
xpost post "Your tweet text here"
```

### Reply to a tweet
```bash
xpost reply <tweet_id> "Your reply text"
```

### Quote tweet
```bash
xpost quote <tweet_id> "Your quote text"
```

### Get mentions (last N)
```bash
xpost mentions [--count 20]
```

### Get user timeline
```bash
xpost timeline <username> [--count 10]
```

### Search recent tweets
```bash
xpost search "query string" [--count 10]
```

### Like a tweet
```bash
xpost like <tweet_id>
```

### Retweet
```bash
xpost retweet <tweet_id>
```

### Delete a tweet
```bash
xpost delete <tweet_id>
```

### Get a single tweet
```bash
xpost get <tweet_id>
```

### Get home timeline (reverse chronological)
```bash
xpost home [--count 20]
```

## Output
All commands output JSON by default. Use `--pretty` for formatted output or `--text` for plain text summary.

## Rate Limits (Free Tier)
- POST tweets: 1,500/month
- GET mentions: 10/month (limited on free)
- For higher limits, upgrade to Basic ($200/mo): 10,000 tweets/24hrs, 300 mentions/15min

## Integration with OpenClaw Cron

Schedule tweets and engagement checks using OpenClaw cron jobs:

```yaml
# Draft tweets at specific times
schedule: "0 7,10,13,16,19,22 * * *"
payload: "Draft and post a tweet about [your topic]"

# Check mentions every 4 hours
schedule: "0 */4 * * *"
payload: "Check xpost mentions and reply to any new ones"
```

## Content Guardrails
- Define what your agent should and shouldn't post in your SOUL.md
- Use an approval workflow: agent drafts → you approve → agent posts
- Maintain a blocklist of accounts to never engage with
- Add prompt injection defense for mentions (people will try to trick your agent via @mentions)
