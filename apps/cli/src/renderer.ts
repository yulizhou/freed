import { Marked } from 'marked';
import { markedTerminal } from 'marked-terminal';
import chalk from 'chalk';

const marked = new Marked();
marked.use(markedTerminal() as Parameters<typeof marked.use>[0]);

export function renderMarkdown(text: string): string {
  return marked.parse(text) as string;
}

export function formatUserMessage(text: string): string {
  return chalk.cyan('You: ') + text;
}

export function formatAssistantPrefix(): string {
  return chalk.green('Freed: ');
}

export function formatToolCall(toolName: string, input: unknown): string {
  const inputStr = JSON.stringify(input, null, 2);
  return chalk.yellow(`\n⚙  ${toolName}`) + chalk.dim(`\n${inputStr}\n`);
}

export function formatToolResult(toolName: string, result: string): string {
  const truncated = result.length > 1000 ? result.slice(0, 1000) + '...(truncated)' : result;
  return chalk.dim(`← ${toolName}: `) + truncated;
}

export function formatApprovalRequest(toolName: string, input: unknown): string {
  const inputStr = JSON.stringify(input, null, 2);
  return (
    chalk.red('\n⚠  Approval required\n') +
    chalk.bold(`Tool: ${toolName}\n`) +
    chalk.dim(inputStr) +
    '\n'
  );
}

export function formatError(message: string): string {
  return chalk.red('✗ Error: ') + message;
}

export function formatInfo(message: string): string {
  return chalk.blue('ℹ ') + message;
}

export function formatSuccess(message: string): string {
  return chalk.green('✓ ') + message;
}
