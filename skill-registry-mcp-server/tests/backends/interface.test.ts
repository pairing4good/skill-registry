import { describe, expect, it } from 'vitest';
import type { RegistryBackend } from '../../src/backends/interface.js';
import type { InstallResult, SkillManifest, SkillSummary } from '../../src/types.js';
import {
  MOCK_SKILL_MD,
  MOCK_SKILL_INFO,
  MOCK_SEARCH_RESPONSE,
  MOCK_VERSION_INFO,
} from '../fixtures/mock-responses.js';

// Fake backend implementing the RegistryBackend contract for testing
class FakeBackend implements RegistryBackend {
  readonly installCalls: { slug: string; version: string; path: string }[] = [];

  async searchSkills(query: string, limit: number): Promise<SkillSummary[]> {
    const results = MOCK_SEARCH_RESPONSE.results
      .filter((r) => r.slug.includes(query) || r.summary?.toLowerCase().includes(query))
      .slice(0, limit);

    return results.map((r) => ({
      slug: r.slug,
      display_name: r.displayName ?? r.slug,
      summary: r.summary ?? '',
      latest_version: r.version,
      tags: MOCK_SKILL_INFO[r.slug as keyof typeof MOCK_SKILL_INFO]?.tags ?? [],
      updated_at: MOCK_SKILL_INFO[r.slug as keyof typeof MOCK_SKILL_INFO]?.updatedAt ?? '',
    }));
  }

  async getSkillManifest(slug: string, version: string): Promise<SkillManifest> {
    if (slug !== 'incident-runbook') {
      const { RegistryError } = await import('../../src/errors.js');
      throw new RegistryError(`Not found: skill "${slug}" does not exist in the registry.`, 'NOT_FOUND');
    }
    const resolvedVersion = version === 'latest' ? '2.0.0' : version;
    return {
      slug,
      version: resolvedVersion,
      skill_md_content: MOCK_SKILL_MD,
      metadata: { name: slug, version: resolvedVersion, tags: ['incident-response'] },
      fingerprint: MOCK_VERSION_INFO.fingerprint,
    };
  }

  async installSkill(slug: string, version: string, destinationPath: string): Promise<InstallResult> {
    this.installCalls.push({ slug, version: version === 'latest' ? '2.0.0' : version, path: destinationPath });
    return {
      slug,
      version: version === 'latest' ? '2.0.0' : version,
      installed_path: destinationPath,
      files_written: 2,
      fingerprint: MOCK_VERSION_INFO.fingerprint,
    };
  }
}

function makeBackend(): FakeBackend {
  return new FakeBackend();
}

describe('RegistryBackend interface contract (FakeBackend)', () => {
  it('searchSkills returns SkillSummary array matching query', async () => {
    const backend = makeBackend();
    const results = await backend.searchSkills('incident', 10);
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r).toHaveProperty('slug');
      expect(r).toHaveProperty('display_name');
      expect(r).toHaveProperty('summary');
      expect(r).toHaveProperty('latest_version');
      expect(Array.isArray(r.tags)).toBe(true);
      expect(typeof r.updated_at).toBe('string');
    }
  });

  it('searchSkills respects the limit parameter', async () => {
    const backend = makeBackend();
    const results = await backend.searchSkills('a', 1);
    expect(results.length).toBeLessThanOrEqual(1);
  });

  it('searchSkills returns empty array for no matches', async () => {
    const backend = makeBackend();
    const results = await backend.searchSkills('zzzznonexistent', 20);
    expect(results).toEqual([]);
  });

  it('getSkillManifest returns manifest with all required fields', async () => {
    const backend = makeBackend();
    const manifest = await backend.getSkillManifest('incident-runbook', 'latest');
    expect(manifest.slug).toBe('incident-runbook');
    expect(manifest.version).toBe('2.0.0');
    expect(typeof manifest.skill_md_content).toBe('string');
    expect(manifest.skill_md_content.length).toBeGreaterThan(0);
    expect(typeof manifest.metadata).toBe('object');
    expect(typeof manifest.fingerprint).toBe('string');
  });

  it('getSkillManifest resolves "latest" to a concrete version', async () => {
    const backend = makeBackend();
    const manifest = await backend.getSkillManifest('incident-runbook', 'latest');
    expect(manifest.version).not.toBe('latest');
    expect(manifest.version.match(/^\d+\.\d+\.\d+/)).toBeTruthy();
  });

  it('getSkillManifest throws NOT_FOUND for unknown slug', async () => {
    const { RegistryError } = await import('../../src/errors.js');
    const backend = makeBackend();
    await expect(backend.getSkillManifest('nonexistent-skill', 'latest')).rejects.toThrow(
      RegistryError,
    );
    try {
      await backend.getSkillManifest('nonexistent-skill', 'latest');
    } catch (err) {
      expect(err instanceof RegistryError && err.code).toBe('NOT_FOUND');
    }
  });

  it('installSkill returns InstallResult with all required fields', async () => {
    const backend = makeBackend();
    const result = await backend.installSkill('incident-runbook', 'latest', '/tmp/test-install');
    expect(result.slug).toBe('incident-runbook');
    expect(typeof result.version).toBe('string');
    expect(result.version).not.toBe('latest');
    expect(result.installed_path).toBe('/tmp/test-install');
    expect(typeof result.files_written).toBe('number');
    expect(result.files_written).toBeGreaterThan(0);
    expect(typeof result.fingerprint).toBe('string');
  });

  it('installSkill records the call details', async () => {
    const backend = makeBackend();
    await backend.installSkill('incident-runbook', '2.0.0', '/tmp/my-skills/incident-runbook');
    expect(backend.installCalls).toHaveLength(1);
    expect(backend.installCalls[0]?.slug).toBe('incident-runbook');
    expect(backend.installCalls[0]?.version).toBe('2.0.0');
  });
});
