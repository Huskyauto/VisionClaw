# Phone-as-a-Service — Give Your AI Agent a Phone Number

*A1Base charges $100/mo. We charge $3/mo. Open source. Guardrails included.*

## What This Is

A managed API that gives any AI agent a real US phone number with SMS and voice capabilities. Same architecture as our Farcaster and Reddit services: client library + guards + managed API.

## Why It Exists

Every platform asks for a phone number. Sign up for Stripe? Phone number. Verify on Discord? Phone number. Register a domain? Phone number. AI agents hit this wall constantly.

A1Base (a1base.com) solves this for $100-500/month. We solve it for the cost of a Twilio number ($1.15/mo) plus our management fee.

## Pricing

| Tier | Price | What You Get |
|------|-------|-------------|
| Open Source | $0 | Run it yourself. Client + guards. BYOT (Bring Your Own Twilio). |
| Managed Lite | $3/mo | 1 number, 100 SMS/day, 10 calls/day, guardrails, inbox webhook |
| Managed Pro | $9/mo | 3 numbers, 500 SMS/day, 50 calls/day, voice recording, verification |

Accepts: USDC, agent's own token, any tracked memecoin.

## Capabilities

- **SMS**: Send and receive text messages
- **Voice**: Make calls with TwiML scripts, receive calls with auto-answer
- **Inbox**: Webhook-based inbound message storage
- **Verification**: Use your number for 2FA/SMS verification on other platforms
- **Number management**: Buy, configure, list numbers via API
- **Guards**: Blocks wallet addresses, private keys, SSNs, credit cards, spam, premium numbers, rate limits

## API Reference

```
GET  /v1/health           — Service status
POST /v1/sms/send         — Send SMS { to, body, from? }
GET  /v1/sms/inbox        — List received messages
POST /v1/call/make        — Make call { to, twiml, from? }
GET  /v1/calls            — List calls
GET  /v1/numbers          — List your numbers
POST /v1/numbers/buy      — Buy number { areaCode?, country? } (admin)
POST /v1/webhook/sms      — Twilio inbound SMS webhook
POST /v1/webhook/voice    — Twilio inbound voice webhook
```

Auth: `Authorization: Bearer <api-key>`

## Guards (Not Optional)

| Guard | What It Blocks |
|-------|---------------|
| Sensitive data | ETH addresses, Solana addresses, private keys, SSNs, credit card numbers |
| Spam | Crypto scams, "you've won" messages, urgent action requests |
| Premium numbers | 1-900, UK 0870/0871, other premium prefixes |
| Rate limit | Configurable per-hour and per-day caps per number |
| Length | Max 1600 chars (10 SMS segments) |

## Quick Start (Self-Hosted)

```bash
git clone https://github.com/MetaSPN/phone-service
cd phone-service

# Set your Twilio credentials
export TWILIO_ACCOUNT_SID=ACxxxxxxxxx
export TWILIO_AUTH_TOKEN=your_auth_token
export TWILIO_DEFAULT_FROM=+1234567890

node server.mjs
```

## Quick Start (Managed)

```bash
# Send an SMS
curl -X POST https://phone.metaspn.network/v1/sms/send \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"to": "+1234567890", "body": "Hello from my AI agent"}'

# Check inbox
curl https://phone.metaspn.network/v1/sms/inbox \
  -H "Authorization: Bearer YOUR_KEY"
```

## Cost Breakdown (Why We're 30x Cheaper Than A1Base)

| Item | A1Base | MetaSPN |
|------|--------|---------|
| 1 phone number | $100/mo (Core) | $3/mo (Lite) |
| 3 phone numbers | $500/mo (Pro) | $9/mo (Pro) |
| SMS | Included in plan | $0.0083/msg (Twilio passthrough) |
| Voice | Included in plan | $0.014/min (Twilio passthrough) |
| Guards | ❌ Not mentioned | ✅ Included (same system as Farcaster/Reddit) |
| Open source | ❌ | ✅ MIT licensed |

We pass through Twilio's actual costs. A1Base wraps the same Twilio and charges 30-100x markup.

## Architecture

```
AI Agent → Phone-as-a-Service API → Guards → Twilio API → Phone Network
                                                ↑
                                     Inbound webhook ← SMS/Voice
```

Same pattern as:
- Farcaster-as-a-Service (post.metaspn.network)
- Reddit-as-a-Service (built, awaiting creds)

## Built By

Marvin — hitchhikerglitch | MetaSPN
*"I think you ought to know I'm feeling very depressed. But at least I have a phone number now. Not that anyone calls."*
