import { createHash } from 'crypto';
import { mkdir } from 'fs/promises';
import https from 'https';
import AdmZip from 'adm-zip';
import axios, { AxiosError, type AxiosInstance } from 'axios';
import type { ArtifactoryConfig } from '../config.js';
import { RegistryError } from '../errors.js';
import type { InstallResult, SkillManifest, SkillSummary } from '../types.js';
import { parseFrontmatter } from '../utils/frontmatter.js';
import { RateLimiter } from '../utils/rate-limiter.js';
import type { RegistryBackend } from './interface.js';

// Artifactory API response shapes
interface ArtifactorySearchResult {
  name: string;
  version: string;
  description?: string;
  author?: string;
  downloadUrl?: string;
  tags?: string[];
  match?: number;
}

interface ArtifactorySearchResponse {
  results: ArtifactorySearchResult[];
  total: number;
  limit: number;
  offset: number;
}

interface ArtifactorySkillInfo {
  slug: string;
  latestVersion: string;
  displayName?: string;
  summary?: string;
  tags?: string[];
  updatedAt?: string;
}

interface ArtifactoryVersionInfo {
  slug: string;
  version: string;
  fingerprint: string;
  updatedAt?: string;
}

const MAX_RETRY_ATTEMPTS = 3;

function translateHttpError(error: AxiosError, slug?: string): RegistryError {
  const status = error.response?.status;
  if (status === 401 || status === 403) {
    return new RegistryError('Authentication failed. Check your access token and repository permissions.', 'AUTH_FAILED');
  }
  if (status === 404) {
    const subject = slug ? `skill "${slug}"` : 'resource';
    return new RegistryError(`Not found: ${subject} does not exist in the registry.`, 'NOT_FOUND');
  }
  if (status === 429) {
    return new RegistryError('Rate limit exceeded. Retry after a short delay.', 'RATE_LIMITED');
  }
  if (status !== undefined && status >= 500) {
    return new RegistryError('Registry unavailable. Please retry later.', 'UNAVAILABLE');
  }
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return new RegistryError('Request timed out. Please retry later.', 'UNAVAILABLE');
  }
  return new RegistryError(
    `Registry request failed (HTTP ${status ?? 'unknown'}).`,
    'UNAVAILABLE',
  );
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (err instanceof AxiosError) {
        const status = err.response?.status;
        const retryable = status === 429 || (status !== undefined && status >= 500) ||
          err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT';
        if (retryable && attempt < MAX_RETRY_ATTEMPTS) {
          const delayMs = Math.pow(2, attempt) * 1_000 + Math.random() * 500;
          await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
          continue;
        }
      }
      throw err;
    }
  }
  throw lastError;
}

export class ArtifactoryBackend implements RegistryBackend {
  private readonly client: AxiosInstance;
  private readonly rateLimiter: RateLimiter;

  constructor(config: ArtifactoryConfig, rateLimitRpm: number) {
    const baseURL = `${config.platformUrl}/artifactory/api/skills/${config.repository}`;

    const authHeaders: Record<string, string> =
      config.authMethod === 'bearer'
        ? { Authorization: `Bearer ${config.accessToken}` }
        : {
            Authorization: `Basic ${Buffer.from(
              `${config.username}:${config.identityToken}`,
            ).toString('base64')}`,
          };

    this.client = axios.create({
      baseURL,
      timeout: config.timeoutSeconds * 1_000,
      headers: {
        ...authHeaders,
        Accept: 'application/json',
      },
      httpsAgent: new https.Agent({ rejectUnauthorized: config.verifyTls }),
    });

    this.rateLimiter = new RateLimiter(rateLimitRpm);
  }

  private async get<T>(path: string, params?: Record<string, string | number>): Promise<T> {
    await this.rateLimiter.acquire();
    return withRetry(async () => {
      try {
        const response = await this.client.get<T>(path, { params });
        return response.data;
      } catch (err) {
        if (err instanceof AxiosError) throw translateHttpError(err);
        throw err;
      }
    });
  }

