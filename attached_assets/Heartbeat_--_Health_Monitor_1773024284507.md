---
name: heartbeat
description: >
  Run pre-flight diagnostics on your OpenClaw stack: validate skills, check versions, audit env vars, and test connectivity.
  USE WHEN: user says "run a health check", "how healthy is my agent",
  "pre-flight check", "run Heartbeat", "why isn't this skill working", "are any
  of my skills broken", "audit my environment variables", or "test API
  connectivity".
  DON'T USE WHEN: user wants to scan a skill for security threats (use
  skill-inspector), wants to find new skills to install (use matchmaker), or
  wants to manage Claw Mart listings (use clawmart-manager).
  OUTPUTS: structured health report with per-skill verdicts (HEALTHY/DEGRADED/
  UNHEALTHY), environment variable audit, API connectivity results, conflict
  detection, and overall system status.
---

# Heartbeat

**Version:** 1.1.0
**Price:** Free
**Type:** Skill

## Description

Pre-flight diagnostics for your entire OpenClaw agent stack. Heartbeat walks every installed skill, validates load state, checks for version conflicts, confirms required environment variables are set, and tests API connectivity for skills that need it — then produces a single health report with a clear verdict per skill and an overall system status.

Run it after installing new skills, after updates, or whenever something feels off. If your agent is misbehaving, Heartbeat tells you where to look first.

## Prerequisites

None. No API key required. Works on any OpenClaw installation with at least one skill installed.

## Setup

1. Copy `SKILL.md` into your OpenClaw skills directory (e.g. `skills/heartbeat/SKILL.md`)
2. Reload OpenClaw
3. Confirm the skill is active with: "Is Heartbeat loaded?"

## Commands

**Health Checks**
- "Run a health check"
- "How healthy is my agent?"
- "Run Heartbeat"
- "Pre-flight check"

**Diagnostics**
- "Check [skill-name] health"
- "Why isn't [skill-name] working?"
- "Are any of my skills broken?"

**Environment**
- "Audit my environment variables"
- "What env vars am I missing?"
- "Test API connectivity for my skills"

## What It Checks

| Check Category | What It Validates |
|----------------|-------------------|
| **Skill Load** | `SKILL.md` exists and is parseable; required sections present (Description, Commands, Guardrails) |
| **Structure Integrity** | No empty required sections; no truncated files; valid markdown heading hierarchy |
| **Version Conflicts** | No two installed skills declare the same name; no duplicate command triggers across skills |
| **Environment Variables** | Every env var referenced in skill `Prerequisites` or `Setup` sections is set in the current environment |
| **API Connectivity** | Reachable endpoints for skills that declare API base URLs (HTTP HEAD, 5s timeout, TLS validation) |
| **Dependency Chain** | Skills that reference other skills (e.g. "requires Skill Inspector") have those dependencies installed |
| **File Permissions** | Skill directories and files are readable by the current user |
| **Staleness** | Skills with a `Version` header are compared against `versions.json` if present — flags mismatches |

## Workflow

### Full Health Check

1. **Discover skills** — walk the skills directory, catalog every subdirectory containing a `SKILL.md`
2. **Parse each skill** — extract: name, version, type, prerequisites, environment variable references, API base URLs, skill dependencies
3. **Validate structure** — confirm required sections exist and are non-empty; flag malformed or truncated files
4. **Check for conflicts** — cross-reference all skill names for duplicates; scan command trigger phrases for collisions across skills
5. **Audit environment** — collect every environment variable referenced across all installed skills; check each against `env` — report set vs. missing
6. **Test connectivity** — for each unique API base URL found across skills, issue an HTTP HEAD request (5s timeout, TLS required); report reachable, unreachable, or timeout
7. **Check dependencies** — for skills that reference other skills by name, verify those skills are installed and passed their own load check
8. **Compare versions** — if `versions.json` exists at the repo root, compare each skill's declared version against the registry; flag mismatches
9. **Score and classify** — assign each skill a verdict (HEALTHY / DEGRADED / UNHEALTHY); compute overall system status
10. **Produce report** — structured output with per-skill results, summary counts, and overall verdict

### Single Skill Check

1. Locate the skill by name in the skills directory
2. Run steps 2–4 and 7–8 from the full health check for that skill only
3. Run environment audit scoped to that skill's referenced variables only
4. Run connectivity test scoped to that skill's declared API endpoints only
5. Produce a focused single-skill report

### Environment Audit

1. Parse all installed skills for environment variable references in `Prerequisites`, `Setup`, and `API Reference` sections
2. Match patterns: `CLAWMART_API_KEY`, `${VAR_NAME}`, `$VAR_NAME`, and explicit `ENV_VAR=` declarations
3. For each unique variable: check if set in the current environment
4. Report a table: variable name, which skill(s) require it, status (SET / MISSING)
5. If any are MISSING, list the affected skills and what functionality is impacted

