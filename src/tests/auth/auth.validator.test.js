import { loginSchema, refreshSchema } from '../../validators/auth.validator.js';

describe('Auth validator — loginSchema', () => {
  // 1. A well-formed email and non-empty password pass through unchanged
  it('should accept a valid email and password', () => {
    const result = loginSchema.safeParse({ email: 'admin@3mmile.com', password: 'secret' });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ email: 'admin@3mmile.com', password: 'secret' });
  });

  // 2. Malformed email is rejected on the email path
  it('should reject a malformed email', () => {
    const result = loginSchema.safeParse({ email: 'not-an-email', password: 'secret' });

    expect(result.success).toBe(false);
    expect(result.error.issues[0].path).toEqual(['email']);
  });

  // 3. Empty password is rejected (min 1)
  it('should reject an empty password', () => {
    const result = loginSchema.safeParse({ email: 'admin@3mmile.com', password: '' });

    expect(result.success).toBe(false);
    expect(result.error.issues[0].path).toEqual(['password']);
    expect(result.error.issues[0].code).toBe('too_small');
  });

  // 4. Both fields are required
  it('should report both fields missing on an empty body', () => {
    const result = loginSchema.safeParse({});

    expect(result.success).toBe(false);
    expect(result.error.issues.map((i) => i.path[0]).sort()).toEqual(['email', 'password']);
  });

  // 5. Unknown keys are stripped (non-strict object)
  it('should strip unknown keys', () => {
    const result = loginSchema.safeParse({ email: 'a@b.co', password: 'p', remember: true });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ email: 'a@b.co', password: 'p' });
  });
});

describe('Auth validator — refreshSchema', () => {
  // 1. A token of at least 20 chars is accepted
  it('should accept a refreshToken of 20+ characters', () => {
    const token = 'a'.repeat(20);
    const result = refreshSchema.safeParse({ refreshToken: token });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ refreshToken: token });
  });

  // 2. Shorter tokens are rejected
  it('should reject a refreshToken shorter than 20 characters', () => {
    const result = refreshSchema.safeParse({ refreshToken: 'a'.repeat(19) });

    expect(result.success).toBe(false);
    expect(result.error.issues[0]).toMatchObject({ path: ['refreshToken'], code: 'too_small' });
  });

  // 3. Non-string tokens are rejected
  it('should reject a non-string refreshToken', () => {
    const result = refreshSchema.safeParse({ refreshToken: 1234567890123456 });

    expect(result.success).toBe(false);
    expect(result.error.issues[0]).toMatchObject({ path: ['refreshToken'], code: 'invalid_type' });
  });

  // 4. Missing token is rejected
  it('should reject a body without refreshToken', () => {
    const result = refreshSchema.safeParse({});

    expect(result.success).toBe(false);
    expect(result.error.issues[0].path).toEqual(['refreshToken']);
  });
});
