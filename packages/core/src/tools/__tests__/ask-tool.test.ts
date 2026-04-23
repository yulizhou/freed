import { describe, it, expect } from 'vitest';
import { askUserQuestionTool } from '../ask-tool.js';

describe('askUserQuestionTool', () => {
  it('should have correct name and description', () => {
    expect(askUserQuestionTool.name).toBe('ask_user_question');
    expect(askUserQuestionTool.description).toBe('Ask the user a question and return the selected option(s)');
    expect(askUserQuestionTool.riskLevel).toBe('safe');
  });

  it('should have correct input schema', () => {
    expect(askUserQuestionTool.inputSchema.type).toBe('object');
    expect((askUserQuestionTool.inputSchema as { properties: { questions?: unknown } }).properties?.questions).toBeDefined();
  });

  it('should return structured output for single question', async () => {
    const result = await askUserQuestionTool.execute({
      questions: [
        {
          question: 'Which color do you prefer?',
          header: 'Color',
          options: [
            { label: 'Red', description: 'The color of fire' },
            { label: 'Blue', description: 'The color of sky' },
          ],
        },
      ],
    });

    expect(result.success).toBe(true);
    const output = JSON.parse(result.output);
    expect(output.type).toBe('ask_user_question');
    expect(output.questions).toHaveLength(1);
    expect(output.questions[0].question).toBe('Which color do you prefer?');
    expect(output.questions[0].header).toBe('Color');
    expect(output.questions[0].options).toHaveLength(2);
    expect(output.questions[0].multiSelect).toBe(false);
  });

  it('should handle multi-select questions', async () => {
    const result = await askUserQuestionTool.execute({
      questions: [
        {
          question: 'Select your toppings',
          header: 'Toppings',
          options: [
            { label: 'Cheese' },
            { label: 'Pepperoni' },
            { label: 'Mushrooms' },
          ],
          multiSelect: true,
        },
      ],
    });

    expect(result.success).toBe(true);
    const output = JSON.parse(result.output);
    expect(output.questions[0].multiSelect).toBe(true);
  });

  it('should default multiSelect to false', async () => {
    const result = await askUserQuestionTool.execute({
      questions: [
        {
          question: 'Yes or no?',
          header: 'Confirm',
          options: [{ label: 'Yes' }, { label: 'No' }],
        },
      ],
    });

    expect(result.success).toBe(true);
    const output = JSON.parse(result.output);
    expect(output.questions[0].multiSelect).toBe(false);
  });

  it('should return error for question with no options', async () => {
    const result = await askUserQuestionTool.execute({
      questions: [
        {
          question: 'This has no options',
          header: 'Empty',
          options: [],
        },
      ],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('must have at least one option');
  });

  it('should return error for header exceeding 12 characters', async () => {
    const result = await askUserQuestionTool.execute({
      questions: [
        {
          question: 'What is your name?',
          header: 'VeryLongHeader',
          options: [{ label: 'Option' }],
        },
      ],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('exceeds maximum length of 12 characters');
  });

  it('should handle multiple questions', async () => {
    const result = await askUserQuestionTool.execute({
      questions: [
        {
          question: 'What is your name?',
          header: 'Name',
          options: [{ label: 'Alice' }, { label: 'Bob' }],
        },
        {
          question: 'What is your age?',
          header: 'Age',
          options: [{ label: '18-25' }, { label: '26-35' }, { label: '36+' }],
        },
      ],
    });

    expect(result.success).toBe(true);
    const output = JSON.parse(result.output);
    expect(output.questions).toHaveLength(2);
  });

  it('should handle option without description', async () => {
    const result = await askUserQuestionTool.execute({
      questions: [
        {
          question: 'Pick one',
          header: 'Choice',
          options: [{ label: 'OnlyLabel' }],
        },
      ],
    });

    expect(result.success).toBe(true);
    const output = JSON.parse(result.output);
    expect(output.questions[0].options[0].label).toBe('OnlyLabel');
    expect(output.questions[0].options[0].description).toBeUndefined();
  });
});
