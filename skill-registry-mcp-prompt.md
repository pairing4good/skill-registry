# Claude Code Input: Build the `skill-registry` MCP Server

## Prompt for Claude Code

I want you to use the `mcp-builder` skill to create an MCP server called `skill-registry`. Read `mcp-builder`'s SKILL.md first and follow its guidance for structure, testing, and packaging. Then build the server according to the specification below.

### Purpose

The `skill-registry` MCP server lets an AI agent (Claude Code, or any MCP-compatible client) discover and install Anthropic-style skills stored in a remote registry. The initial backing store is JFrog Artifactory's Skills package type (open beta, ClawHub v1–compatible), but the server must be **registry-agnostic** so additional backends can be added later without changing the MCP tool surface.

### Design Principles

1. **Registry-agnostic tool surface.** MCP tool names and arguments must not contain "artifactory", "jfrog", or "clawhub". They describe registry operations in neutral terms (search, get, install).
2. **Backend abstraction.** Create a `RegistryBackend` interface (or equivalent in the chosen language) with one concrete implementation: `ArtifactoryBackend`. Future backends (e.g., a generic ClawHub registry, a filesystem registry, a GitHub-based registry) should be addable by implementing the same interface.
3. **Configuration-driven backend selection.** A config file or environment variables select which backend is active and provide its credentials. The MCP tools never expose backend-specific config to the agent.
4. **Read-only by design.** This server only searches and installs. It does not publish, delete, or modify skills. Publishing belongs in CI/CD with a separate identity.
5. **Secure by default.** Credentials never appear in logs, tool responses, or error messages. Failed auth produces a generic "authentication failed" error.

### MCP Tools to Expose

Implement exactly these three tools:

#### `search_skills`
- **Description:** Search the registry for skills matching a natural-language query. Returns a ranked list with enough metadata to decide whether to inspect a candidate further.
- **Arguments:**
  - `query` (string, required): natural-language description of the desired capability
  - `limit` (integer, optional, default 20, max 100): maximum results to return
- **Returns:** array of objects with `slug`, `display_name`, `summary`, `latest_version`, `tags`, `updated_at`

#### `get_skill_manifest`
- **Description:** Retrieve only the SKILL.md content and parsed metadata for a specific skill version. Use this to inspect a candidate match without installing it.
- **Arguments:**
  - `slug` (string, required): skill identifier
  - `version` (string, optional, default "latest"): specific version or "latest"
- **Returns:** object with `slug`, `version`, `skill_md_content` (raw markdown), `metadata` (parsed frontmatter), `fingerprint`

#### `install_skill`
- **Description:** Download the full skill directory (all files in the skill bundle) to a local destination path. Use this once the agent or user has decided to use the skill.
- **Arguments:**
  - `slug` (string, required): skill identifier
  - `version` (string, optional, default "latest"): specific version or "latest"
  - `destination_path` (string, required): absolute local path where the skill directory should be written
- **Returns:** object with `slug`, `version`, `installed_path`, `files_written` (count), `fingerprint`

### Artifactory Backend Implementation

The `ArtifactoryBackend` should implement the three operations using Artifactory's ClawHub v1–compatible REST API. Use the REST API directly (HTTP client of your choice) rather than shelling out to `jf skills`. Reasons: simpler dependency footprint, easier to handle errors programmatically, no requirement that the host has the JFrog CLI installed.

**Base URL pattern:**
```
https://<JFROG_PLATFORM_URL>/artifactory/api/skills/<REPOSITORY_NAME>
```

**Authentication:** Bearer token via `Authorization: Bearer <ACCESS_TOKEN>` header, OR HTTP Basic with username + identity token. Support both; prefer Bearer.

**Endpoints to use:**

| MCP Tool | Artifactory Endpoint | Method |
|---|---|---|
| `search_skills` | `/api/v1/search?q=<query>&limit=<n>&offset=0` | GET |
| `get_skill_manifest` | `/api/v1/skills/{slug}/file?version=<version>&path=SKILL.md` | GET |
| `get_skill_manifest` (metadata) | `/api/v1/skills/{slug}/versions/{version}` | GET |
| `install_skill` | `/api/v1/download?slug=<slug>&version=<version>` | GET (returns zip) |

