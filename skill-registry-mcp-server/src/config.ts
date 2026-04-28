import { config as loadDotenv } from 'dotenv';
import { RegistryError } from './errors.js';

loadDotenv();

export type AuthMethod = 'bearer' | 'basic';
export type BackendType = 'artifactory';
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface ArtifactoryConfig {
  platformUrl: string;
  repository: string;
  authMethod: AuthMethod;
  accessToken?: string;
  username?: string;
  identityToken?: string;
  timeoutSeconds: number;
  verifyTls: boolean;
}

export interface ServerConfig {
  backend: BackendType;
  artifactory: ArtifactoryConfig;
  logLevel: LogLevel;
  cacheDir: string;
  rateLimitRpm: number;
}

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) {
    throw new RegistryError(
      `Required environment variable ${name} is not set`,
      'CONFIG_ERROR',
    );
  }
  return val;
}

function optionalEnv(name: string, defaultValue: string): string {
  return process.env[name] ?? defaultValue;
}

export function loadConfig(): ServerConfig {
  const backend = optionalEnv('SKILL_REGISTRY_BACKEND', 'artifactory') as BackendType;
  if (backend !== 'artifactory') {
    throw new RegistryError(
      `Unsupported backend: "${backend}". Only "artifactory" is currently supported.`,
      'CONFIG_ERROR',
    );
  }

  const platformUrl = requireEnv('ARTIFACTORY_PLATFORM_URL');
  const repository = requireEnv('ARTIFACTORY_REPOSITORY');
  const authMethod = optionalEnv('ARTIFACTORY_AUTH_METHOD', 'bearer') as AuthMethod;

  if (authMethod !== 'bearer' && authMethod !== 'basic') {
    throw new RegistryError(
      `Invalid ARTIFACTORY_AUTH_METHOD: "${authMethod}". Must be "bearer" or "basic".`,
      'CONFIG_ERROR',
    );
  }

  let accessToken: string | undefined;
  let username: string | undefined;
  let identityToken: string | undefined;

  if (authMethod === 'bearer') {
    accessToken = requireEnv('ARTIFACTORY_ACCESS_TOKEN');
  } else {
    username = requireEnv('ARTIFACTORY_USERNAME');
    identityToken = requireEnv('ARTIFACTORY_IDENTITY_TOKEN');
  }

  const timeoutSeconds = parseInt(optionalEnv('ARTIFACTORY_TIMEOUT_SECONDS', '30'), 10);
  const verifyTls = optionalEnv('ARTIFACTORY_VERIFY_TLS', 'true') !== 'false';

  const logLevel = optionalEnv('SKILL_REGISTRY_LOG_LEVEL', 'info') as LogLevel;
  const defaultCacheDir = `${process.env['HOME'] ?? '/tmp'}/.cache/skill-registry`;
  const cacheDir = optionalEnv('SKILL_REGISTRY_CACHE_DIR', defaultCacheDir);
  const rateLimitRpm = parseInt(optionalEnv('SKILL_REGISTRY_RATE_LIMIT_RPM', '60'), 10);

  return {
    backend,
    artifactory: {
      platformUrl,
      repository,
      authMethod,
      accessToken,
      username,
      identityToken,
      timeoutSeconds,
      verifyTls,
    },
    logLevel,
    cacheDir,
    rateLimitRpm,
  };
}
