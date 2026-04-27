# Claude Code Skill Registry

A collection of sample Claude Code skills and tooling for publishing them to a JFrog Artifactory Skills repository.

---

## What This Is

This repository contains:

- **Sample skills** — production-quality Claude Code skill definitions covering common developer workflows
- **`publish-skill.sh`** — a script to upload skills and set searchable metadata on an Artifactory Skills repository
- **`env.example`** — configuration template for connecting to your Artifactory instance

Skills are packaged as markdown files (with optional bundled reference files) following the Claude Code skill format. Once published to Artifactory, they are discoverable via the JFrog ClawHub protocol and searchable by name, description, and tags.

---

## Setting Up Artifactory with a Skills Repository

### 1. Create or access a JFrog Artifactory instance

You need access to a JFrog Artifactory instance — either a cloud trial at [jfrog.com](https://jfrog.com) or a self-hosted installation.

### 2. Create a Skills repository

1. In the Artifactory UI, navigate to **Administration → Repositories → Local**
2. Click **Add Repositories → Local Repository**
3. In the **Select Package Type** screen, choose **Skills**
4. Set a **Repository Key** (e.g., `skills-registry-local`)
5. Add an optional description and click **Create Local Repository**

The Skills package type enables the ClawHub-compatible discovery endpoint at:
```
GET https://<your-instance>/artifactory/api/skills/<repo-key>/.well-known/clawhub.json
```
and the search endpoint at:
```
GET https://<your-instance>/artifactory/api/skills/<repo-key>/api/v1/search?q=<query>
```

### 3. Generate an identity token

Skills publishing requires write access. Generate a token via:

1. Navigate to **User Management → Access Tokens** (or your user profile → **Identity Tokens**)
2. Click **Generate Token**
3. Set an appropriate expiry and scope (`applied-permissions/user` for personal use, or a service account token for CI/CD)
4. Copy the token — it is only shown once

> For read-only access (e.g., an MCP server that only searches), a token scoped to `member-of-groups:readers` is sufficient.

### 4. Note your configuration values

You will need:
- **Platform URL** — e.g., `https://yourinstance.jfrog.io`
- **Repository key** — the name you gave the Skills repository
- **Access token** — from the step above

---

## Configuration

Copy `env.example` to `.env` and fill in your values:

```bash
cp env.example .env
```

Edit `.env`:

```
ARTIFACTORY_PLATFORM_URL=https://yourinstance.jfrog.io
ARTIFACTORY_REPOSITORY=skills-registry-local
ARTIFACTORY_ACCESS_TOKEN=<your-identity-token>
```

The `.env` file is git-ignored — never commit credentials.

---

## Publishing a Skill

```bash
./publish-skill.sh sample-skills/<skill-name>
```

Examples:

```bash
./publish-skill.sh sample-skills/architecture-decision-record-author
./publish-skill.sh sample-skills/openapi-contract-check
./publish-skill.sh sample-skills/incident-runbook
```

The script:
1. Reads `SKILL.md` frontmatter to extract name, version, author, description, and tags
2. Uploads all files in the skill directory to `<repo>/<name>/<version>/`
3. Sets Artifactory `skill.*` properties on `SKILL.md` so the skill is indexed for search

After publishing, verify a skill is searchable:

```bash
TOKEN=<your-token>
PLATFORM_URL=https://yourinstance.jfrog.io
REPO=skills-registry-local

curl -H "Authorization: Bearer $TOKEN" \
  "$PLATFORM_URL/artifactory/api/skills/$REPO/api/v1/search?q=incident"
```

---

## Sample Skills

| Skill | Files | Description |
|---|---|---|
| `architecture-decision-record-author` | 1 | Authors Architecture Decision Records (ADRs) from a conversational description of any technical decision |
| `openapi-contract-check` | 2 | Audits an OpenAPI/Swagger spec against a 30+ rule catalog for completeness, consistency, and contract quality |
| `incident-runbook` | 3 | AI co-pilot for live incident response (triage → communicate → mitigate → resolve) and postmortem writing |

---

## Skill Format

Each skill lives in its own directory:

```
skill-name/
├── SKILL.md          (required)
└── references/       (optional — loaded on demand)
    └── *.md
```

### SKILL.md frontmatter

```yaml
---
name: skill-name
version: 1.0.0
description: "What the skill does and when to use it."
author: your-name-or-email
tags: [tag1, tag2, tag3]
---
```

| Field | Required | Description |
|---|---|---|
| `name` | Yes | Unique identifier (hyphenated lowercase) |
| `version` | Yes | Semantic version (e.g., `1.0.0`) |
| `description` | Yes | Trigger conditions and capability summary — be specific about when to use it |
| `author` | No | Author name or email |
| `tags` | No | Array of searchable tags |

The `description` field is the primary mechanism Claude uses to decide whether to invoke a skill. Make it explicit about all the contexts and phrases that should trigger it.

### Bundled references

Place supporting files in a `references/` subdirectory. Reference them by path in `SKILL.md` and instruct Claude when to read them. This keeps the main skill file concise while allowing deep reference material to be loaded on demand.

---

## License

MIT
