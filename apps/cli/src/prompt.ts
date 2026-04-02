import readline from 'node:readline';
import process from 'node:process';
import chalk from 'chalk';

export interface PromptOptions {
  prompt?: string;
}

/**
 * Simple readline-based interactive REPL prompt.
 * Supports multi-line input via continuation lines, history, and Ctrl+C to exit.
 */
export class InteractivePrompt {
  private readonly rl: readline.Interface;
  private history: string[] = [];

  constructor(opts: PromptOptions = {}) {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
      historySize: 100,
    });

    const promptStr = opts.prompt ?? chalk.cyan('> ');
    this.rl.setPrompt(promptStr);
  }

  async ask(): Promise<string | null> {
    return new Promise((resolve) => {
      this.rl.question('', (answer) => {
        if (answer === null) {
          resolve(null);
          return;
        }
        const trimmed = answer.trim();
        if (trimmed) {
          this.history.push(trimmed);
        }
        resolve(trimmed);
      });

      this.rl.once('close', () => resolve(null));
    });
  }

  prompt(): void {
    process.stdout.write(chalk.cyan('> '));
  }

  close(): void {
    this.rl.close();
  }

  onSIGINT(handler: () => void): void {
    this.rl.on('SIGINT', handler);
  }
}

/**
 * Ask the user a yes/no confirmation question.
 * Returns true if the user answers 'y' or 'yes' (case-insensitive).
 */
export async function askConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${chalk.yellow('?')} ${question} ${chalk.dim('(y/N)')} `, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes');
    });
  });
}
