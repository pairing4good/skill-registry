---
name: architecture-decision-record-author
version: 1.1.0
description: "Author Architecture Decision Records (ADRs) — structured markdown documents that capture important technical decisions, their context, the alternatives considered, and the consequences. Use this skill whenever a developer mentions making or documenting a technical choice: selecting a library or framework, designing an API, choosing a database, deciding on an infrastructure approach, planning a migration, or weighing architectural tradeoffs. Trigger on phrases like 'we decided to use X', 'I need to document why we chose', 'should we write up this decision', 'help me record this', 'pros and cons of X vs Y', 'help me choose between', or any situation where a significant architectural or design choice is being evaluated, has just been made, or was made in the past and should be documented. Trigger even when the user is mid-decision and hasn't landed on an answer yet — an ADR can be started in Proposed status and finalized later."
author: skill-registry-sample
tags: [architecture, decision-records, documentation, adr, design, technical-writing]
---

# Architecture Decision Record Author

ADRs are one of the highest-leverage developer habits yet chronically skipped because they're tedious to write consistently. This skill eliminates that friction: find the right sequence number, gather context efficiently, produce a complete ADR, and write it directly to the project filesystem.

## Step 1: Find the sequence number

Before writing anything, check whether the project has an existing ADR collection. Look for these directories (in order):

- `docs/decisions/`
- `doc/adr/`
- `docs/adr/`
- `architecture/decisions/`
- `adr/`

If you find one, list the files to determine the next sequence number. If no existing collection is found, start at `0001` and suggest creating the directory.

## Step 2: Gather context

Assess what the user has already told you, then ask only for what's missing. The five things you need:

1. **Decision** — what was decided ("We will use X for Y")
2. **Context** — what problem, constraint, or event drove this
3. **Alternatives** — what else was considered and why each was rejected
4. **Consequences** — expected positive and negative effects
5. **Affected systems** — what components or teams are affected

If the user's message already covers most of these, confirm briefly ("I have enough context — drafting now") and go straight to Step 3. Don't ask questions you already have answers to.

**Retroactive decisions**: When the user is documenting a past decision and can't fully recall alternatives or original context, don't press them to invent answers. Work with what they have and use `[not formally documented at the time]` as a placeholder where needed. A partial ADR that gets committed is more valuable than a perfect one that never gets written.

**Mid-decision**: If the user hasn't landed on an answer yet, start the ADR in `Proposed` status and stub out the Decision and Consequences sections so the user can fill them in after the choice is made.

## Step 3: Write the ADR

Use the Nygard format. Every section is required except where noted.

```markdown
# [NNNN] [Short imperative title — what was decided, not why]

**Date:** YYYY-MM-DD  
**Status:** Proposed | Accepted | Deprecated | Superseded by [NNNN](NNNN-title.md)  
**Deciders:** [names or team, optional]  
**Tags:** [optional comma-separated labels]

## Context

[1–3 paragraphs. Describe the situation, forces, constraints, and requirements that
made this decision necessary. Write in present tense as if describing the situation
at the time the decision was made. Do not include the decision itself here.]

## Decision

[1–2 paragraphs. State clearly what was decided. Start with the decision itself —
"We will..." — before explaining the reasoning. Include the key reasoning that favored
this option over the alternatives.]

## Alternatives Considered

[For each alternative that was seriously considered:]

### [Alternative name]

[1–2 sentences describing what this option was and why it was not chosen.]

## Consequences

### Positive
- [Bullet per positive consequence]

### Negative
- [Bullet per negative consequence or accepted risk]

### Neutral / Notes
- [Optional: things to watch, follow-up decisions needed, affected teams to notify]
```

## Step 4: Write the file

Determine the file path using the sequence number from Step 1:

- **Convention:** `docs/decisions/NNNN-short-title.md`
- Short title: lowercase, hyphens, imperative verb ("use-postgres", "adopt-opentelemetry", "retire-legacy-auth")
- If the project uses a different convention (e.g., `adr/`, `architecture/`), match it

Use the Write tool to save the ADR to that path. Confirm the file path to the user after writing.

## ADR status lifecycle

| Status | Meaning |
|---|---|
| **Proposed** | Draft — under discussion, not yet agreed |
| **Accepted** | Agreed — this is the current decision |
| **Deprecated** | No longer relevant, but not superseded by a specific ADR |
| **Superseded** | Replaced by a later ADR — always link to the successor |

When a decision is superseded, update the old ADR's status to `Superseded by [NNNN](NNNN-new-title.md)` and note in the new ADR's Context what changed.

## Linking ADRs to code

After delivering the ADR, suggest the user add a reference where the decision shows up in code:

```python
# Architecture decision: docs/decisions/0012-use-redis-for-sessions.md
```

or in a commit message:

```
feat: add Redis session store

Implements ADR-0012. See docs/decisions/0012-use-redis-for-sessions.md.
```

## Follow-ups

After writing the file, offer exactly three follow-ups:
1. Adjust status or any section
2. Add or flesh out an alternative
3. Generate the commit message (`docs: add ADR-NNNN <title>`)
