# Skill Registry — MCP Server Tutorial

This repository is a hands-on tutorial for building a **skill registry MCP server** using Anthropic's `mcp-builder` skill. By the end you will have:

1. A JFrog Artifactory Skills repository populated with three production-quality sample skills
2. A fully functional MCP server (`skill-registry`) that lets Claude Code search, inspect, and install skills from the registry
3. The MCP server registered in Claude Code and verified end-to-end

---

## How This Tutorial Works

**Part 1 — Set up Artifactory**
Create a JFrog Artifactory Skills repository and publish the three sample skills using `publish-skill.sh`. This gives the MCP server a real registry to talk to.

**Part 2 — Build the MCP server**
Use the `mcp-builder` skill with the spec in [`skill-registry-mcp-prompt.md`](skill-registry-mcp-prompt.md). The skill generates the full server implementation, tests, and documentation.

**Part 3 — Register and test**
Add the generated MCP server to Claude Code and verify the search, inspect, and install tools work against the skills published in Part 1.

The `mcp-builder` skill does the heavy lifting in Part 2 — it reads the specification and generates the full MCP server implementation, tests, and documentation.

---

## Prerequisites

- **Claude Code** with the `mcp-builder` skill installed
  - Install from: https://github.com/anthropics/skills
- **JFrog Artifactory** instance (free trial works — see Part 1)
- `curl` and `bash` (for `publish-skill.sh`)

---

## Part 1: Set Up Artifactory

### 1. Create an Artifactory instance

Sign up for a free JFrog Pro Cloud trial at https://jfrog.com/start-free/. Note your platform URL — it looks like `https://<your-id>.jfrog.io`.

### 2. Create a Skills repository

