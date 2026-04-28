import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { describe, expect, it, beforeEach } from 'vitest';
import type { RegistryBackend } from '../src/backends/interface.js';
import { RegistryError } from '../src/errors.js';
import { registerTools } from '../src/tools.js';
import type { InstallResult, SkillManifest, SkillSummary } from '../src/types.js';
import {
  MOCK_SKILL_MD,
  MOCK_VERSION_INFO,
} from './fixtures/mock-responses.js';

// Configurable fake backend for error path testing
class StubBackend implements RegistryBackend {
  constructor(
    private readonly overrides: Partial<{
      searchSkills: RegistryBackend['searchSkills'];
      getSkillManifest: RegistryBackend['getSkillManifest'];
      installSkill: RegistryBackend['installSkill'];
    }> = {},
  ) {}

  async searchSkills(query: string, limit: number): Promise<SkillSummary[]> {
    if (this.overrides.searchSkills) return this.overrides.searchSkills(query, limit);
    return [
      {
        slug: 'incident-runbook',
        display_name: 'Incident Runbook',
        summary: 'AI co-pilot for incidents.',
        latest_version: '2.0.0',
        tags: ['incident-response'],
        updated_at: '2026-01-15T10:00:00Z',
      },
    ];
  }

  async getSkillManifest(slug: string, version: string): Promise<SkillManifest> {
    if (this.overrides.getSkillManifest) return this.overrides.getSkillManifest(slug, version);
    return {
      slug,
      version: version === 'latest' ? '2.0.0' : version,
      skill_md_content: MOCK_SKILL_MD,
      metadata: { name: slug, version: '2.0.0' },
      fingerprint: MOCK_VERSION_INFO.fingerprint,
    };
  }

  async installSkill(slug: string, version: string, destinationPath: string): Promise<InstallResult> {
    if (this.overrides.installSkill) return this.overrides.installSkill(slug, version, destinationPath);
    return {
      slug,
      version: version === 'latest' ? '2.0.0' : version,
      installed_path: destinationPath,
      files_written: 2,
      fingerprint: MOCK_VERSION_INFO.fingerprint,
    };
  }
}

async function createConnectedPair(
  backend: RegistryBackend,
): Promise<{ client: Client; cleanup: () => Promise<void> }> {
  const server = new McpServer({ name: 'test-server', version: '0.0.1' });
  registerTools(server, backend);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '0.0.1' });

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  return {
    client,
    cleanup: async () => {
      await client.close();
    },
  };
}

describe('MCP tool: search_skills', () => {
  it('returns results for a valid query', async () => {
    const { client, cleanup } = await createConnectedPair(new StubBackend());
    try {
      const result = await client.callTool({ name: 'search_skills', arguments: { query: 'incident' } });
      const text = (result.content as Array<{ type: string; text: string }>)[0]?.text ?? '';
      expect(text).toContain('Incident Runbook');
      expect(text).toContain('incident-runbook');
    } finally {
      await cleanup();
    }
  });

  it('returns "no skills found" when backend returns empty array', async () => {
    const backend = new StubBackend({ searchSkills: async () => [] });
    const { client, cleanup } = await createConnectedPair(backend);
    try {
      const result = await client.callTool({ name: 'search_skills', arguments: { query: 'zzz' } });
      const text = (result.content as Array<{ type: string; text: string }>)[0]?.text ?? '';
      expect(text).toMatch(/no skills found/i);
    } finally {
      await cleanup();
    }
  });

  it('returns error message on auth failure', async () => {
    const backend = new StubBackend({
      searchSkills: async () => {
        throw new RegistryError('Authentication failed.', 'AUTH_FAILED');
      },
    });
    const { client, cleanup } = await createConnectedPair(backend);
    try {
      const result = await client.callTool({ name: 'search_skills', arguments: { query: 'test' } });
      const text = (result.content as Array<{ type: string; text: string }>)[0]?.text ?? '';
      expect(text).toMatch(/error/i);
      expect(text).toContain('Authentication failed');
    } finally {
      await cleanup();
    }
  });

  it('returns error message on registry unavailability', async () => {
    const backend = new StubBackend({
      searchSkills: async () => {
        throw new RegistryError('Registry unavailable.', 'UNAVAILABLE');
      },
    });
    const { client, cleanup } = await createConnectedPair(backend);
    try {
      const result = await client.callTool({ name: 'search_skills', arguments: { query: 'test' } });
      const text = (result.content as Array<{ type: string; text: string }>)[0]?.text ?? '';
      expect(text).toMatch(/error/i);
    } finally {
      await cleanup();
    }
  });
});

