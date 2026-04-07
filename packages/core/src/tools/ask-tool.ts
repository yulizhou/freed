import type { AnyToolDefinition } from './types.js';

/**
 * AskUserQuestionTool - Prompts the user with questions and returns selected options.
 *
 * The CLI layer handles the actual user interaction; this tool validates the input
 * and returns structured output that the CLI uses to prompt the user.
 */
export const askUserQuestionTool: AnyToolDefinition = {
  name: 'ask_user_question',
  description: 'Ask the user a question and return the selected option(s)',
  riskLevel: 'safe',
  inputSchema: {
    type: 'object',
    properties: {
      questions: {
        type: 'array',
        description: 'List of questions to ask the user',
        items: {
          type: 'object',
          properties: {
            question: {
              type: 'string',
              description: 'The question text to ask the user',
            },
            header: {
              type: 'string',
              description: 'Short label for the question (max 12 characters)',
              maxLength: 12,
            },
            options: {
              type: 'array',
              description: 'Available options to present to the user',
              items: {
                type: 'object',
                properties: {
                  label: {
                    type: 'string',
                    description: 'The option label shown to the user',
                  },
                  description: {
                    type: 'string',
                    description: 'Optional description explaining the option',
                  },
                },
                required: ['label'],
              },
            },
            multiSelect: {
              type: 'boolean',
              description: 'Whether multiple options can be selected (default: false)',
              default: false,
            },
          },
          required: ['question', 'header', 'options'],
        },
      },
    },
    required: ['questions'],
  },
  async execute(input, _cwd = process.cwd()) {
    const { questions } = input as {
      questions: Array<{
        question: string;
        header: string;
        options: Array<{ label: string; description?: string }>;
        multiSelect?: boolean;
      }>;
    };

    // Validate that each question has at least one option
    for (const q of questions) {
      if (!q.options || q.options.length === 0) {
        return {
          success: false,
          output: '',
          error: `Question "${q.question}" must have at least one option`,
        };
      }
      if (q.header.length > 12) {
        return {
          success: false,
          output: '',
          error: `Header "${q.header}" exceeds maximum length of 12 characters`,
        };
      }
    }

    // Return structured output for the CLI layer to handle
    const output = JSON.stringify({
      type: 'ask_user_question',
      questions: questions.map((q) => ({
        question: q.question,
        header: q.header,
        options: q.options,
        multiSelect: q.multiSelect ?? false,
      })),
    });

    return {
      success: true,
      output,
    };
  },
};
