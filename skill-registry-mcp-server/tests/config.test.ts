import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';
import { RegistryError } from '../src/errors.js';

function setEnv(vars: Record<string, string | undefined>): void {
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  }
}

const VALID_BEARER_ENV = {
  SKILL_REGISTRY_BACKEND: 'artifactory',
  ARTIFACTORY_PLATFORM_URL: 'https://example.jfrog.io',
  ARTIFACTORY_REPOSITORY: 'skills-local',
  ARTIFACTORY_AUTH_METHOD: 'bearer',
  ARTIFACTORY_ACCESS_TOKEN: 'my-token',
};

const VALID_BASIC_ENV = {
  SKILL_REGISTRY_BACKEND: 'artifactory',
  ARTIFACTORY_PLATFORM_URL: 'https://example.jfrog.io',
  ARTIFACTORY_REPOSITORY: 'skills-local',
  ARTIFACTORY_AUTH_METHOD: 'basic',
  ARTIFACTORY_USERNAME: 'alice',
  ARTIFACTORY_IDENTITY_TOKEN: 'secret',
};

describe('loadConfig', () => {
  let savedEnv: Record<string, string | undefined>;

  beforeEach(() => {
    savedEnv = { ...process.env } as Record<string, string | undefined>;
  });

  afterEach(() => {
    // Restore original env
    for (const key of Object.keys(process.env)) {
      if (!(key in savedEnv)) delete process.env[key];
    }
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v !== undefined) process.env[k] = v;
    }
  });

  it('loads valid bearer config', () => {
    setEnv(VALID_BEARER_ENV);
    const config = loadConfig();
    expect(config.backend).toBe('artifactory');
    expect(config.artifactory.authMethod).toBe('bearer');
    expect(config.artifactory.accessToken).toBe('my-token');
    expect(config.artifactory.platformUrl).toBe('https://example.jfrog.io');
    expect(config.artifactory.repository).toBe('skills-local');
  });

  it('loads valid basic config', () => {
    setEnv(VALID_BASIC_ENV);
    const config = loadConfig();
    expect(config.artifactory.authMethod).toBe('basic');
    expect(config.artifactory.username).toBe('alice');
    expect(config.artifactory.identityToken).toBe('secret');
  });

  it('applies default values for optional settings', () => {
    setEnv(VALID_BEARER_ENV);
    const config = loadConfig();
    expect(config.artifactory.timeoutSeconds).toBe(30);
    expect(config.artifactory.verifyTls).toBe(true);
    expect(config.logLevel).toBe('info');
    expect(config.rateLimitRpm).toBe(60);
  });

  it('throws CONFIG_ERROR when ARTIFACTORY_PLATFORM_URL is missing', () => {
    setEnv({ ...VALID_BEARER_ENV, ARTIFACTORY_PLATFORM_URL: undefined });
    expect(() => loadConfig()).toThrow(RegistryError);
    try {
      loadConfig();
    } catch (err) {
      expect(err instanceof RegistryError && err.code).toBe('CONFIG_ERROR');
    }
  });

  it('throws CONFIG_ERROR when ARTIFACTORY_REPOSITORY is missing', () => {
    setEnv({ ...VALID_BEARER_ENV, ARTIFACTORY_REPOSITORY: undefined });
    expect(() => loadConfig()).toThrow(RegistryError);
  });

  it('throws CONFIG_ERROR for bearer method without access token', () => {
    setEnv({ ...VALID_BEARER_ENV, ARTIFACTORY_ACCESS_TOKEN: undefined });
    expect(() => loadConfig()).toThrow(RegistryError);
  });

  it('throws CONFIG_ERROR for basic method without username', () => {
    setEnv({ ...VALID_BASIC_ENV, ARTIFACTORY_USERNAME: undefined });
    expect(() => loadConfig()).toThrow(RegistryError);
  });

  it('throws CONFIG_ERROR for basic method without identity token', () => {
    setEnv({ ...VALID_BASIC_ENV, ARTIFACTORY_IDENTITY_TOKEN: undefined });
    expect(() => loadConfig()).toThrow(RegistryError);
  });

  it('throws CONFIG_ERROR for invalid auth method', () => {
    setEnv({ ...VALID_BEARER_ENV, ARTIFACTORY_AUTH_METHOD: 'oauth' });
    expect(() => loadConfig()).toThrow(RegistryError);
  });

  it('throws CONFIG_ERROR for unsupported backend', () => {
    setEnv({ ...VALID_BEARER_ENV, SKILL_REGISTRY_BACKEND: 'github' });
    expect(() => loadConfig()).toThrow(RegistryError);
  });

  it('respects ARTIFACTORY_VERIFY_TLS=false', () => {
    setEnv({ ...VALID_BEARER_ENV, ARTIFACTORY_VERIFY_TLS: 'false' });
    const config = loadConfig();
    expect(config.artifactory.verifyTls).toBe(false);
  });

  it('respects SKILL_REGISTRY_LOG_LEVEL', () => {
    setEnv({ ...VALID_BEARER_ENV, SKILL_REGISTRY_LOG_LEVEL: 'debug' });
    const config = loadConfig();
    expect(config.logLevel).toBe('debug');
  });

  it('respects SKILL_REGISTRY_RATE_LIMIT_RPM', () => {
    setEnv({ ...VALID_BEARER_ENV, SKILL_REGISTRY_RATE_LIMIT_RPM: '120' });
    const config = loadConfig();
    expect(config.rateLimitRpm).toBe(120);
  });
});
