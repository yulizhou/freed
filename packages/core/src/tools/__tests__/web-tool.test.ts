import { webFetchTool } from '../web-tool.js';

describe('webFetchTool', () => {
  const { execute } = webFetchTool;

  it('should have correct metadata', () => {
    expect(webFetchTool.name).toBe('web_fetch');
    expect(webFetchTool.description).toBe('Fetch content from a URL');
    expect(webFetchTool.riskLevel).toBe('ask');
    expect((webFetchTool.inputSchema as { properties: { url?: { type?: string } } }).properties?.url?.type).toBe('string');
    expect(webFetchTool.inputSchema.required).toContain('url');
  });

  it('should return error for invalid URL', async () => {
    const result = await execute({ url: 'not-a-valid-url' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid URL');
  });

  it('should return error for non-http/https protocol', async () => {
    const result = await execute({ url: 'file:///etc/passwd' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid URL protocol');
  });

  it('should return error for non-200 response', async () => {
    const result = await execute({ url: 'https://httpbin.org/status/404' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('404');
  });

  it('should fetch a valid URL successfully', async () => {
    const result = await execute({ url: 'https://httpbin.org/html' });
    expect(result.success).toBe(true);
    expect(typeof result.output).toBe('string');
    expect(result.output.length).toBeGreaterThan(0);
  });

  it('should include prompt in output when provided', async () => {
    const result = await execute({ url: 'https://httpbin.org/html', prompt: 'Extract title' });
    expect(result.success).toBe(true);
    expect(result.output).toContain('[Prompt: Extract title]');
  });
});