describe('MCP tool: get_skill_manifest', () => {
  it('returns manifest content for a valid slug', async () => {
    const { client, cleanup } = await createConnectedPair(new StubBackend());
    try {
      const result = await client.callTool({
        name: 'get_skill_manifest',
        arguments: { slug: 'incident-runbook' },
      });
      const text = (result.content as Array<{ type: string; text: string }>)[0]?.text ?? '';
      expect(text).toContain('incident-runbook');
      expect(text).toContain('Incident Runbook');
    } finally {
      await cleanup();
    }
  });

  it('returns error message for non-existent skill', async () => {
    const backend = new StubBackend({
      getSkillManifest: async () => {
        throw new RegistryError('Not found: skill "ghost-skill".', 'NOT_FOUND');
      },
    });
    const { client, cleanup } = await createConnectedPair(backend);
    try {
      const result = await client.callTool({
        name: 'get_skill_manifest',
        arguments: { slug: 'ghost-skill' },
      });
      const text = (result.content as Array<{ type: string; text: string }>)[0]?.text ?? '';
      expect(text).toMatch(/error/i);
      expect(text).toContain('ghost-skill');
    } finally {
      await cleanup();
    }
  });

  it('resolves "latest" and shows the concrete version', async () => {
    const { client, cleanup } = await createConnectedPair(new StubBackend());
    try {
      const result = await client.callTool({
        name: 'get_skill_manifest',
        arguments: { slug: 'incident-runbook', version: 'latest' },
      });
      const text = (result.content as Array<{ type: string; text: string }>)[0]?.text ?? '';
      expect(text).toContain('2.0.0');
    } finally {
      await cleanup();
    }
  });
});

describe('MCP tool: install_skill', () => {
  it('returns install result with path and file count', async () => {
    const { client, cleanup } = await createConnectedPair(new StubBackend());
    try {
      const result = await client.callTool({
        name: 'install_skill',
        arguments: {
          slug: 'incident-runbook',
          destination_path: '/tmp/test-skill-install',
        },
      });
      const text = (result.content as Array<{ type: string; text: string }>)[0]?.text ?? '';
      expect(text).toContain('/tmp/test-skill-install');
      expect(text).toMatch(/files written/i);
    } finally {
      await cleanup();
    }
  });

  it('returns error message on fingerprint mismatch', async () => {
    const backend = new StubBackend({
      installSkill: async () => {
        throw new RegistryError('Fingerprint mismatch for "bad-skill@1.0.0".', 'FINGERPRINT_MISMATCH');
      },
    });
    const { client, cleanup } = await createConnectedPair(backend);
    try {
      const result = await client.callTool({
        name: 'install_skill',
        arguments: { slug: 'bad-skill', destination_path: '/tmp/bad' },
      });
      const text = (result.content as Array<{ type: string; text: string }>)[0]?.text ?? '';
      expect(text).toMatch(/error/i);
      expect(text).toContain('Fingerprint mismatch');
    } finally {
      await cleanup();
    }
  });

  it('returns error message for non-existent skill', async () => {
    const backend = new StubBackend({
      installSkill: async () => {
        throw new RegistryError('Not found: skill "ghost-skill".', 'NOT_FOUND');
      },
    });
    const { client, cleanup } = await createConnectedPair(backend);
    try {
      const result = await client.callTool({
        name: 'install_skill',
        arguments: { slug: 'ghost-skill', destination_path: '/tmp/ghost' },
      });
      const text = (result.content as Array<{ type: string; text: string }>)[0]?.text ?? '';
      expect(text).toMatch(/error/i);
    } finally {
      await cleanup();
    }
  });
});
