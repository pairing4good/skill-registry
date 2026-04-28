export const MOCK_SEARCH_RESPONSE = {
  results: [
    {
      name: 'incident-runbook',
      version: '2.0.0',
      description: 'AI co-pilot for production incident response and postmortem writing.',
      author: 'skill-registry-sample',
      downloadUrl: 'api/v1/download?slug=incident-runbook&version=2.0.0',
      tags: ['incident-response', 'on-call', 'postmortem', 'sre'],
      match: 0.98,
    },
    {
      name: 'openapi-contract-check',
      version: '1.0.0',
      description: 'Audits OpenAPI specs against a 30+ rule catalog.',
      author: 'skill-registry-sample',
      downloadUrl: 'api/v1/download?slug=openapi-contract-check&version=1.0.0',
      tags: ['openapi', 'api', 'validation'],
      match: 0.72,
    },
  ],
  total: 2,
  limit: 20,
  offset: 0,
};

export const MOCK_SKILL_INFO = {
  'incident-runbook': {
    slug: 'incident-runbook',
    latestVersion: '2.0.0',
    displayName: 'Incident Runbook',
    summary: 'AI co-pilot for production incident response and postmortem writing.',
    tags: ['incident-response', 'on-call', 'postmortem', 'sre'],
    updatedAt: '2026-01-15T10:00:00Z',
  },
  'openapi-contract-check': {
    slug: 'openapi-contract-check',
    latestVersion: '1.0.0',
    displayName: 'OpenAPI Contract Check',
    summary: 'Audits OpenAPI specs against a 30+ rule catalog.',
    tags: ['openapi', 'api', 'validation'],
    updatedAt: '2026-01-10T08:00:00Z',
  },
};

export const MOCK_VERSION_INFO = {
  slug: 'incident-runbook',
  version: '2.0.0',
  fingerprint: 'abc123def456abc123def456abc123def456abc123def456abc123def456abc1',
  updatedAt: '2026-01-15T10:00:00Z',
};

export const MOCK_SKILL_MD = `---
name: incident-runbook
version: 2.0.0
description: "AI co-pilot for production incident response and postmortem writing."
author: skill-registry-sample
tags: [incident-response, on-call, postmortem, sre, reliability]
---

# Incident Runbook

When production breaks, cognitive load is the enemy.
`;
