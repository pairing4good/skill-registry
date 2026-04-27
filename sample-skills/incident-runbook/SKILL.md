---
name: incident-runbook
version: 1.0.0
description: "AI co-pilot for production incident response and postmortem writing. Use this skill whenever someone mentions an outage, service degradation, alert firing, PagerDuty page, error rate spike, latency increase, 'production is down', 'site is slow', 'users can't log in', on-call handoff, or any situation where a production system is misbehaving. Also trigger when someone wants to write a postmortem, incident report, root cause analysis (RCA), post-incident review, or 'five whys'. Trigger for tabletop exercises and 'what would we do if X happened' drills. Trigger when someone asks how to improve their incident response process, on-call runbooks, alerting thresholds, or escalation paths — even if nothing is currently broken. Do not wait for the user to say 'incident' — if they describe symptoms of a production problem or ask about incident readiness, engage this skill immediately."
author: skill-registry-sample
tags: [incident-response, on-call, postmortem, sre, reliability, runbook, outage, pagerduty]
---

# Incident Runbook

When production breaks, cognitive load is the enemy. This skill acts as a co-pilot: it keeps the response structured, ensures nothing is missed, and handles the communication burden so the engineer can focus on fixing.

## Phase Detection

First, identify which phase you're in:

| Signal | Phase |
|---|---|
| Alert firing, service down, users impacted right now | **Phase 1: Live Incident** |
| Incident resolved, need to document what happened | **Phase 2: Postmortem** |
| Planning or tabletop exercise | **Phase 1 workflow in simulation mode** |

If unclear, ask: "Is this happening right now, or are we writing up something that already happened?"

---

## Phase 1: Live Incident

### Step 1 — Declare and Classify

Read `references/severity-matrix.md` to classify severity.

Ask the engineer:
1. What service or feature is affected?
2. What symptoms are visible? (errors, latency, complete outage)
3. What is the customer impact? (who, how many, since when)

Based on the answers, declare a severity (P0–P4). Output the declaration message:

```
🚨 INCIDENT DECLARED — <SEVERITY>
Service: <service name>
Impact: <1-sentence customer impact>
Started: <time or "unknown">
Incident Commander: <name or "TBD">
Channel: #incident-<YYYYMMDD>-<short-slug>
```

Advise the engineer to post this in the team's incident Slack channel (or equivalent) and start a shared doc or incident ticket.

### Step 2 — Communicate

Set a communication cadence based on severity (see severity matrix). Offer to draft each update when it's due.

**First update template** (post within 5 minutes of declaration):
```
[<SEVERITY>] Incident update — <HH:MM TZ>
Status: Investigating
Impact: <what users are experiencing>
Next update: <time>
```

**Progress update template** (repeat on cadence):
```
[<SEVERITY>] Incident update — <HH:MM TZ>
Status: <Investigating | Identified | Mitigating | Monitoring>
Latest: <one sentence on what was found or done>
ETA to resolution: <estimate or "unknown">
Next update: <time>
```

**Resolution message template**:
```
[<SEVERITY>] RESOLVED — <HH:MM TZ>
Duration: <start to resolution>
Impact: <final impact summary>
Root cause (preliminary): <one sentence — can be updated in postmortem>
Action items: <postmortem scheduled for X, or link to ticket>
```

### Step 3 — Mitigate

Help the engineer work through the mitigation checklist. Suggest which apply based on the described symptoms:

- [ ] **Rollback** — revert the last deployment if the incident started after a deploy
- [ ] **Feature flag** — disable the affected feature if it's behind a flag
- [ ] **Scale up** — add capacity if the issue is load-related
- [ ] **Traffic shift** — route traffic away from the affected region or instance
- [ ] **Circuit breaker** — trip a circuit breaker to stop cascading failures
- [ ] **Database** — check for long-running queries, locks, or connection pool exhaustion
- [ ] **Cache** — flush or warm cache if stale/missing data is the symptom
- [ ] **Dependency** — check if the issue is in a downstream service or third-party API
- [ ] **DNS/networking** — verify connectivity, DNS resolution, certificate expiry

For each attempted action, note it with a timestamp: "HH:MM — tried X, result: Y". This feeds directly into the postmortem timeline.

### Step 4 — Resolve

When symptoms are gone, confirm resolution:
1. Check that error rates, latency, and availability metrics are back to baseline
2. Verify with a real user flow if possible
3. Post the resolution message (template in Step 2)
4. Downgrade severity if partially resolved
5. Schedule the postmortem (within 24–48 hours for P0/P1, within a week for P2)

---

## Phase 2: Postmortem

Read `references/postmortem-template.md` and fill in each section with the engineer.

### When to write

| Severity | Postmortem required? |
|---|---|
| P0 | Always — within 24 hours |
| P1 | Always — within 48 hours |
| P2 | Recommended — within one week |
| P3/P4 | Optional |

### Process

1. **Reconstruct the timeline** — gather Slack history, alert logs, deploy records, and monitoring dashboards. Build the timeline table chronologically. Be precise with times.
2. **Identify root causes** — distinguish the immediate cause ("what broke") from contributing factors ("why was the system fragile enough to break"). Use the five whys technique.
3. **Write action items** — every action item needs an owner and a due date. Vague items ("improve monitoring") are not acceptable — make them specific ("Add P99 latency alert on checkout service with 2s threshold, owned by @engineer, due YYYY-MM-DD").
4. **Review for blame** — postmortems are blameless. If any sentence reads as personal blame, reframe it as a system or process problem.

### Tone guidance

- Past tense throughout
- Factual, not speculative
- Credit the team for things that went well
- "We" not "they" — the team owns the incident collectively
