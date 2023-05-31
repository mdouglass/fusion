import globals from 'globals'
import typescriptParser from '@typescript-eslint/parser'
import ts from '@typescript-eslint/eslint-plugin'
import js from '@eslint/js'
import prettier from 'eslint-config-prettier'

// some plugins don't support flat config and we need to remap their rules
function remap(rules, oldPrefix, newPrefix) {
  return Object.fromEntries(
    Object.entries(rules).map(([key, value]) => [
      key.replace(new RegExp(`^${oldPrefix}`), newPrefix),
      value,
    ]),
  )
}

export default [
  js.configs.recommended,
  { rules: remap(ts.configs.all.rules, '@typescript-eslint', 'ts') },
  { rules: remap(prettier.rules, '@typescript-eslint', 'ts') },
  {
    rules: {
      'ts/prefer-readonly-parameter-types': 'off',
      'ts/no-type-alias': [
        'error',
        {
          allowAliases: 'always',
          allowLiterals: 'in-unions-and-intersections',
          allowGenerics: 'always',
        },
      ],
      'ts/no-magic-numbers': 'off',
      // MSED turn back on
      'ts/no-explicit-any': 'warn',
      'ts/naming-convention': [
        'error',
        {
          selector: 'property',
          format: ['strictCamelCase'],
          filter: {
            // you can expand this regex as you find more cases that require quoting that you want to allow
            regex: '[-_ ]',
            match: false,
          },
        },
      ],
      'ts/no-use-before-define': [
        'error',
        {
          functions: false
        }
      ],
      'ts/strict-boolean-expressions': [
        'error',
        { allowNullableBoolean: true, allowNullableObject: true },
      ],
    },
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      globals: globals.node,
      parser: typescriptParser,
      parserOptions: {
        project: './tsconfig.json',
        sourceType: 'module',
      },
    },
    plugins: {
      // eslintJsPlugin,
      ts,
    },
    rules: {
      'no-console': 'error',
    },
  },
]
