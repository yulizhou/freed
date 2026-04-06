import { z } from 'zod';

export const MCPServerConfigSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  command: z.string().optional(),   // stdio transport
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
  url: z.string().optional(),       // HTTP/SSE transport
  headers: z.record(z.string()).optional(),
});

export type MCPServerConfig = z.infer<typeof MCPServerConfigSchema>;

export const MCPConfigSchema = z.object({
  servers: z.array(MCPServerConfigSchema),
});

export type MCPConfig = z.infer<typeof MCPConfigSchema>;
