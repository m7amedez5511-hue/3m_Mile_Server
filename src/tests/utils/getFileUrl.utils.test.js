// Pure util — reads process.env.API_PUBLIC_URL at call time; no mocks required.
const { getFileUrl } = await import('../../utils/getFileUrl.js');

describe('Utils — getFileUrl', () => {
  const ORIGINAL = process.env.API_PUBLIC_URL;

  beforeEach(() => {
    process.env.API_PUBLIC_URL = 'https://api.example.test';
  });

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.API_PUBLIC_URL;
    else process.env.API_PUBLIC_URL = ORIGINAL;
  });

  // 1. Builds <base>/public/uploads/<folder>/<filename>
  it('should build the public upload URL from the env base', () => {
    expect(getFileUrl({}, 'car-photos', 'a.png')).toBe('https://api.example.test/public/uploads/car-photos/a.png');
  });

  // 2. Missing filename → null (no URL for nothing)
  it('should return null when filename is falsy', () => {
    expect(getFileUrl({}, 'car-photos', undefined)).toBeNull();
    expect(getFileUrl({}, 'car-photos', '')).toBeNull();
    expect(getFileUrl({}, 'car-photos', null)).toBeNull();
  });

  // 3. The request object is ignored
  it('should ignore the req argument', () => {
    expect(getFileUrl(null, 'f', 'x.jpg')).toBe('https://api.example.test/public/uploads/f/x.jpg');
    expect(getFileUrl(undefined, 'f', 'x.jpg')).toBe('https://api.example.test/public/uploads/f/x.jpg');
  });

  // 4. Env is read on every call, not captured at import
  it('should pick up a changed API_PUBLIC_URL at call time', () => {
    process.env.API_PUBLIC_URL = 'http://localhost:3000';

    expect(getFileUrl({}, 'f', 'x.jpg')).toBe('http://localhost:3000/public/uploads/f/x.jpg');
  });

  // 5. No normalisation: a trailing slash on the base is kept as-is (current behaviour)
  it('should not normalise a trailing slash on the base URL', () => {
    process.env.API_PUBLIC_URL = 'https://api.example.test/';

    expect(getFileUrl({}, 'f', 'x.jpg')).toBe('https://api.example.test//public/uploads/f/x.jpg');
  });

  // 6. Unset env produces a literal "undefined" prefix (current behaviour, see report)
  it("should produce an 'undefined/...' URL when API_PUBLIC_URL is unset", () => {
    delete process.env.API_PUBLIC_URL;

    expect(getFileUrl({}, 'f', 'x.jpg')).toBe('undefined/public/uploads/f/x.jpg');
  });
});