**Version resolution for "latest":** call `/api/v1/skills/{slug}` and read `latestVersion`, then use that.

**Install behavior:** the download endpoint returns a zip. Unzip into `destination_path`, preserving directory structure. Verify the SHA-256 of the downloaded zip matches the `fingerprint` returned by `/api/v1/skills/{slug}/versions/{version}` before unzipping. Refuse to install if the fingerprint doesn't match and return a clear error.

**Search response mapping:** Artifactory returns `{results: [{slug, version, displayName, summary, match}], total, limit, offset}`. Map to the MCP `search_skills` return shape. If `tags` or `updated_at` are not in the search response, fetch them via `/api/v1/skills/{slug}` for the top results, but cap this enrichment at the top 10 to avoid latency blowup.

**Error handling:** translate HTTP 401/403 → "authentication failed" (no credential details), 404 → "skill not found", 5xx → "registry unavailable, retry later". Other errors → generic message with HTTP status code.

### Configuration

The server reads configuration from environment variables (preferred for secrets) with optional config-file fallback. A sample `.env.example` file is provided alongside this prompt and documents every supported variable with comments. The MCP server should load environment variables from a local `.env` file at startup if present (using a standard library like `python-dotenv`, `dotenv` for Node, or equivalent), and fall back to process environment variables otherwise.

The `.env.example` file provides:

- **Backend selection:** `SKILL_REGISTRY_BACKEND` (currently only `artifactory` is supported)
- **Connection settings:** `ARTIFACTORY_PLATFORM_URL`, `ARTIFACTORY_REPOSITORY`
- **Authentication:** `ARTIFACTORY_AUTH_METHOD` (bearer or basic), with `ARTIFACTORY_ACCESS_TOKEN` for bearer or `ARTIFACTORY_USERNAME` + `ARTIFACTORY_IDENTITY_TOKEN` for basic
- **Optional connection tuning:** `ARTIFACTORY_TIMEOUT_SECONDS`, `ARTIFACTORY_VERIFY_TLS`
- **MCP server settings:** `SKILL_REGISTRY_LOG_LEVEL`, `SKILL_REGISTRY_CACHE_DIR`, `SKILL_REGISTRY_RATE_LIMIT_RPM`
- **Inline security guidance:** comments explaining never to commit the file, to use service accounts rather than personal tokens, and to source values from a secret manager in production

The implementation should:

1. Ship `.env.example` in the repository root as a reference for users
2. Add `.env` to `.gitignore` to prevent accidental commits
3. Document in the README that users copy `.env.example` to `.env` and populate the values
4. Validate config on startup and fail fast with a clear error if required values are missing or malformed (e.g., `ARTIFACTORY_AUTH_METHOD=bearer` without `ARTIFACTORY_ACCESS_TOKEN`)

The full config schema is also documented as YAML for users who prefer config files over environment variables — but environment variables always take precedence:

```yaml
backend: artifactory   # required; only "artifactory" supported initially
artifactory:
  platform_url: https://<your-instance>.jfrog.io
  repository: skills-local
  auth_method: bearer  # "bearer" or "basic"
  # For bearer:
  access_token: <ENV: ARTIFACTORY_ACCESS_TOKEN>
  # For basic:
  username: <ENV: ARTIFACTORY_USERNAME>
  identity_token: <ENV: ARTIFACTORY_IDENTITY_TOKEN>
  # Optional:
  timeout_seconds: 30
  verify_tls: true
```

### Free-Trial Quick-Start (for the README)

The server should work out of the box with a JFrog free trial (Pro Cloud). Document this setup in the README:

1. Sign up at https://jfrog.com/start-free/ for a free Pro Cloud trial. Note your platform URL (looks like `https://<id>.jfrog.io`).
2. In the JFrog UI, go to **Administration → Repositories → Create a Repository**, choose **Local**, select package type **Skills**, name it `skills-local`. (Skills package type requires open-beta enablement on the trial; if not visible, contact JFrog support to enable it.)
3. Generate an identity token: top-right user menu → **Edit Profile** → **Generate an Identity Token**. Copy the token.
4. Copy `.env.example` to `.env` in the project root and populate the values:
   ```bash
   cp .env.example .env
   ```
   Then edit `.env`:
   ```
   SKILL_REGISTRY_BACKEND=artifactory
   ARTIFACTORY_PLATFORM_URL=https://<your-id>.jfrog.io
   ARTIFACTORY_REPOSITORY=skills-local
   ARTIFACTORY_AUTH_METHOD=bearer
   ARTIFACTORY_ACCESS_TOKEN=<paste-identity-token>
   ```
   Confirm `.env` is listed in `.gitignore` so it is not committed.
