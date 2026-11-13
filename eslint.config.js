/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS config file */
// ESLint flat config (CommonJS). This file stays CommonJS so package.json does
// not need "type": "module"; it mirrors eslint.config.mjs.
const { defineConfig, globalIgnores } = require('eslint/config');
const nextVitals = require('eslint-config-next/core-web-vitals');
const nextTs = require('eslint-config-next/typescript');

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
  ]),
  {
    files: [
      'services/**/*.ts',
      'types/**/*.ts',
      'hooks/**/*.ts',
      'scripts/**/*.ts',
      'app/**/*.ts',
      'app/**/*.tsx',
      'components/**/*.ts',
      'components/**/*.tsx',
      'lib/**/*.ts',
      'lib/**/*.tsx',
      'tests/**/*.ts',
      'tests/**/*.tsx',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
]);

module.exports = eslintConfig;
