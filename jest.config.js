/**
 * Jest in native ESM mode (the project is `"type": "module"`).
 * Run through `node --experimental-vm-modules` so `import`/`jest.unstable_mockModule` work
 * without a Babel transform.
 */
export default {
  testEnvironment: 'node',
  transform: {},
  roots: ['<rootDir>/src'],
  testMatch: ['**/tests/**/*.test.js'],
  clearMocks: true,
  restoreMocks: true,
  collectCoverageFrom: ['src/services/**/*.js', 'src/validators/**/*.js', 'src/utils/**/*.js', 'src/middleware/**/*.js'],
  coverageDirectory: 'coverage',
};
