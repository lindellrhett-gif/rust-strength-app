// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // Edge Functions run on Deno (npm: imports, the Deno global); their shared
    // logic in supabase/functions/_shared is plain TypeScript and is linted.
    ignores: ['dist/*', 'node_modules/*', 'src/lib/database.types.ts', '.expo/*', 'supabase/functions/*/index.ts'],
  },
  {
    // The build scripts are plain Node programs, not app code, so they need
    // Node's globals rather than React Native's.
    files: ['scripts/**/*.js'],
    languageOptions: {
      globals: {
        __dirname: 'readonly',
        Buffer: 'readonly',
        console: 'readonly',
        module: 'writable',
        process: 'readonly',
        require: 'readonly',
      },
    },
  },
  {
    // Database tests run under plain Node as ES modules.
    files: ['supabase/tests/**/*.mjs'],
    languageOptions: {
      sourceType: 'module',
      globals: { console: 'readonly', process: 'readonly' },
    },
  },
]);