5. Run the MCP server. The server loads `.env` at startup automatically. Configure your MCP client (Claude Code, Claude Desktop, etc.) to connect to it.

### Enterprise Hardening Notes (also for README)

Document these recommendations clearly so enterprises can adopt securely:

- **Use a service account, not a personal token.** Create a dedicated Artifactory user with **read-only** permissions on the Skills repository. Generate its identity token. Rotate quarterly.
- **Scope permissions narrowly.** The MCP server's account needs only `read` on the target Skills repository. No write, no admin, no other repositories.
- **Prefer OIDC where supported.** If the deployment environment supports JFrog OIDC integration (e.g., GitHub Actions, Kubernetes), use short-lived OIDC tokens instead of long-lived identity tokens. The server should accept either.
- **Store secrets in a secret manager.** Environment variables should be populated from Vault, AWS Secrets Manager, Azure Key Vault, or equivalent — not hardcoded in shell scripts or config files committed to source control.
- **Network isolation.** For self-hosted Artifactory, prefer running the MCP server inside the same VPC or with private endpoint connectivity. Avoid traversing the public internet for registry calls when possible.
- **TLS verification on by default.** `verify_tls: true` is the default; do not document how to disable it in normal operation.
- **Audit logging.** Log every install operation (slug, version, requesting client, timestamp) but never log credentials, tokens, or response bodies that might contain sensitive data. Ensure logs are forwarded to the enterprise's logging stack.
- **Rate limiting.** Implement client-side rate limiting (e.g., max 60 requests/minute per backend) to avoid hammering Artifactory. Use exponential backoff on 429 and 5xx responses.

### Testing Requirements

Per `mcp-builder`'s guidance, include:

1. **Unit tests** for the `RegistryBackend` interface contract using a fake/mock backend.
2. **Integration tests** for `ArtifactoryBackend` that hit a real Artifactory instance. These should be opt-in (skipped unless env vars are set) and documented in the README. Include a sample skill to publish for the integration tests.
3. **MCP tool tests** that exercise each tool through the MCP protocol with a mock backend.
4. **Error-path tests**: invalid auth, missing skill, malformed responses, network failures, fingerprint mismatch.
5. **Config validation tests**: missing env vars, invalid combinations (e.g., `auth_method: bearer` without access token).

### Deliverables

Following `mcp-builder`'s structure, produce:

- Source code for the MCP server with the `RegistryBackend` interface and `ArtifactoryBackend` implementation
- `.env.example` file in the repository root documenting every supported environment variable, with inline comments explaining each value and security guidance (do not commit, use service accounts, prefer secret managers in production)
- `.gitignore` entry for `.env` to prevent accidental commits
- A complete README covering: free-trial quick-start (referencing the `.env.example` workflow), enterprise hardening notes, configuration reference, MCP client setup examples (Claude Code, Claude Desktop)
- Tests as specified above
- An example MCP client config snippet
- A LICENSE file (Apache 2.0 unless `mcp-builder` recommends otherwise)
- A clear extension guide for adding new backends — what interface methods to implement, where the backend registration happens, how to add config schema for the new backend

### Important Constraints

- Do **not** implement publish, delete, or any write operations. The tool surface stays read-only.
- Do **not** hardcode "artifactory" anywhere in MCP tool names, descriptions, or argument names.
- Do **not** include credential values in any error message returned to the MCP client.
- Do **not** auto-update or auto-refresh installed skills. Installation is explicit and version-pinned.
- Do **not** require the JFrog CLI to be installed on the host running the MCP server. Use the REST API directly.

Begin by reading `mcp-builder`'s SKILL.md, then propose your implementation plan (language choice, project structure, dependencies) before writing code. Wait for confirmation before implementing.

---

**End of prompt.**
