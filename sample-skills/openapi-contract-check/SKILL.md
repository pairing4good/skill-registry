---
name: openapi-contract-check
version: 1.0.0
description: "Perform a structured review of an OpenAPI or Swagger specification for completeness, consistency, and contract quality. Use this skill whenever a developer wants to review, lint, audit, validate, or improve an openapi.yaml, openapi.json, swagger.yaml, swagger.json, api.yaml, api.json, or any YAML/JSON file that turns out to follow the OpenAPI format. Trigger on phrases like 'check my API contract', 'review my spec', 'is my API spec correct', 'what's wrong with my OpenAPI', 'help me with my API definition', 'my spec is missing something', or 'does my OpenAPI look right'. Trigger even for partial or work-in-progress specs — incomplete specs benefit from early feedback. Trigger for any version of OpenAPI (2.x Swagger, 3.0.x, 3.1.x). If the user pastes or shares a YAML/JSON file and you recognize the OpenAPI structure, engage this skill without waiting to be asked."
author: skill-registry-sample
tags: [openapi, swagger, api, contract-testing, rest, validation, linting, api-design]
---

# OpenAPI Contract Check

API contracts drift from implementation constantly, and most teams rely on runtime failures to find spec errors. This skill performs a systematic pre-merge audit against a comprehensive rule catalog, producing a prioritized findings report you can act on immediately.

## Step 1: Locate the spec

Identify what you're checking:
- A file path the user provides (read it)
- A URL to fetch
- Content pasted inline

If the file can't be read or the content doesn't parse as valid YAML/JSON, say so immediately and stop — don't attempt to apply rules against malformed input. If the spec is missing the top-level `openapi` or `swagger` field, flag that as an ERROR before running any other rules.

Confirm the OpenAPI version (look for `openapi: 3.x.x` or `swagger: "2.0"`) — some rules apply only to specific versions.

## Step 2: Determine scope

Default to a full audit. Run all rule categories unless the user's message makes a specific concern clear (e.g., "check my security definitions", "are my error responses complete") — in that case, focus on the relevant categories but mention which ones you're skipping.

## Step 3: Run the rule catalog

**Read `references/openapi-rules.md` now** — before writing a single finding. It contains 10 rule categories with severity, version applicability, and fix examples. Work through each category systematically. Collect all findings before producing the report — outputting results mid-check fragments the audit and causes you to miss interactions between rules.

Apply every rule relevant to the detected OpenAPI version. Rules marked "3.x only" skip on Swagger 2.x specs, and vice versa.

If the spec is large (>300 lines), work category by category and note your progress: "Checked: Info, Paths, Parameters — continuing…"

## Step 4: Produce the Findings Report

Always use this exact format:

```
# OpenAPI Contract Report: <info.title> (<info.version>)
Spec version: OpenAPI <detected version>
File: <path or "inline">
Checked: <date>

## Summary
| Severity | Count |
|---|---|
| ERROR   | N |
| WARNING | N |
| INFO    | N |

## Errors (must fix before shipping)
[one section per finding:]

### [RULE-ID] <Rule short name>
**Location:** `<json-path to the offending element>`
**Issue:** <one sentence describing the violation>
**Fix:** <concrete fix — show corrected YAML/JSON snippet if helpful>

## Warnings (should fix)
[same format]

## Info (consider improving)
[same format]

## No issues found
[include this section only if a category is clean]
```

If the spec is clean, say so clearly: "No issues found across N rules checked."

## Severity definitions

| Severity | Meaning |
|---|---|
| **ERROR** | Will cause client failures, broken generated code, or security exposure — fix before merging |
| **WARNING** | Reduces API quality, causes friction for consumers, or violates a widely-accepted convention |
| **INFO** | Best-practice improvement that improves developer experience but doesn't break anything |

## When to auto-fix vs. report only

**Report only** (default): List findings and let the user decide what to fix. APIs are contracts — don't silently change them.

**Auto-fix** when the user says "fix it", "apply the fixes", or "update the spec": Make corrections directly to the file. After editing, re-run the affected rules to confirm the fixes resolved the findings. Note what was changed in a summary.

## After the report

If there are any ERRORs, proactively offer to fix them: "I can apply all N error-level fixes now — want me to?" Don't wait to be asked.

Then offer:
- Explain any finding in more detail
- Apply WARNING-level fixes
- Check a revised spec after the user makes changes
