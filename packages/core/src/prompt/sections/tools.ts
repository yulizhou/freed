/**
 * Available tools section.
 * Formats the tool registry into a readable capabilities list.
 */
import type { ToolDescriptor } from '../../shared/index.js'

export function getToolsSection(tools: ToolDescriptor[]): string {
  if (tools.length === 0) {
    return '## Available Tools\n\nNo tools available.'
  }

  const lines = ['## Available Tools\n']

  for (const tool of tools) {
    const riskLabel =
      tool.riskLevel === 'safe'
        ? '[SAFE]'
        : tool.riskLevel === 'ask'
          ? '[ASK]'
          : '[DENY]'
    lines.push(`- ${riskLabel} **${tool.name}**: ${tool.description ?? 'No description'}`)
  }

  return lines.join('\n')
}
