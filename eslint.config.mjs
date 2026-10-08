import eslint from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

const frameworkImports = ['express', 'zod', 'jose', 'pg', 'swagger-ui-express', '@prisma/*'];
const restrictImports = (groups, message) => ['error', { patterns: [{ group: groups, message }] }];

export default [
  { ignores: ['node_modules/**', 'src/generated/**', 'coverage/**', '.idea/**'] },
  eslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node, Bun: 'readonly' },
    },
  },
  {
    files: ['**/*.ts'],
    languageOptions: { parser: tsParser },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      'no-undef': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      curly: ['error', 'all'],
      eqeqeq: ['error', 'always'],
    },
  },
  {
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': restrictImports(
        [
          ...frameworkImports,
          'node:*',
          'bun:*',
          '**/application/**',
          '**/infrastructure/**',
          '**/presentation/**',
          '**/generated/**',
        ],
        'Domain must remain independent of HTTP, persistence and application layers.',
      ),
    },
  },
  {
    files: ['src/application/**/*.ts'],
    rules: {
      'no-restricted-imports': restrictImports(
        [
          ...frameworkImports,
          'node:*',
          'bun:*',
          '**/infrastructure/**',
          '**/presentation/**',
          '**/generated/**',
        ],
        'Application services depend on domain models and ports, never concrete adapters.',
      ),
    },
  },
  {
    files: ['src/presentation/**/*.ts'],
    rules: {
      'no-restricted-imports': restrictImports(
        ['@prisma/*', 'pg', 'jose', '**/infrastructure/**', '**/generated/**', '**/composition'],
        'HTTP code must call application services; adapters are wired in the composition root.',
      ),
    },
  },
  {
    files: ['src/infrastructure/**/*.ts'],
    rules: {
      'no-restricted-imports': restrictImports(
        ['express', 'swagger-ui-express', '**/presentation/**'],
        'Infrastructure implements ports and must not depend on HTTP code.',
      ),
    },
  },
  prettier,
];
