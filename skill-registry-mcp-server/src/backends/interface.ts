import type { InstallResult, SkillManifest, SkillSummary } from '../types.js';

export interface RegistryBackend {
  searchSkills(query: string, limit: number): Promise<SkillSummary[]>;
  getSkillManifest(slug: string, version: string): Promise<SkillManifest>;
  installSkill(slug: string, version: string, destinationPath: string): Promise<InstallResult>;
}
