import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import svelteParser from 'svelte-eslint-parser';

export default ts.config(
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs['flat/recommended'],
  prettier,
  ...svelte.configs['flat/prettier'],
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        // Injected by Vite (see vite.config.ts).
        __APP_VERSION__: 'readonly',
      },
    },
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts'],
    languageOptions: {
      parser: svelteParser,
      parserOptions: {
        parser: ts.parser,
      },
    },
  },
  {
    rules: {
      indent: ['error', 2, {SwitchCase: 1}],
      quotes: ['error', 'single', {avoidEscape: true}],
      semi: ['error', 'always'],
      'no-var': 'error',
      // Svelte needs `let` for $bindable props in a destructured $props().
      'prefer-const': ['error', {destructuring: 'all'}],
      curly: ['error', 'all'],
      'no-multi-spaces': 'error',
      'array-bracket-spacing': ['error', 'never'],
      'block-spacing': ['error', 'always'],
      'brace-style': ['error', '1tbs', {allowSingleLine: true}],
      'comma-dangle': ['error', 'always-multiline'],
      'comma-spacing': ['error', {before: false, after: true}],
      'comma-style': ['error', 'last'],
      'computed-property-spacing': ['error', 'never'],
      'eol-last': ['error', 'always'],
      'func-call-spacing': ['error', 'never'],
      'key-spacing': ['error', {beforeColon: false, afterColon: true}],
      'keyword-spacing': ['error', {before: true, after: true}],
      'no-trailing-spaces': 'error',
      'object-curly-spacing': ['error', 'never'],
      'spaced-comment': ['error', 'always'],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', {argsIgnorePattern: '^_'}],
      'svelte/no-at-html-tags': 'warn',
    },
  },
  {
    ignores: [
      'build/',
      'build-single/',
      '.svelte-kit/',
      'dist/',
      'test-results/',
      'playwright-report/',
      '.cache/',
    ],
  },
);
