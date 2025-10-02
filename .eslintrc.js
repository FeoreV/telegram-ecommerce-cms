// ESLint configuration for monorepo root
module.exports = {
  root: true,
  extends: ['@botrt/config/eslint-preset'],
  ignorePatterns: [
    'dist',
    'build',
    'coverage',
    'node_modules',
    '*.config.js',
    '*.config.ts',
  ],
};

