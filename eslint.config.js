import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        URL: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
      },
    },
    rules: {
      // The codebase logs errors before rethrowing wrapped ones; unused function
      // args (req/res/next signatures) are part of Express middleware contracts.
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_|^(req|res|next)$' }],
    },
  },
  {
    // Jest test files: the runner injects describe/it/expect and friends.
    files: ['src/tests/**/*.test.js'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        setImmediate: 'readonly',
      },
    },
  },
  {
    ignores: ['node_modules/', 'logs/', 'coverage/'],
  },
];
