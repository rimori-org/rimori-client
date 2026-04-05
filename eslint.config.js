import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

export default [
  { ignores: ['dist', 'node_modules', 'build', '*.js', '*.cjs', 'scripts/**'] },
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ['src/**/*.{ts,tsx}'],
  })),
  prettierConfig,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      sourceType: 'module',
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
    },
  },
];
