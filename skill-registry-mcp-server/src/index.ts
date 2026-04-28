#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ArtifactoryBackend } from './backends/artifactory.js';
import { loadConfig } from './config.js';
import { RegistryError } from './errors.js';
import { registerTools } from './tools.js';

async function main(): Promise<void> {
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    const message = err instanceof RegistryError ? err.message : String(err);
    console.error(`[skill-registry] Configuration error: ${message}`);
    process.exit(1);
  }

  const backend = new ArtifactoryBackend(config.artifactory, config.rateLimitRpm);

  const server = new McpServer({
    name: 'skill-registry-mcp-server',
    version: '1.0.0',
  });

  registerTools(server, backend);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('[skill-registry] MCP server running via stdio');
}

main().catch((err: unknown) => {
  console.error('[skill-registry] Fatal error:', err);
  process.exit(1);
});
