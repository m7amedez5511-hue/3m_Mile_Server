import { createRoleSchema } from '../../validators/role.validator.js';

describe('Role validator — createRoleSchema', () => {
  // 1. An empty body is the only valid payload
  it('should accept an empty object', () => {
    const result = createRoleSchema.safeParse({});

    expect(result.success).toBe(true);
    expect(result.data).toEqual({});
  });

  // 2. Any extra key is rejected because the schema is strict
  it('should reject unknown keys with unrecognized_keys', () => {
    const result = createRoleSchema.safeParse({ name: 'Editor' });

    expect(result.success).toBe(false);
    expect(result.error.issues[0]).toMatchObject({ code: 'unrecognized_keys', keys: ['name'] });
  });

  // 3. Multiple unknown keys are all reported
  it('should list every unknown key', () => {
    const result = createRoleSchema.safeParse({ name: 'X', permissions: [], isSystem: false });

    expect(result.success).toBe(false);
    expect(result.error.issues[0].keys.sort()).toEqual(['isSystem', 'name', 'permissions']);
  });

  // 4. Non-object payloads are rejected
  it('should reject a non-object body', () => {
    expect(createRoleSchema.safeParse(null).success).toBe(false);
    expect(createRoleSchema.safeParse('Admin').success).toBe(false);
    expect(createRoleSchema.safeParse([]).success).toBe(false);
  });
});