1. In the Artifactory UI, go to **Administration → Repositories**
2. Click **Create a Repository → Local**
3. Select package type **Skills** (requires open-beta enablement on free trial — contact JFrog support if it's not visible)
4. Set **Repository Key** to `skills-registry-local`
5. Click **Create Local Repository**

### 3. Get your credentials

You need a username and a password or identity token with write access to the repository.

To generate an identity token (recommended):
1. Click your user avatar → **Edit Profile**
2. Under **Identity Tokens**, click **Generate an Identity Token**
3. Copy the token — it is only shown once

### 4. Configure `.env`

Copy the example config and fill in your values:

```bash
cp env.example .env
```

Edit `.env`:

```
ARTIFACTORY_PLATFORM_URL=https://<your-id>.jfrog.io
ARTIFACTORY_REPOSITORY=skills-registry-local
ARTIFACTORY_AUTH_METHOD=basic
ARTIFACTORY_USERNAME=<your-username-or-email>
ARTIFACTORY_IDENTITY_TOKEN=<your-password-or-identity-token>
```

The `.env` file is git-ignored — never commit credentials.

> **Bearer token alternative:** Set `ARTIFACTORY_AUTH_METHOD=bearer` and `ARTIFACTORY_ACCESS_TOKEN=<token>` instead of username/identity token.

### 5. Publish the three sample skills

With `.env` configured, run `publish-skill.sh` for each sample skill:

```bash
./publish-skill.sh sample-skills/architecture-decision-record-author
./publish-skill.sh sample-skills/incident-runbook
./publish-skill.sh sample-skills/openapi-contract-check
```

> You can also pass credentials inline without editing `.env`:
> ```bash
> ARTIFACTORY_AUTH_METHOD=basic \
> ARTIFACTORY_USERNAME=you@example.com \
> ARTIFACTORY_IDENTITY_TOKEN=yourpassword \
>   ./publish-skill.sh sample-skills/architecture-decision-record-author
> ```

Each skill prints upload and property-set confirmations. Verify all three are published:

```bash
curl -u "<username>:<password>" \
  "https://<your-id>.jfrog.io/artifactory/api/skills/skills-registry-local/api/v1/search?q=a"
```

You should see all three skills returned:

```json
{
  "results": [
    { "name": "architecture-decision-record-author", "version": "1.1.0", ... },
    { "name": "incident-runbook",                    "version": "2.0.0", ... },
    { "name": "openapi-contract-check",              "version": "1.0.0", ... }
  ],
  "total": 3
}
```

Artifactory is now ready. Move on to Part 2.

---

## Part 2: Build the MCP Server with `mcp-builder`

### 1. Open an empty project directory

Create a fresh directory for the MCP server — it should not be inside this repository:

```bash
mkdir ~/skill-registry-mcp && cd ~/skill-registry-mcp
```

Open it in your editor and start Claude Code there.

### 2. Make sure the `mcp-builder` skill is available

Confirm the skill is installed in Claude Code. If not, install it from https://github.com/anthropics/skills before continuing.

### 3. Paste the build prompt into Claude Code

Open [`skill-registry-mcp-prompt.md`](skill-registry-mcp-prompt.md) in this repository and copy the entire prompt block (everything after the `---` divider). Paste it into Claude Code in your new project directory.

Claude Code will:
1. Read `mcp-builder`'s SKILL.md to understand the required structure
2. Propose an implementation plan (language, project layout, dependencies)
3. Wait for your confirmation before generating code

Review the plan and confirm. Claude Code will then produce the full MCP server — source code, tests, `.env.example`, README, and MCP client config snippets.

### What gets built

The generated `skill-registry` MCP server exposes three tools:

| Tool | Description |
|---|---|
| `search_skills` | Search the registry with a natural-language query |
| `get_skill_manifest` | Inspect a skill's SKILL.md and metadata without installing |
| `install_skill` | Download a skill to a local path |

The server is **registry-agnostic** — it talks to Artifactory through a `RegistryBackend` interface, making it straightforward to add other backends later.

---

## Part 3: Register the MCP Server and Test It

### 1. Configure the MCP server

In the generated project directory, copy `.env.example` to `.env` and populate it with the same Artifactory credentials from Part 1.

### 2. Register with Claude Code

Add the MCP server to your Claude Code configuration. The generated project README includes the exact config snippet, but it will look something like:

**`~/.claude/claude_desktop_config.json`** (Claude Desktop) or your Claude Code MCP settings:

```json
{
  "mcpServers": {
    "skill-registry": {
      "command": "python",
      "args": ["-m", "skill_registry"],
      "cwd": "/path/to/skill-registry-mcp",
      "env": {
        "SKILL_REGISTRY_BACKEND": "artifactory",
        "ARTIFACTORY_PLATFORM_URL": "https://<your-id>.jfrog.io",
        "ARTIFACTORY_REPOSITORY": "skills-registry-local",
        "ARTIFACTORY_AUTH_METHOD": "bearer",
        "ARTIFACTORY_ACCESS_TOKEN": "<your-token>"
      }
    }
  }
}
```

Restart Claude Code to pick up the new server.

### 3. Test the tools

With the MCP server registered, ask Claude Code to exercise each tool:

**Search:**
```
Search the skill registry for skills related to incident response.
```

**Inspect:**
```
Get the manifest for the incident-runbook skill.
```

**Install:**
```
Install the architecture-decision-record-author skill to ~/.claude/skills/
```

Claude Code will call the MCP tools automatically based on these prompts. Confirm the results match the skills you published in Part 1.

---

## Sample Skills Reference

The three skills published in Part 1 cover common developer workflows:

| Skill | Version | Description |
|---|---|---|
| `architecture-decision-record-author` | 1.1.0 | Authors Architecture Decision Records (ADRs) from a conversational description of any technical decision |
| `incident-runbook` | 2.0.0 | AI co-pilot for live incident response (triage → communicate → mitigate → resolve) and postmortem writing |
| `openapi-contract-check` | 1.0.0 | Audits an OpenAPI/Swagger spec against a 30+ rule catalog for completeness, consistency, and contract quality |

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
description: "What the skill does and when to trigger it."
author: your-name-or-email
tags: [tag1, tag2, tag3]
---
```

### `publish-skill.sh`

The script reads `SKILL.md` frontmatter, uploads all files in the skill directory to `<repo>/<name>/<version>/`, and sets `skill.*` properties on `SKILL.md` so the skill is indexed by the Artifactory search API.

```bash
./publish-skill.sh path/to/your-skill
```

---

## License

MIT
