import { createBranchSchema, updateBranchSchema } from '../../validators/branch.validator.js';

describe('Branches — createBranchSchema', () => {
  // 1. A minimal valid body passes with only the name
  it('should accept a body with only a name', () => {
    expect(createBranchSchema.parse({ name: 'Main' })).toEqual({ name: 'Main' });
  });

  // 2. Name is required and bounded by min/max length
  it('should reject a missing, too-short or too-long name', () => {
    expect(createBranchSchema.safeParse({}).success).toBe(false);
    expect(createBranchSchema.safeParse({ name: 'M' }).success).toBe(false);
    expect(createBranchSchema.safeParse({ name: 'M'.repeat(201) }).success).toBe(false);
    expect(createBranchSchema.safeParse({ name: 'M'.repeat(200) }).success).toBe(true);
  });

  // 3. Text fields are capped at their max lengths
  it('should enforce max lengths on city/address/phone/whatsapp/workingHours', () => {
    const ok = { name: 'Main' };
    expect(createBranchSchema.safeParse({ ...ok, city: 'c'.repeat(120) }).success).toBe(true);
    expect(createBranchSchema.safeParse({ ...ok, city: 'c'.repeat(121) }).success).toBe(false);
    expect(createBranchSchema.safeParse({ ...ok, address: 'a'.repeat(501) }).success).toBe(false);
    expect(createBranchSchema.safeParse({ ...ok, phone: 'p'.repeat(41) }).success).toBe(false);
    expect(createBranchSchema.safeParse({ ...ok, whatsapp: 'w'.repeat(41) }).success).toBe(false);
    expect(createBranchSchema.safeParse({ ...ok, workingHours: 'h'.repeat(201) }).success).toBe(false);
  });

  // 4. Coordinates arrive as multipart strings and are coerced to numbers
  it('should coerce lat/lng strings to numbers and reject non-numeric values', () => {
    const result = createBranchSchema.parse({ name: 'Main', lat: '24.7', lng: '46.6' });

    expect(result.lat).toBe(24.7);
    expect(result.lng).toBe(46.6);
    expect(createBranchSchema.safeParse({ name: 'Main', lat: 'north' }).success).toBe(false);
  });

  // 5. An empty coordinate string coerces to 0 (current behaviour — a cleared field is stored as 0)
  it("should coerce an empty lat/lng string to 0", () => {
    const result = createBranchSchema.parse({ name: 'Main', lat: '', lng: '' });

    expect(result.lat).toBe(0);
    expect(result.lng).toBe(0);
  });

  // 6. mapUrl must be a URL but may be cleared with ''
  it("should accept a valid mapUrl or '' and reject non-URLs", () => {
    expect(createBranchSchema.parse({ name: 'Main', mapUrl: 'https://maps.google.com/?q=x' }).mapUrl).toBe('https://maps.google.com/?q=x');
    expect(createBranchSchema.parse({ name: 'Main', mapUrl: '' }).mapUrl).toBe('');
    expect(createBranchSchema.safeParse({ name: 'Main', mapUrl: 'notaurl' }).success).toBe(false);
    expect(createBranchSchema.safeParse({ name: 'Main', mapUrl: `https://x.com/${'a'.repeat(1000)}` }).success).toBe(false);
  });

  // 7. Pin offsets must be percentages, trimmed, or empty
  it('should accept percentage pin offsets and reject other units', () => {
    expect(createBranchSchema.parse({ name: 'Main', 'pin.top': '58%', 'pin.start': '12.5%' })).toMatchObject({ 'pin.top': '58%', 'pin.start': '12.5%' });
    expect(createBranchSchema.parse({ name: 'Main', 'pin.top': ' 58% ' })['pin.top']).toBe('58%');
    expect(createBranchSchema.parse({ name: 'Main', 'pin.top': '' })['pin.top']).toBe('');
    expect(createBranchSchema.safeParse({ name: 'Main', 'pin.top': '58' }).success).toBe(false);
    expect(createBranchSchema.safeParse({ name: 'Main', 'pin.top': '58px' }).success).toBe(false);
    expect(createBranchSchema.safeParse({ name: 'Main', 'pin.start': '1000%' }).success).toBe(false);
    expect(createBranchSchema.safeParse({ name: 'Main', 'pin.start': '12345678901%' }).success).toBe(false);
  });

  // 8. order is coerced to an integer; isActive from 'true'/'false'
  it('should coerce order and isActive from multipart strings', () => {
    const result = createBranchSchema.parse({ name: 'Main', order: '4', isActive: 'false' });

    expect(result.order).toBe(4);
    expect(result.isActive).toBe(false);
    expect(createBranchSchema.safeParse({ name: 'Main', order: '4.5' }).success).toBe(false);
    expect(createBranchSchema.safeParse({ name: 'Main', isActive: 'yes' }).success).toBe(false);
    expect(createBranchSchema.parse({ name: 'Main', isActive: true }).isActive).toBe(true);
  });

  // 9. Unknown keys are stripped so they never reach the service layer
  it('should strip isDeleted, image and imagePublicId', () => {
    const result = createBranchSchema.parse({ name: 'Main', isDeleted: true, image: 'x', imagePublicId: 'y' });

    expect(result).toEqual({ name: 'Main' });
  });
});

describe('Branches — updateBranchSchema', () => {
  // 1. Every field is optional on update
  it('should accept an empty body', () => {
    expect(updateBranchSchema.parse({})).toEqual({});
  });

  // 2. Name constraints still apply when supplied
  it('should still enforce name length when provided', () => {
    expect(updateBranchSchema.safeParse({ name: 'M' }).success).toBe(false);
    expect(updateBranchSchema.parse({ name: 'Main' })).toEqual({ name: 'Main' });
  });

  // 3. Coercions and pin rules match the create schema
  it('should coerce numbers/booleans and validate pin offsets', () => {
    const result = updateBranchSchema.parse({ lat: '1.5', order: '2', isActive: 'true', 'pin.top': '33%' });

    expect(result).toEqual({ lat: 1.5, order: 2, isActive: true, 'pin.top': '33%' });
    expect(updateBranchSchema.safeParse({ 'pin.top': 'top' }).success).toBe(false);
  });

  // 4. mapUrl may be cleared with '' on update
  it("should accept mapUrl '' on update", () => {
    expect(updateBranchSchema.parse({ mapUrl: '' })).toEqual({ mapUrl: '' });
  });

  // 5. Unknown keys are stripped
  it('should strip isDeleted and imagePublicId', () => {
    expect(updateBranchSchema.parse({ city: 'Riyadh', isDeleted: true, imagePublicId: 'x' })).toEqual({ city: 'Riyadh' });
  });
});
