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
- **Returns:** object with `slug`, `version`, `skill_md_content` (raw markdown), `metadata` (parsed frontmatter), `fingerprint` (empty string — see note below)

#### `install_skill`
- **Description:** Download the full skill directory (all files in the skill bundle) to a local destination path. Use this once the agent or user has decided to use the skill.
- **Arguments:**
  - `slug` (string, required): skill identifier
  - `version` (string, optional, default "latest"): specific version or "latest"
  - `destination_path` (string, required): absolute local path where the skill directory should be written
- **Returns:** object with `slug`, `version`, `installed_path`, `files_written` (count), `fingerprint` (empty string — see note below)

### Artifactory Backend Implementation

The `ArtifactoryBackend` should implement the three operations using Artifactory's ClawHub v1–compatible REST API. Use the REST API directly (HTTP client of your choice) rather than shelling out to `jf skills`. Reasons: simpler dependency footprint, easier to handle errors programmatically, no requirement that the host has the JFrog CLI installed.

**Base URL pattern:**
```
https://<JFROG_PLATFORM_URL>/artifactory/api/skills/<REPOSITORY_NAME>
```

**Authentication:** Bearer token via `Authorization: Bearer <ACCESS_TOKEN>` header, OR HTTP Basic with username + identity token. Support both; prefer Bearer.

**Two HTTP clients required.** The backend needs two axios (or equivalent) client instances:

1. **Skills API client** — base URL: `${PLATFORM_URL}/artifactory/api/skills/${REPOSITORY}` — used only for search and fetching SKILL.md.
2. **Native Artifactory client** — base URL: `${PLATFORM_URL}/artifactory` — used for version resolution and file downloads (see below). Both clients share the same auth headers and TLS settings.

**Endpoints to use:**

| Operation | Client | Endpoint | Method |
|---|---|---|---|
| Search skills | Skills API | `/api/v1/search?q=<query>&limit=<n>&offset=0` | GET |
| Fetch SKILL.md | Skills API | `/api/v1/skills/{slug}/file?version=<version>&path=SKILL.md` | GET |
| Resolve latest version | Native | `/api/storage/{repo}/{slug}` | GET |
| List files in version | Native | `/api/storage/{repo}/{slug}/{version}?list&deep=1&listFolders=0` | GET |
| Download individual file | Native | `/{repo}/{slug}/{version}/{relPath}` | GET |

> **Critical:** The following endpoints are **not implemented** or require special permissions. **Do not call them:**
> - `/api/v1/skills/{slug}` — does not exist (404)
> - `/api/v1/skills/{slug}/versions/{version}` — does not exist (404)
> - `/api/v1/download?slug=<slug>&version=<version>` — does not exist (404); skills are stored as individual files, not pre-built zips
> - `/api/archive/download/{repo}/{slug}/{version}?archiveType=zip` — requires special "Archive Retrieval" permissions not granted by a standard identity token; do not use

**Version resolution for "latest":** The Skills API search endpoint (`/api/v1/search?q=...`) performs **text search against description and tags** — it does **not** match on skill names or slugs. Searching for a full slug like `"my-skill-name"` returns zero results. To resolve `"latest"` to a concrete version, use the **native Artifactory storage listing** instead:

```
GET /api/storage/{repo}/{slug}
```

This returns a directory listing with `children` — filter for entries where `folder: true`, parse the `uri` fields as semver strings (e.g., `/1.1.0`), and return the highest version. If no version folders are found, throw NOT_FOUND.

**Fingerprint:** There is no endpoint to fetch a remote fingerprint for verification. Do not attempt fingerprint validation. Return an empty string `""` for the `fingerprint` field in both `get_skill_manifest` and `install_skill` responses.

**Install behavior:** Skills are stored as individual files uploaded via PUT — there is no pre-built zip bundle and no zip download endpoint. To install a skill:

1. Call `GET /api/storage/{repo}/{slug}/{version}?list&deep=1&listFolders=0` (native client) to get the full recursive file list. Response shape: `{ "files": [{ "uri": "/SKILL.md", "size": 123 }, { "uri": "/references/foo.md", "size": 456 }] }`.
2. For each file entry, strip the leading `/` from `uri` to get the relative path, then download it from `GET /{repo}/{slug}/{version}/{relPath}` (native client, `responseType: 'arraybuffer'`).
3. Assemble all downloaded buffers into a zip in memory (e.g., using `adm-zip`'s `addFile(relPath, buffer)`), then extract the zip to `destination_path`.
4. Return `files_written` as the count of files downloaded.

**Search response — use these exact field names from the Artifactory API:**

```json
{
  "results": [
    {
      "name": "my-skill-slug",
      "version": "1.0.0",
      "description": "One-line description of the skill.",
      "author": "skill-registry-sample",
      "downloadUrl": "api/v1/download?slug=my-skill-slug&version=1.0.0",
      "tags": ["tag-a", "tag-b"],
      "match": 0.95
    }
  ],
  "total": 1,
  "offset": 0,
  "limit": 20
}
```

Map to the MCP `search_skills` return shape as follows:

| MCP field | Artifactory field | Notes |
|---|---|---|
| `slug` | `name` | Direct mapping — the API uses `name`, not `slug` |
| `display_name` | derived from `name` | Convert kebab-case to Title Case: `my-skill-slug` → `My Skill Slug` |
| `summary` | `description` | Direct mapping — the API uses `description`, not `summary` |
| `latest_version` | `version` | Direct mapping |
| `tags` | `tags` | Already present in the search response — **no secondary call needed** |
| `updated_at` | *(not available)* | Return empty string `""` |

> **Do not** make a secondary enrichment request per result. Tags and description are already in the search response. The per-skill info endpoint (`/api/v1/skills/{slug}`) returns 404.

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
3. Generate an identity token: top-right user menu → **Edit Profile** → **Generate an Identity Token**. Copy the full token value — it is a long string, not a short UUID.
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
   ARTIFACTORY_ACCESS_TOKEN=<paste-full-identity-token>
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
4. **Error-path tests**: invalid auth, missing skill, network failures. Note: fingerprint mismatch is **not a test case** — the Artifactory Skills API does not expose a fingerprint endpoint, so no fingerprint verification is performed.
5. **Config validation tests**: missing env vars, invalid combinations (e.g., `auth_method: bearer` without access token).

Mock fixtures used in unit tests must use the **actual Artifactory API field names** (`name`, `description`, `tags`) — not assumed names like `slug`, `displayName`, or `summary`. This ensures tests catch field mapping regressions.

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
- Do **not** call `/api/v1/skills/{slug}` or `/api/v1/skills/{slug}/versions/{version}` — these endpoints return 404 in the current Artifactory Skills API.
- Do **not** call `/api/v1/download` — this endpoint does not exist; skills are stored as individual files, not pre-built zip bundles.
- Do **not** use the search endpoint (`/api/v1/search?q=<slug>`) to resolve a skill's latest version — the `q` parameter is a text search against description and tags, not a name lookup. Use the native storage listing API instead.
- Do **not** call `/api/archive/download/...` — this requires special "Archive Retrieval" permissions not available with a standard identity token.

Begin by reading `mcp-builder`'s SKILL.md, then propose your implementation plan (language choice, project structure, dependencies) before writing code. Wait for confirmation before implementing.

---

**End of prompt.**
