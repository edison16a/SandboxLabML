import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

/**
 * Next's recommended rules plus a few project rules. The React Compiler rules
 * in react-hooks v7 flag the normal three.js pattern of mutating objects
 * inside useFrame, so they are relaxed for the render layer only.
 */
const config = [
  ...nextVitals,
  ...nextTs,
  {
    ignores: ['.next/**', 'node_modules/**', 'playwright-report/**', 'test-results/**', 'public/**', '.claude/**'],
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.name='eval']",
          message: 'Scripts compile to closures. Never call eval.',
        },
      ],
    },
  },
  {
    files: ['src/render/**/*.{ts,tsx}', 'src/features/**/*.{ts,tsx}', 'src/studio/**/*.{ts,tsx}'],
    rules: {
      'react-hooks/immutability': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react/no-unknown-property': 'off',
    },
  },
  {
    files: ['src/engine/**/*.ts'],
    rules: {
      'no-restricted-globals': ['error', 'window', 'document', 'localStorage', 'indexedDB'],
    },
  },
];

export default config;
