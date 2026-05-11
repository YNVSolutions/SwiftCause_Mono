module.exports = {
  env: {
    es6: true,
    node: true,
  },
  parserOptions: {
    ecmaVersion: 2023,
  },
  extends: ['eslint:recommended', 'google'],
  rules: {
    'no-restricted-globals': ['error', 'name', 'length'],
    'prefer-arrow-callback': 'error',
    quotes: ['error', 'single', { allowTemplateLiterals: true }],
  },
  overrides: [
    {
      files: ['**/*.spec.*', '**/*.test.*'],
      env: {
        mocha: true,
        jest: true,
      },
      rules: {},
    },
  ],
  globals: {},
};
