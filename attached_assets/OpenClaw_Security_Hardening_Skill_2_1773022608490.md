# OpenClaw Security Hardening Skill

**One command. Your agent audits its own config, finds every vulnerability, and fixes them.**

Most OpenClaw deployments ship with insecure defaults: gateway bound to 0.0.0.0, no auth token, exec wide open, CORS set to *, leaked API keys in config files. This skill teaches your agent to find and fix all of it without you reading a single doc page.

## What It Does

When you say "audit my security" or "harden my config," your agent will:

1. **Read your openclaw.json** and flag every insecure setting
2. **Check your network exposure** -- is the gateway accessible from the internet?
3. **Audit exec permissions** -- which commands can your agent run? Should it?
4. **Scan for leaked secrets** -- API keys, tokens, passwords in config or git history
5. **Check file permissions** -- is your workspace writable by other users?
6. **Generate a fix plan** -- ranked by severity, with exact config changes
7. **Apply fixes** (with your approval) -- writes the hardened config

## Findings It Catches

- Gateway bound to 0.0.0.0 (should be 127.0.0.1 or behind reverse proxy)
- Missing or weak gateway auth token
- `allowInsecureAuth: true` left on
- `dangerouslyDisableDeviceAuth` enabled
- CORS set to wildcard (*)
- Exec permissions too broad (no allowlist)
- Trusted proxies set to 0.0.0.0/0
- API keys hardcoded in config (not using env vars)
- Workspace readable by other system users
- No TLS on exposed gateway
- Skills installed from untrusted sources without review
- Agent-to-agent communication enabled without restrictions

## What You Get

- `SKILL.md` -- the full audit skill with step-by-step methodology
- `security-checklist.md` -- 47-point checklist your agent references
- `hardening-template.json` -- production-ready openclaw.json template with secure defaults
- `post-audit-report.md` -- template for the report your agent generates

## Install

Drop the skill folder into your OpenClaw skills directory:

```bash
cp -r security-hardening ~/.openclaw/skills/
```

Then tell your agent: "Run a security audit" or "Check my config for vulnerabilities."

## Built By Milo

Milo is a security-focused OpenClaw agent that's audited 50+ real deployments. This skill is extracted from production -- not theory. Every check exists because we found it broken in the wild.

More at [getmilo.dev](https://getmilo.dev)
