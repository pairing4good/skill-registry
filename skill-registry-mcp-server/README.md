# skill-registry MCP Server

An MCP server that lets Claude Code (and any MCP-compatible client) **search**, **inspect**, and **install** skills from a skill registry.

The server is **registry-agnostic**: tool names and arguments contain no backend-specific terms. The initial backing store is JFrog Artifactory's Skills package type; additional backends can be added without changing the MCP tool surface.

---

## Tools

| Tool | Description |
|------|-------------|
| `search_skills` | Search the registry with a natural-language query |
| `get_skill_manifest` | Retrieve SKILL.md and metadata without installing |
| `install_skill` | Download and extract the full skill bundle to a local path |

---

## Free-Trial Quick-Start

### 1. Create a JFrog Artifactory instance

Sign up for a free Pro Cloud trial at https://jfrog.com/start-free/. Note your platform URL — it looks like `https://<your-id>.jfrog.io`.

### 2. Create a Skills repository

1. In the JFrog UI go to **Administration → Repositories → Create a Repository**
2. Choose **Local**, select package type **Skills**
   > If **Skills** is not visible, contact JFrog support to enable the open-beta feature on your trial.
3. Set **Repository Key** to `skills-registry-local`
4. Click **Create Local Repository**

### 3. Generate an identity token

1. Click your user avatar (top right) → **Edit Profile**
2. Under **Identity Tokens**, click **Generate an Identity Token**
3. Copy the token — it is shown only once

### 4. Configure `.env`

```bash
cp .env.example .env
```

Edit `.env`:

```env
SKILL_REGISTRY_BACKEND=artifactory
ARTIFACTORY_PLATFORM_URL=https://<your-id>.jfrog.io
ARTIFACTORY_REPOSITORY=skills-registry-local
ARTIFACTORY_AUTH_METHOD=bearer
ARTIFACTORY_ACCESS_TOKEN=<paste-identity-token>
```

`.env` is listed in `.gitignore` — it is never committed.

### 5. Build and start the server

```bash
npm install
npm run build
npm start
```

The server starts and listens on stdio, ready for MCP clients.

---

## MCP Client Setup

### Claude Code

Add to `~/.claude/claude_desktop_config.json` (or your project `.claude/settings.json`):

```json
{
  "mcpServers": {
    "skill-registry": {
      "command": "node",
      "args": ["/absolute/path/to/skill-registry-mcp-server/dist/index.js"],
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

### Claude Desktop

Add the same block under `mcpServers` in `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows).

### Using a `.env` file instead of inline env vars

If you prefer keeping credentials in `.env`, omit the `env` block from the config and run the server from its project directory so dotenv finds the `.env` file automatically:

```json
{
  "mcpServers": {
    "skill-registry": {
      "command": "node",
      "args": ["dist/index.js"],
      "cwd": "/absolute/path/to/skill-registry-mcp-server"
    }
  }
}
```

---

## Configuration Reference

All settings are read from environment variables. A `.env` file in the server's working directory is loaded automatically at startup.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SKILL_REGISTRY_BACKEND` | No | `artifactory` | Backend type. Only `artifactory` is currently supported. |
| `ARTIFACTORY_PLATFORM_URL` | Yes | — | JFrog platform URL, e.g. `https://acme.jfrog.io` |
| `ARTIFACTORY_REPOSITORY` | Yes | — | Skills repository key, e.g. `skills-registry-local` |
| `ARTIFACTORY_AUTH_METHOD` | No | `bearer` | `bearer` or `basic` |
| `ARTIFACTORY_ACCESS_TOKEN` | If bearer | — | Identity or access token |
| `ARTIFACTORY_USERNAME` | If basic | — | Username or email |
| `ARTIFACTORY_IDENTITY_TOKEN` | If basic | — | Password or identity token |
| `ARTIFACTORY_TIMEOUT_SECONDS` | No | `30` | HTTP request timeout |
| `ARTIFACTORY_VERIFY_TLS` | No | `true` | Verify TLS certificates. Never set `false` in production. |
| `SKILL_REGISTRY_LOG_LEVEL` | No | `info` | `debug`, `info`, `warn`, or `error` |
| `SKILL_REGISTRY_CACHE_DIR` | No | `~/.cache/skill-registry` | Directory for downloaded skills |
| `SKILL_REGISTRY_RATE_LIMIT_RPM` | No | `60` | Max requests per minute to the backend |

---

## Enterprise Hardening

### Use a service account

Create a dedicated Artifactory user with **read-only** permissions on the Skills repository. Generate its identity token. Rotate quarterly.

### Scope permissions narrowly

The MCP server's account needs only `read` on the target Skills repository — no write, no admin, no other repositories.

### Prefer OIDC where supported

If your deployment environment supports JFrog OIDC integration (GitHub Actions, Kubernetes), use short-lived OIDC tokens instead of long-lived identity tokens.

### Store secrets in a secret manager

Populate environment variables from Vault, AWS Secrets Manager, Azure Key Vault, or equivalent. Never hardcode credentials in shell scripts or config files committed to source control.

### Network isolation

For self-hosted Artifactory, run the MCP server inside the same VPC or with private endpoint connectivity. Avoid traversing the public internet for registry calls when possible.

### TLS verification

`ARTIFACTORY_VERIFY_TLS=true` is the default. Do not disable it in any internet-facing or production environment.

### Audit logging

Every install operation is logged (slug, version, timestamp). Credentials and response bodies are never logged. Forward logs to your enterprise logging stack.

### Rate limiting

The server enforces client-side rate limiting (default: 60 RPM) with exponential backoff on 429 and 5xx responses. Adjust `SKILL_REGISTRY_RATE_LIMIT_RPM` to fit your Artifactory tier.

---

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run in dev mode (auto-reload)
npm run dev

# Run tests
npm test

# Run integration tests (requires real Artifactory)
INTEGRATION=1 \
  ARTIFACTORY_PLATFORM_URL=https://<your-id>.jfrog.io \
  ARTIFACTORY_REPOSITORY=skills-registry-local \
  ARTIFACTORY_AUTH_METHOD=bearer \
  ARTIFACTORY_ACCESS_TOKEN=<token> \
  npm run test:integration
```

---

## Adding a New Backend

To add a backend (e.g. a GitHub-based registry):

1. **Implement the interface** — create `src/backends/github.ts` that implements `RegistryBackend`:

   ```typescript
   import type { RegistryBackend } from './interface.js';

   export class GitHubBackend implements RegistryBackend {
     async searchSkills(query: string, limit: number) { /* ... */ }
     async getSkillManifest(slug: string, version: string) { /* ... */ }
     async installSkill(slug: string, version: string, destinationPath: string) { /* ... */ }
   }
   ```

2. **Add config** — extend `ArtifactoryConfig`-style interface in `src/config.ts` with a `GitHubConfig` shape and add the new env vars.

3. **Register** — in `src/index.ts`, update the backend factory to handle `SKILL_REGISTRY_BACKEND=github`:

   ```typescript
   if (config.backend === 'github') {
     backend = new GitHubBackend(config.github, config.rateLimitRpm);
   }
   ```

4. **Update `BackendType`** — add `'github'` to the union in `src/config.ts`.

5. **Write tests** — add `tests/backends/github.integration.test.ts` following the same pattern as the Artifactory integration tests.

The MCP tool surface (`search_skills`, `get_skill_manifest`, `install_skill`) and their schemas stay unchanged — clients see no difference.

---

## License

MIT
