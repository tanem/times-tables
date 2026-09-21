import { URL, fileURLToPath } from 'node:url';
import js from '@eslint/js';
import { defineConfig, globalIgnores, includeIgnoreFile } from 'eslint/config';
import eslintConfigPrettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

const gitignorePath = fileURLToPath(new URL('.gitignore', import.meta.url));

export default defineConfig(
  includeIgnoreFile(gitignorePath),
  // Agent worktrees live under .claude/worktrees, so without this entry
  // `eslint .` in the main checkout would also lint any worktree that
  // exists.
  globalIgnores(['.claude']),
  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // These two files sit outside the tsconfig.json include, so the
    // project service cannot type them.
    files: ['eslint.config.js', 'commitlint.config.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  eslintConfigPrettier,
);
