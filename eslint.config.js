// @ts-check
import js from '@eslint/js';
import astro from 'eslint-plugin-astro';
import prettier from 'eslint-config-prettier/flat';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores(['dist/', '.astro/', '**/.wrangler/', '.lighthouseci/', 'playwright-report/', 'test-results/']),
  js.configs.recommended,
  tseslint.configs.recommended,
  astro.configs.recommended,
  {
    languageOptions: { globals: globals.browser },
  },
  {
    // Config files, build scripts and tests run in Node.
    files: ['*.{js,mjs,cjs,ts}', 'scripts/**', 'tests/**'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.cjs'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  // Formatting is Prettier's job.
  prettier,
);
