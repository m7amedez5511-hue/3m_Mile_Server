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
    ignores: ['node_modules/', 'logs/', 'coverage/'],
  },
];
