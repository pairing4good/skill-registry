import { describe, expect, it } from 'vitest';
import { parseFrontmatter } from '../src/utils/frontmatter.js';
import { RateLimiter } from '../src/utils/rate-limiter.js';

describe('parseFrontmatter', () => {
  it('parses simple key-value pairs', () => {
    const result = parseFrontmatter('---\nname: my-skill\nversion: 1.2.3\n---\n# Body');
    expect(result['name']).toBe('my-skill');
    expect(result['version']).toBe('1.2.3');
  });

  it('parses quoted string values', () => {
    const result = parseFrontmatter('---\ndescription: "A skill for doing things."\n---');
    expect(result['description']).toBe('A skill for doing things.');
  });

  it('parses inline array values', () => {
    const result = parseFrontmatter('---\ntags: [incident-response, on-call, sre]\n---');
    expect(result['tags']).toEqual(['incident-response', 'on-call', 'sre']);
  });

  it('returns empty object for content without frontmatter', () => {
    expect(parseFrontmatter('# Just a heading\nNo frontmatter here.')).toEqual({});
  });

  it('handles CRLF line endings', () => {
    const result = parseFrontmatter('---\r\nname: my-skill\r\n---\r\n# Body');
    expect(result['name']).toBe('my-skill');
  });

  it('parses real SKILL.md frontmatter', () => {
    const content = `---
name: incident-runbook
version: 2.0.0
description: "AI co-pilot for production incident response."
author: skill-registry-sample
tags: [incident-response, on-call, postmortem, sre]
---

# Incident Runbook
`;
    const result = parseFrontmatter(content);
    expect(result['name']).toBe('incident-runbook');
    expect(result['version']).toBe('2.0.0');
    expect(result['description']).toBe('AI co-pilot for production incident response.');
    expect(result['author']).toBe('skill-registry-sample');
    expect(result['tags']).toEqual(['incident-response', 'on-call', 'postmortem', 'sre']);
  });
});

describe('RateLimiter', () => {
  it('allows requests within the rate limit without delay', async () => {
    const limiter = new RateLimiter(60);
    const start = Date.now();
    await limiter.acquire();
    await limiter.acquire();
    expect(Date.now() - start).toBeLessThan(50);
  });

  it('starts full with max tokens', async () => {
    const limiter = new RateLimiter(10);
    // Should be able to fire 10 requests immediately
    for (let i = 0; i < 10; i++) {
      await limiter.acquire();
    }
  });
});
