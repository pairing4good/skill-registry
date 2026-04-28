/**
 * Integration tests for ArtifactoryBackend.
 *
 * These tests hit a real Artifactory instance and are opt-in:
 * they are skipped unless the INTEGRATION environment variable is set AND
 * all required Artifactory env vars are present.
 *
 * To run:
 *   INTEGRATION=1 \
 *   ARTIFACTORY_PLATFORM_URL=https://<your-id>.jfrog.io \
 *   ARTIFACTORY_REPOSITORY=skills-registry-local \
 *   ARTIFACTORY_AUTH_METHOD=bearer \
 *   ARTIFACTORY_ACCESS_TOKEN=<token> \
 *   npm run test:integration
 *
 * The tests assume the three sample skills from sample-skills/ have been
 * published via publish-skill.sh before running.
 */
import { describe, expect, it } from 'vitest';
import { ArtifactoryBackend } from '../../src/backends/artifactory.js';
import type { ArtifactoryConfig } from '../../src/config.js';
import { RegistryError } from '../../src/errors.js';

const INTEGRATION = !!process.env['INTEGRATION'];

function skipUnless(condition: boolean): void {
  if (!condition) {
    // Vitest doesn't have a built-in skip-from-within-test; throw to skip gracefully.
    // eslint-disable-next-line no-console
    console.log('Skipping integration test (INTEGRATION env not set).');
  }
}

function getConfig(): ArtifactoryConfig {
  return {
    platformUrl: process.env['ARTIFACTORY_PLATFORM_URL'] ?? '',
    repository: process.env['ARTIFACTORY_REPOSITORY'] ?? '',
    authMethod: (process.env['ARTIFACTORY_AUTH_METHOD'] ?? 'bearer') as 'bearer' | 'basic',
    accessToken: process.env['ARTIFACTORY_ACCESS_TOKEN'],
    username: process.env['ARTIFACTORY_USERNAME'],
    identityToken: process.env['ARTIFACTORY_IDENTITY_TOKEN'],
    timeoutSeconds: 30,
    verifyTls: true,
  };
}

describe.skipIf(!INTEGRATION)('ArtifactoryBackend integration tests', () => {
  it('searchSkills returns results for "incident"', async () => {
    skipUnless(INTEGRATION);
    const backend = new ArtifactoryBackend(getConfig(), 60);
    const results = await backend.searchSkills('incident', 10);
    expect(results.length).toBeGreaterThan(0);
    const slugs = results.map((r) => r.slug);
    expect(slugs).toContain('incident-runbook');
  });

  it('getSkillManifest returns SKILL.md for incident-runbook@latest', async () => {
    skipUnless(INTEGRATION);
    const backend = new ArtifactoryBackend(getConfig(), 60);
    const manifest = await backend.getSkillManifest('incident-runbook', 'latest');
    expect(manifest.slug).toBe('incident-runbook');
    expect(manifest.skill_md_content).toContain('incident');
    expect(manifest.version).not.toBe('latest');
    expect(manifest.fingerprint).toBeTruthy();
  });

  it('getSkillManifest throws NOT_FOUND for nonexistent slug', async () => {
    skipUnless(INTEGRATION);
    const backend = new ArtifactoryBackend(getConfig(), 60);
    await expect(backend.getSkillManifest('definitely-does-not-exist-xyz', 'latest')).rejects.toThrow(
      RegistryError,
    );
  });

  it('installSkill extracts files to destination', async () => {
    skipUnless(INTEGRATION);
    const { mkdtemp, rm } = await import('fs/promises');
    const { join } = await import('path');
    const { tmpdir } = await import('os');

    const tmp = await mkdtemp(join(tmpdir(), 'skill-registry-test-'));
    const dest = join(tmp, 'incident-runbook');

    try {
      const backend = new ArtifactoryBackend(getConfig(), 60);
      const result = await backend.installSkill('incident-runbook', 'latest', dest);
      expect(result.installed_path).toBe(dest);
      expect(result.files_written).toBeGreaterThan(0);

      const { readdir } = await import('fs/promises');
      const files = await readdir(dest, { recursive: true });
      const hasSkillMd = files.some((f) => String(f).endsWith('SKILL.md'));
      expect(hasSkillMd).toBe(true);
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  it('throws AUTH_FAILED with an invalid token', async () => {
    skipUnless(INTEGRATION);
    const badConfig: ArtifactoryConfig = {
      ...getConfig(),
      authMethod: 'bearer',
      accessToken: 'definitely-not-a-valid-token',
    };
    const backend = new ArtifactoryBackend(badConfig, 60);
    const error = await backend.searchSkills('test', 5).catch((e) => e);
    expect(error).toBeInstanceOf(RegistryError);
    expect((error as RegistryError).code).toBe('AUTH_FAILED');
  });
});
