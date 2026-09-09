import { createFaqSchema, updateFaqSchema } from '../../validators/faq.validator.js';

const firstPath = (result) => result.error.issues[0].path;

describe('Faq validator — createFaqSchema', () => {
  // 1. A well-formed body passes through untouched
  it('should accept a complete valid body', () => {
    const body = { question: 'How long does it take?', answer: 'About two days.', order: 1, isActive: true };

    const result = createFaqSchema.safeParse(body);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(body);
  });

  // 2. question and answer are required on create
  it('should require question and answer', () => {
    const noQuestion = createFaqSchema.safeParse({ answer: 'A' });
    const noAnswer = createFaqSchema.safeParse({ question: 'Q?' });

    expect(noQuestion.success).toBe(false);
    expect(firstPath(noQuestion)).toEqual(['question']);
    expect(noAnswer.success).toBe(false);
    expect(firstPath(noAnswer)).toEqual(['answer']);
  });

  // 3. question must be 2..300 characters
  it('should enforce question min 2 / max 300', () => {
    expect(createFaqSchema.safeParse({ question: 'a', answer: 'A' }).success).toBe(false);
    expect(createFaqSchema.safeParse({ question: 'ab', answer: 'A' }).success).toBe(true);
    expect(createFaqSchema.safeParse({ question: 'a'.repeat(300), answer: 'A' }).success).toBe(true);
    expect(createFaqSchema.safeParse({ question: 'a'.repeat(301), answer: 'A' }).success).toBe(false);
  });

  // 4. answer must not be empty
  it('should reject an empty answer', () => {
    const result = createFaqSchema.safeParse({ question: 'Q?', answer: '' });

    expect(result.success).toBe(false);
    expect(firstPath(result)).toEqual(['answer']);
    expect(createFaqSchema.safeParse({ question: 'Q?', answer: 'x' }).success).toBe(true);
  });

  // 5. order is optional and coerced from a multipart string to an integer
  it('should coerce order from string and require an integer', () => {
    expect(createFaqSchema.safeParse({ question: 'Q?', answer: 'A', order: '7' }).data.order).toBe(7);
    expect(createFaqSchema.safeParse({ question: 'Q?', answer: 'A', order: '' }).data.order).toBe(0);
    expect(createFaqSchema.safeParse({ question: 'Q?', answer: 'A', order: '1.5' }).success).toBe(false);
    expect(createFaqSchema.safeParse({ question: 'Q?', answer: 'A', order: 'abc' }).success).toBe(false);
    expect(createFaqSchema.safeParse({ question: 'Q?', answer: 'A' }).data.order).toBeUndefined();
  });

  // 6. isActive accepts booleans and 'true'/'false' strings, rejecting everything else
  it("should coerce isActive from 'true'/'false' and reject other values", () => {
    expect(createFaqSchema.safeParse({ question: 'Q?', answer: 'A', isActive: 'true' }).data.isActive).toBe(true);
    expect(createFaqSchema.safeParse({ question: 'Q?', answer: 'A', isActive: 'false' }).data.isActive).toBe(false);
    expect(createFaqSchema.safeParse({ question: 'Q?', answer: 'A', isActive: false }).data.isActive).toBe(false);
    expect(createFaqSchema.safeParse({ question: 'Q?', answer: 'A', isActive: 'yes' }).success).toBe(false);
    expect(createFaqSchema.safeParse({ question: 'Q?', answer: 'A', isActive: 0 }).success).toBe(false);
  });

  // 7. Non-string question/answer are rejected (no coercion on text)
  it('should reject non-string question or answer', () => {
    expect(createFaqSchema.safeParse({ question: 123, answer: 'A' }).success).toBe(false);
    expect(createFaqSchema.safeParse({ question: 'Q?', answer: ['A'] }).success).toBe(false);
  });

  // 8. Unknown keys (isDeleted, _id, ...) are stripped
  it('should strip unknown keys', () => {
    const result = createFaqSchema.safeParse({ question: 'Q?', answer: 'A', isDeleted: true, _id: 'hack' });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ question: 'Q?', answer: 'A' });
  });
});

describe('Faq validator — updateFaqSchema', () => {
  // 1. Every field is optional on update — an empty body is valid
  it('should accept an empty body', () => {
    const result = updateFaqSchema.safeParse({});

    expect(result.success).toBe(true);
    expect(result.data).toEqual({});
  });

  // 2. A single field can be updated on its own
  it('should accept a partial body with only answer', () => {
    const result = updateFaqSchema.safeParse({ answer: 'New answer' });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ answer: 'New answer' });
  });

  // 3. Length rules still apply to fields that are present
  it('should still enforce min/max when a field is present', () => {
    expect(updateFaqSchema.safeParse({ question: 'a' }).success).toBe(false);
    expect(updateFaqSchema.safeParse({ question: 'a'.repeat(301) }).success).toBe(false);
    expect(updateFaqSchema.safeParse({ answer: '' }).success).toBe(false);
    expect(updateFaqSchema.safeParse({ question: 'ok' }).success).toBe(true);
  });

  // 4. Coercions carry over to update
  it('should coerce order and isActive on update', () => {
    const result = updateFaqSchema.safeParse({ order: '4', isActive: 'false' });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ order: 4, isActive: false });
  });

  // 5. Unknown keys are stripped on update too
  it('should strip unknown keys on update', () => {
    const result = updateFaqSchema.safeParse({ order: 1, isDeleted: true });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ order: 1 });
  });
});
