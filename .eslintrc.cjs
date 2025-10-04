// ESLint configuration for monorepo root
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
  },
  env: {
    node: true,
    es2021: true,
  },
  ignorePatterns: [
    'dist',
    'build',
    'coverage',
    'node_modules',
    '*.config.js',
    '*.config.ts',
  ],
};