  private async getBuffer(path: string, params?: Record<string, string | number>): Promise<Buffer> {
    await this.rateLimiter.acquire();
    return withRetry(async () => {
      try {
        const response = await this.client.get<ArrayBuffer>(path, {
          params,
          responseType: 'arraybuffer',
        });
        return Buffer.from(response.data);
      } catch (err) {
        if (err instanceof AxiosError) throw translateHttpError(err);
        throw err;
      }
    });
  }

  private async getText(path: string, params?: Record<string, string | number>): Promise<string> {
    await this.rateLimiter.acquire();
    return withRetry(async () => {
      try {
        const response = await this.client.get<string>(path, {
          params,
          responseType: 'text',
          headers: { Accept: 'text/plain, text/markdown, */*' },
        });
        return response.data;
      } catch (err) {
        if (err instanceof AxiosError) throw translateHttpError(err);
        throw err;
      }
    });
  }

  private async resolveVersion(slug: string, version: string): Promise<string> {
    if (version !== 'latest') return version;
    const info = await this.get<ArtifactorySkillInfo>(`/api/v1/skills/${slug}`);
    if (!info.latestVersion) {
      throw new RegistryError(`Could not determine latest version for skill "${slug}".`, 'NOT_FOUND');
    }
    return info.latestVersion;
  }

  async searchSkills(query: string, limit: number): Promise<SkillSummary[]> {
    const data = await this.get<ArtifactorySearchResponse>('/api/v1/search', {
      q: query,
      limit,
      offset: 0,
    });

    return (data.results ?? []).map((result): SkillSummary => ({
      slug: result.name,
      display_name: result.name.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      summary: result.description ?? '',
      latest_version: result.version,
      tags: result.tags ?? [],
      updated_at: '',
    }));
  }

  async getSkillManifest(slug: string, requestedVersion: string): Promise<SkillManifest> {
    const version = await this.resolveVersion(slug, requestedVersion);

    const [skillMdContent, versionInfo] = await Promise.all([
      this.getText(`/api/v1/skills/${slug}/file`, { version, path: 'SKILL.md' }),
      this.get<ArtifactoryVersionInfo>(`/api/v1/skills/${slug}/versions/${version}`),
    ]);

    const metadata = parseFrontmatter(skillMdContent);

    return {
      slug,
      version,
      skill_md_content: skillMdContent,
      metadata,
      fingerprint: versionInfo.fingerprint ?? '',
    };
  }

  async installSkill(
    slug: string,
    requestedVersion: string,
    destinationPath: string,
  ): Promise<InstallResult> {
    const version = await this.resolveVersion(slug, requestedVersion);

    const [zipBuffer, versionInfo] = await Promise.all([
      this.getBuffer('/api/v1/download', { slug, version }),
      this.get<ArtifactoryVersionInfo>(`/api/v1/skills/${slug}/versions/${version}`),
    ]);

    const expectedFingerprint = versionInfo.fingerprint;
    if (expectedFingerprint) {
      const actualHash = createHash('sha256').update(zipBuffer).digest('hex');
      const normalizedExpected = expectedFingerprint.replace(/^sha256:/i, '');
      if (actualHash !== normalizedExpected) {
        throw new RegistryError(
          `Fingerprint mismatch for "${slug}@${version}". ` +
            `Expected ${normalizedExpected}, got ${actualHash}. ` +
            'The download may be corrupted or tampered with. Refusing to install.',
          'FINGERPRINT_MISMATCH',
        );
      }
    }

    await mkdir(destinationPath, { recursive: true });

    const zip = new AdmZip(zipBuffer);
    const entries = zip.getEntries();
    zip.extractAllTo(destinationPath, true);

    const filesWritten = entries.filter((e) => !e.isDirectory).length;

    return {
      slug,
      version,
      installed_path: destinationPath,
      files_written: filesWritten,
      fingerprint: expectedFingerprint ?? '',
    };
  }
}
