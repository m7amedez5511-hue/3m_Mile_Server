import { updateUserSchema } from '../../validators/user.validator.js';

describe('User validator — updateUserSchema', () => {
  // 1. A single valid field passes
  it('should accept a single valid field', () => {
    const result = updateUserSchema.safeParse({ fullName: 'Jane Doe' });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ fullName: 'Jane Doe' });
  });

  // 2. All fields together pass with their values preserved
  it('should accept every field at once', () => {
    const input = { fullName: 'Jane', phone: '+20123456789', password: 'longenough', isActive: false };
    const result = updateUserSchema.safeParse(input);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(input);
  });

  // 3. Empty body fails the "at least one field" refine
  it('should reject an empty object with the custom refine message', () => {
    const result = updateUserSchema.safeParse({});

    expect(result.success).toBe(false);
    expect(result.error.issues[0]).toMatchObject({ code: 'custom', message: 'At least one field must be provided' });
  });

  // 4. Unknown keys are stripped, so a body with only unknown keys also fails the refine
  it('should strip unknown keys and then fail the refine when nothing remains', () => {
    const result = updateUserSchema.safeParse({ email: 'x@y.z', role: 'Admin' });

    expect(result.success).toBe(false);
    expect(result.error.issues[0].message).toBe('At least one field must be provided');
  });

  // 5. fullName length limits (2..100)
  it('should enforce fullName between 2 and 100 characters', () => {
    expect(updateUserSchema.safeParse({ fullName: 'A' }).success).toBe(false);
    expect(updateUserSchema.safeParse({ fullName: 'AB' }).success).toBe(true);
    expect(updateUserSchema.safeParse({ fullName: 'A'.repeat(100) }).success).toBe(true);
    expect(updateUserSchema.safeParse({ fullName: 'A'.repeat(101) }).success).toBe(false);
  });

  // 6. phone length limits (5..30)
  it('should enforce phone between 5 and 30 characters', () => {
    expect(updateUserSchema.safeParse({ phone: '1234' }).success).toBe(false);
    expect(updateUserSchema.safeParse({ phone: '12345' }).success).toBe(true);
    expect(updateUserSchema.safeParse({ phone: '1'.repeat(30) }).success).toBe(true);
    expect(updateUserSchema.safeParse({ phone: '1'.repeat(31) }).success).toBe(false);
  });

  // 7. password length limits (8..128)
  it('should enforce password between 8 and 128 characters', () => {
    expect(updateUserSchema.safeParse({ password: 'short7!' }).success).toBe(false);
    expect(updateUserSchema.safeParse({ password: '8charact' }).success).toBe(true);
    expect(updateUserSchema.safeParse({ password: 'p'.repeat(128) }).success).toBe(true);
    const tooLong = updateUserSchema.safeParse({ password: 'p'.repeat(129) });
    expect(tooLong.success).toBe(false);
    expect(tooLong.error.issues[0]).toMatchObject({ path: ['password'], code: 'too_big' });
  });

  // 8. isActive must be a real boolean (no string coercion)
  it('should reject a non-boolean isActive', () => {
    const result = updateUserSchema.safeParse({ isActive: 'true' });

    expect(result.success).toBe(false);
    expect(result.error.issues[0]).toMatchObject({ path: ['isActive'], code: 'invalid_type' });
  });

  // 9. Wrong types on string fields are rejected
  it('should reject non-string fullName/phone/password', () => {
    expect(updateUserSchema.safeParse({ fullName: 42 }).success).toBe(false);
    expect(updateUserSchema.safeParse({ phone: 12345 }).success).toBe(false);
    expect(updateUserSchema.safeParse({ password: null }).success).toBe(false);
  });
});
