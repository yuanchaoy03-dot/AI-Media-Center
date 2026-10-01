import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import prettier from 'eslint-config-prettier/flat'
import vue from 'eslint-plugin-vue'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig(
  globalIgnores([
    '**/node_modules/**',
    '**/dist/**',
    '**/dist-ssr/**',
    '**/coverage/**',
    '**/.vite/**',
  ]),
  {
    files: ['**/*.{js,mjs,cjs,ts,vue}'],
    extends: [js.configs.recommended],
  },
  {
    files: ['**/*.{ts,vue}'],
    // 推荐配置的兼容子块默认只匹配 TS；统一范围，避免 Vue 中合法的 TS 声明被误报。
    extends: tseslint.configs.recommended.map((config) => ({
      ...config,
      files: ['**/*.{ts,vue}'],
    })),
    languageOptions: {
      parserOptions: {
        projectService: true,
        extraFileExtensions: ['.vue'],
      },
    },
    rules: {
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
    },
  },
  {
    files: ['**/*.vue'],
    extends: [vue.configs['flat/essential']],
    languageOptions: {
      // 保留 Vue 的外层 parser，让 TypeScript parser 只处理 script 内容。
      parserOptions: { parser: tseslint.parser },
    },
  },
  {
    files: ['src/**/*.{js,ts,vue}'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['tests/**/*.{js,mjs,cjs,ts}', '*.config.{js,mjs,cjs,ts}'],
    languageOptions: { globals: globals.node },
  },
  // 格式由 Prettier 统一处理，关闭可能冲突的 ESLint 风格规则。
  prettier,
)
