import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ["babel.config.js", "tailwind.config.js"]
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  }
);
