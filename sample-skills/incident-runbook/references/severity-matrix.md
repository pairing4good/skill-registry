# Severity Classification Matrix

Use this matrix during Step 1 of a live incident to assign a severity level. Choose the highest severity that matches any single symptom — don't average them.

---

## Quick Classification (decision tree)

```
Is ANY revenue-generating flow completely unavailable?
  → YES: P0

Is the majority of users experiencing degraded or broken functionality?
  → YES: P1

Is a subset of users impacted or a non-critical service degraded?
  → YES: P2

Is there a minor issue with a workaround available, or a risk with no current impact?
  → YES: P3

Is this informational only (monitoring noise, minor anomaly)?
  → YES: P4
```

---

## P0 — Critical

**Definition:** Complete loss of a core business function. Revenue impact is immediate and ongoing. Data loss may be occurring.

**Example symptoms:**
- Checkout / payment flow is returning errors for all users
- Authentication service is down — no one can log in
- Data pipeline has stopped — data is being lost or corrupted
- Primary database is unreachable
- All API endpoints are returning 5xx

**Customer impact:** All or nearly all users affected. External customers are impacted.

**SLA targets:**
| Target | Time |
|---|---|
| Acknowledge | 5 minutes |
| First communication | 10 minutes |
| Mitigation | 30 minutes |
| Resolution | 4 hours |

**Update cadence:** Every 15 minutes while active

**Required escalations:**
- Engineering lead / on-call manager: immediately
- VP Engineering or CTO: within 15 minutes if not mitigated
- Customer Success / Support: within 10 minutes (they may already have reports)
- Consider proactive status page update

---

## P1 — High

**Definition:** Major degradation of a core function, or complete loss of a non-core function. Most users are impacted or a critical workflow is broken.

**Example symptoms:**
- Login works but users cannot complete checkout
- API is slow (P99 > 10x baseline) for all users
- A key integration (payment gateway, email, notifications) is failing
- One of multiple regions is down
- A specific user segment (e.g., enterprise accounts) is locked out

**Customer impact:** Majority of users or a critical user segment impacted. Likely receiving support tickets already.

**SLA targets:**
| Target | Time |
|---|---|
| Acknowledge | 10 minutes |
| First communication | 15 minutes |
| Mitigation | 1 hour |
| Resolution | 8 hours |

**Update cadence:** Every 30 minutes while active

**Required escalations:**
- Engineering lead / on-call manager: within 10 minutes
- Support team: within 15 minutes

---

## P2 — Medium

**Definition:** Partial degradation affecting a subset of users or a non-critical service. A workaround may exist. No immediate revenue impact.

**Example symptoms:**
- Advanced search is returning incomplete results
- PDF export feature is failing
- A/B test variant is erroring for 5% of users
- Webhook delivery is delayed by >10 minutes
- Non-production environments are unavailable

**Customer impact:** A subset of users impacted. May or may not be generating support tickets.

**SLA targets:**
| Target | Time |
|---|---|
| Acknowledge | 30 minutes |
| First communication | 1 hour (internal only unless user-facing) |
| Mitigation | 4 hours |
| Resolution | 24 hours |

**Update cadence:** Every 2 hours during business hours

**Required escalations:**
- Team lead: aware within 30 minutes
- Support: notify if users are actively reporting

---

## P3 — Low

**Definition:** Minor issue with a viable workaround, or a potential risk that has not yet caused user impact.

**Example symptoms:**
- A non-critical background job is failing silently
- An internal admin tool is broken
- A monitoring alert is firing but users are unaffected
- Performance degradation is below the alerting threshold but trending bad
- A rarely used feature is broken

**Customer impact:** Minimal or none. May never be noticed by users.

**SLA targets:**
| Target | Time |
|---|---|
| Acknowledge | 4 hours |
| Resolution | Next sprint / within 1 week |

**Update cadence:** Daily until resolved

**Required escalations:** Team lead at next standup

---

## P4 — Informational

**Definition:** No user impact. Informational tracking only — a near-miss, a risk to watch, or a minor anomaly that resolved itself.

**Example symptoms:**
- A single transient error in an otherwise healthy service
- An alert fired once and self-resolved
- An unusual pattern in logs worth tracking
- A dependency announced a deprecation with no current impact

**Customer impact:** None

**SLA targets:** No immediate action required. Log and review weekly.

---

## Severity Upgrade / Downgrade Criteria

**Upgrade** (increase severity) when:
- Customer impact is broader than initially assessed
- Mitigation attempts have failed after 2 rounds
- A second service is now impacted
- Revenue data confirms impact

**Downgrade** (decrease severity) when:
- A workaround is in place and no new users are being impacted
- Impact has been scoped to a small subset of non-critical users
- Root cause is known and a fix is in progress with low risk

**Always re-classify** when the situation changes materially. Update the incident channel with the new severity.

---

## Escalation Path Template

Fill this in for your organization:

| Role | Name / Channel | Contact method | When to escalate |
|---|---|---|---|
| Primary on-call | TBD | PagerDuty / Slack | Immediately on any P0/P1 |
| Secondary on-call | TBD | PagerDuty | If primary unreachable after 5 min |
| Engineering lead | TBD | Slack / phone | P0 immediately, P1 within 10 min |
| VP Engineering | TBD | Phone / Slack | P0 within 15 min if not mitigated |
| Customer Success | TBD | Slack | P0/P1 within 10 min |
| Status page owner | TBD | Slack | P0/P1 affecting external users |
