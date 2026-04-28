export type RegistryErrorCode =
  | 'AUTH_FAILED'
  | 'NOT_FOUND'
  | 'UNAVAILABLE'
  | 'FINGERPRINT_MISMATCH'
  | 'CONFIG_ERROR'
  | 'RATE_LIMITED';

export class RegistryError extends Error {
  constructor(
    message: string,
    public readonly code: RegistryErrorCode,
  ) {
    super(message);
    this.name = 'RegistryError';
  }
}
