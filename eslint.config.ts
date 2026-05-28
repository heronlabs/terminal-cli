import {defineConfig} from 'eslint/config';
import jsonc from 'eslint-plugin-jsonc';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import yml from 'eslint-plugin-yml';
import gts from 'gts';
import tseslint from 'typescript-eslint';

export default defineConfig([
  ...gts,
  {
    plugins: {
      'simple-import-sort': simpleImportSort,
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      'simple-import-sort/exports': 'error',
      'simple-import-sort/imports': 'error',
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
      },
    },
  },
  ...jsonc.configs['flat/recommended-with-json'],
  {
    files: ['**/*.json'],
    rules: {
      'jsonc/sort-keys': [
        'error',
        'asc',
        {
          caseSensitive: true,
          natural: false,
          minKeys: 2,
        },
      ],
    },
  },
  ...yml.configs['flat/recommended'],
  {
    files: ['.github/**/*.yml', '.github/**/*.yaml'],
    rules: {'yml/sort-keys': 'off'},
  },
  {
    ignores: [
      'node_modules/',
      'bin/',
      'coverage/',
      'reports/',
      '**/.stryker-tmp/**',
      '**/reports/mutation/**',
      'pnpm-lock.yaml',
    ],
  },
]);
