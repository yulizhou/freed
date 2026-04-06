import { Marked } from 'marked';
import { markedTerminal } from 'marked-terminal';
import chalk from 'chalk';
import ora from 'ora';

export const CONTINUATION_PROMPT = chalk.gray('· ');

class SpinnerManager {
  private spinners = new Map<string, ReturnType<typeof ora>>();
  private graceTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

  startSpinner(label: string): void {
    const existing = this.spinners.get(label);
    if (existing) return;

    const timeout = setTimeout(() => {
      const spinner = ora({ text: label, stream: process.stderr }).start();
      this.spinners.set(label, spinner);
      this.graceTimeouts.delete(label);
    }, 300);

    this.graceTimeouts.set(label, timeout);
  }

  stopSpinner(label: string, message?: string): void {
    const timeout = this.graceTimeouts.get(label);
    if (timeout) {
      clearTimeout(timeout);
      this.graceTimeouts.delete(label);
    }

    const spinner = this.spinners.get(label);
    if (spinner) {
      spinner.stop();
      if (message) process.stderr.write(message + '\n');
      this.spinners.delete(label);
    }
  }

  stopSpinnerWithSuccess(label: string, message?: string): void {
    const timeout = this.graceTimeouts.get(label);
    if (timeout) {
      clearTimeout(timeout);
      this.graceTimeouts.delete(label);
    }

    const spinner = this.spinners.get(label);
    if (spinner) {
      spinner.succeed(message);
      this.spinners.delete(label);
    }
  }

  stopSpinnerWithError(label: string, message?: string): void {
    const timeout = this.graceTimeouts.get(label);
    if (timeout) {
      clearTimeout(timeout);
      this.graceTimeouts.delete(label);
    }

    const spinner = this.spinners.get(label);
    if (spinner) {
      spinner.fail(message);
      this.spinners.delete(label);
    }
  }
}

export const spinnerManager = new SpinnerManager();

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