### Connectivity Test

1. Parse all installed skills for declared API base URLs (e.g. `https://www.shopclawmart.com/api/v1`, `https://api.twitter.com/2`)
2. For each unique endpoint: issue an HTTP HEAD request with a 5-second timeout and TLS certificate validation
3. Record: endpoint, HTTP status code (or error type), response time in milliseconds
4. Report results in table format with pass/fail per endpoint
5. Flag any skill whose required endpoint is unreachable

## Output Format

```
=== HEARTBEAT REPORT ===
System:   OpenClaw Agent
Scanned:  2026-02-25T14:32:08Z
Skills:   12 installed

OVERALL STATUS: HEALTHY | DEGRADED | UNHEALTHY

--- Skill Health (12) ---
  skill-inspector     1.0.0   HEALTHY
  clawmart-manager    1.0.0   HEALTHY
  clawmart-reviewer   1.0.0   HEALTHY
  release-workflow    1.0.0   DEGRADED   missing: X_CONSUMER_KEY, X_CONSUMER_SECRET
  heartbeat           1.0.0   HEALTHY
  architect           1.0.0   HEALTHY
  ...

--- Environment Variables (8 required, 6 set, 2 missing) ---
  CLAWMART_API_KEY       clawmart-manager, clawmart-reviewer, release-workflow   SET
  X_CONSUMER_KEY         release-workflow                                        MISSING
  X_CONSUMER_SECRET      release-workflow                                        MISSING
  X_BEARER_TOKEN         release-workflow                                        SET
  X_OAUTH2_CLIENT_ID     release-workflow                                        SET
  X_OAUTH2_CLIENT_SECRET release-workflow                                        SET
  ...

--- API Connectivity (3 endpoints) ---
  https://www.shopclawmart.com/api/v1    200    142ms    REACHABLE
  https://api.twitter.com/2              200     87ms    REACHABLE
  https://api.example.com/v1             ---   5000ms    TIMEOUT

--- Conflicts (0) ---
  (none)

--- Version Mismatches (0) ---
  (none)

--- Dependency Chain (2 checked) ---
  clawmart-reviewer -> skill-inspector    SATISFIED
  clawmart-manager  -> skill-inspector    SATISFIED

SUMMARY: 11 healthy, 1 degraded, 0 unhealthy. 2 environment variables missing.
```

## Verdict Routing

| Verdict | Condition | Action |
|---------|-----------|--------|
| **HEALTHY** | All checks pass. Env vars set, endpoints reachable, no conflicts. | No action needed. Agent is ready. |
| **DEGRADED** | Non-critical issues: missing optional env vars, unreachable endpoints for non-essential features, version mismatches. | Review the flagged items. Affected skills may have reduced functionality but won't break your agent. |
| **UNHEALTHY** | Critical failures: skill won't parse, required dependencies missing, required env vars unset, duplicate skill names causing load conflicts. | Fix before proceeding. Unhealthy skills may fail at runtime or cause unpredictable behavior. |

### Per-Skill Verdicts

| Verdict | Meaning |
|---------|---------|
| **HEALTHY** | Skill loads, all its env vars are set, its API endpoints are reachable, no conflicts detected. |
| **DEGRADED** | Skill loads but has warnings: missing optional env vars, unreachable non-critical endpoint, or version mismatch with `versions.json`. |
| **UNHEALTHY** | Skill cannot function: missing `SKILL.md`, unparseable content, missing required dependency, or critical env var unset. |

### Overall System Verdict

| Condition | Overall Status |
|-----------|---------------|
| All skills HEALTHY | **HEALTHY** |
| At least one DEGRADED, zero UNHEALTHY | **DEGRADED** |
| At least one UNHEALTHY | **UNHEALTHY** |

## Guardrails

- **Read-only.** Heartbeat never modifies, installs, removes, or reconfigures any skill, file, or environment variable.
- **No credential exposure.** Environment variable checks report SET or MISSING only — never prints, logs, or displays actual values.
- **Scoped network calls only.** Connectivity tests are limited to API base URLs explicitly declared in installed skill files. No arbitrary endpoints. No DNS enumeration. No port scanning.
- **HTTP HEAD only.** Connectivity checks use HEAD requests with no request body and no authentication headers. No data is transmitted to external services.
- **5-second hard timeout.** No connectivity check blocks for more than 5 seconds. Timeouts are reported, not retried.
- **No code execution.** Heartbeat reads and parses skill files as text. It never evaluates, sources, or executes any code found in skill packages.
- **Non-destructive on failure.** If Heartbeat itself encounters an error mid-scan, it reports what it completed and what it could not check. It never exits silently.

## Why Free?

A healthy ecosystem starts with healthy installations. Heartbeat makes it trivial to catch misconfigurations before they become mysterious failures — and that benefits every skill author and every user on the platform.
