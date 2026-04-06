import type { AnyToolDefinition } from './types.js';
import { FreedError, ErrorCode } from '../shared/index.js';

export class ToolRegistry {
  private readonly tools = new Map<string, AnyToolDefinition>();

  register(tool: AnyToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  registerMany(tools: AnyToolDefinition[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  get(name: string): AnyToolDefinition {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new FreedError(ErrorCode.TOOL_NOT_FOUND, `Tool "${name}" is not registered`);
    }
    return tool;
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  list(): AnyToolDefinition[] {
    return [...this.tools.values()];
  }

  forAgent(toolNames: string[]): AnyToolDefinition[] {
    return toolNames
      .filter((name) => this.tools.has(name))
      .map((name) => this.tools.get(name) as AnyToolDefinition);
  }
}
