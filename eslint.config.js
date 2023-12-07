const globals = require('globals')
const typescriptParser = require('@typescript-eslint/parser')
const ts = require('@typescript-eslint/eslint-plugin')
const js = require('@eslint/js')
const prettier = require('eslint-config-prettier')

// some plugins don't support flat config and we need to remap their rules
function remap(rules, oldPrefix, newPrefix) {
  return Object.fromEntries(
    Object.entries(rules).map(([key, value]) => [
      key.replace(new RegExp(`^${oldPrefix}`), newPrefix),
      value,
    ]),
  )
}

module.exports = [
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
      'ts/no-explicit-any': 'error',
      'ts/naming-convention': [
        'error',
        {
          selector: 'property',
          format: ['strictCamelCase'],
          filter: {
            regex: '[-_ ]',
            match: false,
          },
        },
      ],
      'ts/no-use-before-define': [
        'error',
        {
          functions: false,
        },
      ],
      'ts/sort-type-constituents': 'off',
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
        sourceType: 'script',
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
