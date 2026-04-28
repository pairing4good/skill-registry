export function parseFrontmatter(content: string): Record<string, unknown> {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};

  const result: Record<string, unknown> = {};

  for (const line of match[1].split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim();
    let rawValue = line.slice(colonIdx + 1).trim();

    if (!key) continue;

    // Quoted string
    if (rawValue.startsWith('"') && rawValue.endsWith('"')) {
      result[key] = rawValue.slice(1, -1);
      continue;
    }

    // Inline YAML array: [a, b, c]
    if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
      result[key] = rawValue
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
      continue;
    }

    result[key] = rawValue;
  }

  return result;
}
