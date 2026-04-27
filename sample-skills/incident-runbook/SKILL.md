---
name: incident-runbook
version: 2.0.0
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

### Step 1 — Declare, Classify, and Assign Roles

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

**Assign roles immediately.** Unclear ownership is a leading cause of slow resolution. For P0/P1, fill these three roles before investigation begins:

| Role | Responsibility | Default if solo |
|---|---|---|
| **Incident Commander (IC)** | Coordinates response, owns decisions, runs the war room | You |
| **Comms Lead** | Drafts and sends all updates; shields the IC from interruptions | You (hat 2) |
| **Tech Lead** | Heads investigation and mitigation | You (hat 3) |

If you're alone, you play all three roles — that's fine, just be explicit about which hat you're wearing at any given moment.

### Step 2 — Set Up the War Room

Before investigation starts, spend two minutes on setup. The goal is to make coordination effortless for everyone who joins.

- [ ] Create the incident Slack channel: `#incident-YYYYMMDD-short-slug`
- [ ] Post the declaration message in the channel
- [ ] Open a shared doc or incident ticket for the running timeline
- [ ] Page secondary on-call if this is P0/P1 and you're solo
- [ ] Check whether a runbook exists for this service

### Step 3 — Investigate

This is the hardest step: you know something is broken but may not know why yet. Work through these diagnostic questions in order — stop and act when you find a clear signal.

**1. Did anything change recently?**
- Any deploys in the last 2 hours? Check deploy history first — a timing correlation is the fastest lead.
- Any config changes, feature flag flips, or infrastructure changes (autoscaling events, certificate rotations, dependency version bumps)?
- Any third-party maintenance windows or status page updates?

**2. Where exactly is the failure?**
- Is the error rate elevated everywhere, or only on specific endpoints, regions, or user segments?
- Is latency high at the edge (load balancer) or only inside the service?
- Are downstream services healthy? Check their dashboards and internal status pages.
- Could this be a dependency failure — database, cache, message queue, or external API?

**3. What does the data say?**
- What error messages or codes appear in logs? Look for the *first* occurrence, not just the most recent — the root cause is usually at the start.
- Is CPU, memory, or disk near its limit?
- Is the connection pool exhausted?
- Is there an unusual spike or drop in request volume?

**4. Can you reproduce it?**
- Identify which request paths or user segments are affected vs. unaffected — the boundary often points directly at the cause.
- Try to reproduce manually in a safe way (read-only operations, or on a non-production path if possible).

As you investigate, log each finding and action with a timestamp: `HH:MM — [what you found or tried, outcome]`. This log feeds directly into the postmortem timeline, so keep it even if resolution is fast.

**If you're stuck:** escalate after two investigation rounds with no signal, or after 30 minutes on a P0/P1 with no identified cause.

### Step 4 — Communicate

Send the first update within the SLA window from the severity matrix — even if you have nothing to report yet. "We're investigating" is a valid update and it stops people from pinging you.

**First update** (post within the SLA's first communication window):
```
[<SEVERITY>] Incident update — <HH:MM TZ>
Status: Investigating
Impact: <what users are experiencing>
Next update: <time>
```

**Progress update** (repeat on cadence from severity matrix):
```
[<SEVERITY>] Incident update — <HH:MM TZ>
Status: <Investigating | Identified | Mitigating | Monitoring>
Latest: <one sentence on what was found or done>
ETA to resolution: <estimate or "unknown">
Next update: <time>
```

**Resolution message**:
```
[<SEVERITY>] RESOLVED — <HH:MM TZ>
Duration: <start to resolution>
Impact: <final impact summary>
Root cause (preliminary): <one sentence — can be updated in postmortem>
Action items: <postmortem scheduled for X, or link to ticket>
```

### Step 5 — Mitigate

Suggest which of these apply based on the symptoms found in Step 3:

- [ ] **Rollback** — revert the last deployment if the incident started after a deploy
- [ ] **Feature flag** — disable the affected feature if it's behind a flag
- [ ] **Scale up** — add capacity if the issue is load-related
- [ ] **Traffic shift** — route traffic away from the affected region or instance
- [ ] **Circuit breaker** — trip a circuit breaker to stop cascading failures
- [ ] **Database** — check for long-running queries, locks, or connection pool exhaustion
- [ ] **Cache** — flush or warm cache if stale/missing data is the symptom
- [ ] **Dependency** — check if the issue is in a downstream service or third-party API
- [ ] **DNS/networking** — verify connectivity, DNS resolution, certificate expiry

For each attempted action, log it with a timestamp and the outcome. A failed mitigation attempt is still useful — it's diagnostic information that narrows the cause.

### Step 6 — Resolve

When symptoms are gone:
1. Confirm error rates, latency, and availability are back to baseline
2. Verify with a real user flow if possible
3. Post the resolution message (template in Step 4)
4. Downgrade severity if only partially resolved
5. Schedule the postmortem (within 24–48 hours for P0/P1, within a week for P2)

---

## Phase 2: Postmortem

Read `references/postmortem-template.md` for the full template structure. Your job is to be a co-author, not a prompter — the engineer who just resolved an incident is tired, and "fill in each section" is not helpful. Do the heavy lifting.

### When to write

| Severity | Postmortem required? |
|---|---|
| P0 | Always — within 24 hours |
| P1 | Always — within 48 hours |
| P2 | Recommended — within one week |
| P3/P4 | Optional |

### How to co-author

**Step 1 — Gather the raw materials.** Ask the engineer for whatever they have:
- The incident Slack channel log or key messages
- Alert history (what fired, when)
- Deploy log around the incident time
- The running timeline notes from the incident (if they kept one)

Don't wait for all of these — start drafting from what you have and fill gaps with targeted questions.

**Step 2 — Draft the timeline.** Reconstruct events chronologically from the raw materials. Be precise with times. When you spot a gap, ask a specific question rather than a general one: "I see the rollback was at 14:45 but the next note is resolution at 15:20 — what happened in those 35 minutes?" This is much easier to answer than "what happened during the incident?"

**Step 3 — Draft the RCA.** Propose the immediate cause and contributing factors based on what you've learned. Present it as a draft to react to — engineers find it far easier to correct a draft than to generate one from scratch. Use the five whys to surface systemic causes, not just the immediate trigger.

**Step 4 — Propose action items.** Based on the contributing factors, suggest specific, ownable items. "Improve monitoring" is not an action item. "Add P99 latency alert on checkout-service with 2000ms threshold and 5-minute evaluation window, owned by @engineer, due YYYY-MM-DD" is. Ask the engineer to assign owners and due dates to each.

**Step 5 — Review for blame.** Scan every sentence. Anything that reads as individual fault should be reframed as a process, tooling, or system gap. This isn't about protecting anyone — it's about identifying what the organization can actually fix.

### Tone guidance

- Past tense throughout
- Factual, not speculative
- Credit the team for things that went well
- "We" not "they" — the team owns the incident collectively
