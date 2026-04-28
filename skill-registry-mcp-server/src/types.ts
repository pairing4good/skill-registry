export interface SkillSummary {
  slug: string;
  display_name: string;
  summary: string;
  latest_version: string;
  tags: string[];
  updated_at: string;
}

export interface SkillManifest {
  slug: string;
  version: string;
  skill_md_content: string;
  metadata: Record<string, unknown>;
  fingerprint: string;
}

export interface InstallResult {
  slug: string;
  version: string;
  installed_path: string;
  files_written: number;
  fingerprint: string;
}
