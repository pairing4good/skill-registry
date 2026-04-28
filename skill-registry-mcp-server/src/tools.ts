import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { RegistryError } from './errors.js';
import type { RegistryBackend } from './backends/interface.js';

function formatError(err: unknown): string {
  if (err instanceof RegistryError) return `Error: ${err.message}`;
  if (err instanceof Error) return `Error: ${err.message}`;
  return 'Error: An unexpected error occurred.';
}

export function registerTools(server: McpServer, backend: RegistryBackend): void {
  // -------------------------------------------------------------------------
  // search_skills
  // -------------------------------------------------------------------------
  server.registerTool(
    'search_skills',
    {
      title: 'Search Skills',
      description: `Search the registry for skills matching a natural-language query.

Returns a ranked list of skills with enough metadata to decide whether to inspect a candidate further. Use get_skill_manifest to read a skill's full documentation before installing.

Args:
  - query (string): Natural-language description of the desired capability (e.g., "incident response", "write an ADR", "OpenAPI validation")
  - limit (number): Maximum results to return, 1–100 (default: 20)

Returns: Array of objects with:
  - slug (string): Unique skill identifier used in other tools
  - display_name (string): Human-readable skill name
  - summary (string): One-line description of what the skill does
  - latest_version (string): Most recent published version
  - tags (string[]): Categorisation tags
  - updated_at (string): ISO 8601 timestamp of last update

Examples:
  - "Find skills for writing incident postmortems" → query="incident postmortem"
  - "Any skills for code review?" → query="code review"

Error handling:
  - Returns "Error: Authentication failed" if credentials are invalid
  - Returns "Error: Registry unavailable" if the backend is unreachable`,
      inputSchema: z.object({
        query: z
          .string()
          .min(1, 'Query must not be empty')
          .max(500, 'Query must not exceed 500 characters')
          .describe('Natural-language description of the desired capability'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .default(20)
          .describe('Maximum number of results to return (default: 20, max: 100)'),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ query, limit }) => {
      try {
        const results = await backend.searchSkills(query, limit);

        if (results.length === 0) {
          return {
            content: [{ type: 'text', text: `No skills found matching "${query}".` }],
            structuredContent: { results: [], total: 0 },
          };
        }

        const structured = { results, total: results.length };

        const lines = [
          `# Skill Search Results: "${query}"`,
          '',
          `Found ${results.length} skill(s).`,
          '',
        ];
        for (const s of results) {
          lines.push(`## ${s.display_name} (\`${s.slug}\`)`);
          lines.push(`**Version**: ${s.latest_version}  `);
          if (s.summary) lines.push(`**Summary**: ${s.summary}  `);
          if (s.tags.length) lines.push(`**Tags**: ${s.tags.join(', ')}  `);
          if (s.updated_at) lines.push(`**Updated**: ${s.updated_at}  `);
          lines.push('');
        }

        return {
          content: [{ type: 'text', text: lines.join('\n') }],
          structuredContent: structured,
        };
      } catch (err) {
        return { content: [{ type: 'text', text: formatError(err) }] };
      }
    },
  );

  // -------------------------------------------------------------------------
  // get_skill_manifest
  // -------------------------------------------------------------------------
  server.registerTool(
    'get_skill_manifest',
    {
      title: 'Get Skill Manifest',
      description: `Retrieve the SKILL.md content and parsed metadata for a specific skill version.

Use this to inspect a candidate skill before installing it. This is a lightweight read — it does not download the full skill bundle.

Args:
  - slug (string): Skill identifier (from search_skills results)
  - version (string): Specific version (e.g., "1.2.0") or "latest" (default: "latest")

Returns: Object with:
  - slug (string): Skill identifier
  - version (string): Resolved version string
  - skill_md_content (string): Raw SKILL.md markdown content
  - metadata (object): Parsed SKILL.md frontmatter (name, version, description, author, tags)
  - fingerprint (string): SHA-256 hash of the skill bundle

Examples:
  - Inspect before installing: get_skill_manifest with slug="incident-runbook"
  - Check a specific version: get_skill_manifest with slug="openapi-contract-check", version="1.0.0"

Error handling:
  - Returns "Error: Not found" if the slug or version does not exist`,
      inputSchema: z.object({
        slug: z
          .string()
          .min(1, 'Slug must not be empty')
          .describe('Skill identifier'),
        version: z
          .string()
          .default('latest')
          .describe('Version string or "latest" (default: "latest")'),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ slug, version }) => {
      try {
        const manifest = await backend.getSkillManifest(slug, version);

        const lines = [
          `# Skill Manifest: ${slug}@${manifest.version}`,
          '',
          `**Fingerprint**: \`${manifest.fingerprint}\``,
          '',
          '## SKILL.md',
          '',
          manifest.skill_md_content,
        ];

        return {
          content: [{ type: 'text', text: lines.join('\n') }],
          structuredContent: manifest as unknown as Record<string, unknown>,
        };
      } catch (err) {
        return { content: [{ type: 'text', text: formatError(err) }] };
      }
    },
  );

  // -------------------------------------------------------------------------
  // install_skill
  // -------------------------------------------------------------------------
  server.registerTool(
    'install_skill',
    {
      title: 'Install Skill',
      description: `Download the full skill directory to a local destination path.

Use this once the agent or user has decided to use a skill. The skill bundle (zip) is downloaded, its SHA-256 fingerprint is verified, and all files are extracted to destination_path. Installation is explicit and version-pinned — the server never auto-updates installed skills.

Args:
  - slug (string): Skill identifier
  - version (string): Specific version (e.g., "1.2.0") or "latest" (default: "latest")
  - destination_path (string): Absolute local path where the skill directory should be written

Returns: Object with:
  - slug (string): Skill identifier
  - version (string): Resolved version installed
  - installed_path (string): Absolute path where files were written
  - files_written (number): Count of files extracted
  - fingerprint (string): SHA-256 hash verified during install

Examples:
  - Install latest: install_skill with slug="incident-runbook", destination_path="/home/user/.claude/skills/incident-runbook"
  - Pin a version: install_skill with slug="openapi-contract-check", version="1.0.0", destination_path="/opt/skills/openapi-contract-check"

Error handling:
  - Returns "Error: Fingerprint mismatch" if the downloaded bundle is corrupted or tampered
  - Returns "Error: Not found" if the slug or version does not exist`,
      inputSchema: z.object({
        slug: z
          .string()
          .min(1, 'Slug must not be empty')
          .describe('Skill identifier'),
        version: z
          .string()
          .default('latest')
          .describe('Version string or "latest" (default: "latest")'),
        destination_path: z
          .string()
          .min(1, 'Destination path must not be empty')
          .describe('Absolute local path where the skill directory should be written'),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ slug, version, destination_path }) => {
      try {
        const result = await backend.installSkill(slug, version, destination_path);

        const lines = [
          `# Skill Installed: ${result.slug}@${result.version}`,
          '',
          `**Path**: \`${result.installed_path}\`  `,
          `**Files written**: ${result.files_written}  `,
          `**Fingerprint**: \`${result.fingerprint}\`  `,
        ];

        return {
          content: [{ type: 'text', text: lines.join('\n') }],
          structuredContent: result as unknown as Record<string, unknown>,
        };
      } catch (err) {
        return { content: [{ type: 'text', text: formatError(err) }] };
      }
    },
  );
}
