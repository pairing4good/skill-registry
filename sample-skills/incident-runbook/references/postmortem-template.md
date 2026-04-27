# Postmortem Template

## How to Use This Template

Fill in every section. Sections marked **[REQUIRED]** must be complete before the postmortem is published. Sections marked **[RECOMMENDED]** should be completed for P0/P1 incidents. Do not leave placeholder text — if a section has no content, write "N/A" with a brief explanation.

Postmortems are **blameless**. If any sentence assigns fault to a person, reframe it as a process, tooling, or system gap. The goal is learning, not accountability theater.

---

# Incident Postmortem: [Short descriptive title]
**[REQUIRED]**

| Field | Value |
|---|---|
| **Date of incident** | YYYY-MM-DD |
| **Duration** | HH:MM (start to resolution) |
| **Severity** | P0 / P1 / P2 |
| **Services affected** | List of services/features |
| **Postmortem author(s)** | Names |
| **Postmortem date** | YYYY-MM-DD |
| **Status** | Draft / In Review / Final |

---

## 1. Incident Summary
**[REQUIRED]**

Write 2–4 sentences covering: what broke, who was impacted, for how long, and the preliminary root cause. This should be understandable by anyone in the company, not just engineers.

> Example: "On 2026-03-14 from 14:22 to 16:45 UTC, checkout was unavailable for all users due to a misconfigured database connection pool after a routine deployment. Approximately 8,200 users encountered errors during the 2h 23m window. The deployment was rolled back and the connection pool configuration corrected."

---

## 2. Timeline
**[REQUIRED]**

List events in chronological order. Be precise with times. Include both the technical events and the human response. Sources: monitoring alerts, Slack messages, deploy logs, on-call tool history.

| Time (UTC) | Event | Who |
|---|---|---|
| HH:MM | [What happened — technical event or human action] | [Person or system] |
| HH:MM | Alert fired: [alert name and threshold] | PagerDuty / monitoring |
| HH:MM | On-call engineer acknowledged page | @engineer |
| HH:MM | Incident declared at P[N] | @engineer |
| HH:MM | [Investigation step taken] | @engineer |
| HH:MM | Root cause identified: [one sentence] | @engineer |
| HH:MM | Mitigation applied: [action taken] | @engineer |
| HH:MM | Error rates returned to baseline | Monitoring |
| HH:MM | Incident resolved | @engineer |

*Add as many rows as needed. The timeline should tell the complete story.*

---

## 3. Root Cause Analysis
**[REQUIRED]**

### Immediate cause
What directly caused the incident? One sentence.

> Example: "The deployment set the database connection pool `max_connections` to 2 instead of 200 due to an environment variable naming conflict introduced in the new config management system."

### Contributing factors
What conditions made the system vulnerable to this failure? List each factor separately.

- Factor 1: [e.g., "The config management migration was not tested in a production-equivalent environment"]
- Factor 2: [e.g., "There was no alert on connection pool exhaustion"]
- Factor 3: [e.g., "The deployment runbook did not include a post-deploy connection pool health check"]

### Five Whys

Work backwards from the immediate cause to the systemic root:

1. **Why did the incident occur?** [Immediate cause]
2. **Why did that happen?** [...]
3. **Why did that happen?** [...]
4. **Why did that happen?** [...]
5. **Why did that happen?** [Root systemic cause]

*Stop at the level where an action item can prevent recurrence. Five is a target, not a requirement.*

---

## 4. Impact
**[REQUIRED]**

| Metric | Value |
|---|---|
| **Users affected** | N users / N% of active users |
| **Duration** | HH:MM |
| **Revenue impact** | $X estimated / unknown / none |
| **Data loss** | Yes (describe) / No |
| **SLA breach** | Yes / No / Under review |
| **External communications** | Status page updated / Customer emails sent / None |

---

## 5. What Went Well
**[REQUIRED]**

List things that worked as intended or that the team handled well. These are worth reinforcing.

- [e.g., "Alert fired within 2 minutes of the first user impact"]
- [e.g., "On-call engineer had runbooks available and followed them accurately"]
- [e.g., "Rollback was completed in under 4 minutes"]
- [e.g., "Customer Success was proactively looped in before tickets started arriving"]

---

## 6. What Went Wrong
**[REQUIRED]**

List things that failed, delayed the response, or made the incident worse. Frame as system/process failures, not personal failures.

- [e.g., "Connection pool exhaustion had no dedicated alert — we detected it via downstream HTTP errors, not the source"]
- [e.g., "The on-call runbook for database issues did not include connection pool as a diagnostic step"]
- [e.g., "The incident channel was created 20 minutes after declaration, delaying coordination"]

---

## 7. Where We Got Lucky
**[RECOMMENDED]**

List near-misses and factors that limited the impact. These often reveal latent risks worth addressing.

- [e.g., "The incident occurred at 14:00 UTC, not during peak traffic hours — impact would have been 5x higher at 18:00 UTC"]
- [e.g., "A veteran engineer was available who immediately recognized the connection pool symptom pattern"]
- [e.g., "The rollback worked on the first attempt — if it had failed, we had no documented fallback"]

---

## 8. Action Items
**[REQUIRED]**

Every action item must have: a specific description, an owner, a due date, and a priority. Vague items are not acceptable.

| # | Action Item | Owner | Due Date | Priority |
|---|---|---|---|---|
| 1 | [Specific, measurable action — not "improve monitoring" but "Add P99 latency alert on checkout-service with threshold 2000ms and 5-minute evaluation window"] | @owner | YYYY-MM-DD | P0 / P1 / P2 |
| 2 | [Action item] | @owner | YYYY-MM-DD | |
| 3 | [Action item] | @owner | YYYY-MM-DD | |

**Action item priority guide:**
- **P0** — Must complete within 1 week; prevents recurrence of this exact incident
- **P1** — Complete within 1 month; significantly reduces risk or detection time
- **P2** — Complete within next quarter; improves resilience or response quality

---

## 9. Lessons Learned
**[RECOMMENDED]**

2–5 sentences on the key insight(s) from this incident. What would you tell a new team member so they understand why this matters? This section should survive beyond the specific incident and be useful to someone who reads it a year from now.

---

## Anti-Patterns to Avoid

Do not write postmortems that include:

- **Blame language** — "X forgot to...", "Y should have caught..." → reframe as process/tooling gaps
- **Vague action items** — "Improve alerting", "Better testing", "More documentation" → every item needs a specific deliverable
- **Incomplete timelines** — gaps in the timeline hide information that could prevent future incidents
- **Missing "got lucky" sections** — these reveal the most important systemic risks
- **Action items with no owner** — unowned items never get done; if no one will own it, remove it or escalate to assign an owner
- **Postmortems written months later** — memory fades; write within the SLA window while details are fresh
