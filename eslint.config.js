import { builtinModules } from 'node:module'

// A Node builtin is imported with its `node:` prefix (`node:fs`, never
// `fs`), so it can never be shadowed by an npm package of the same name.
// `builtinModules` lists the bare names; the prefix-only ones (`node:test`)
// and the internal `_` modules are left out.
const bareBuiltins = builtinModules
    .filter((name) => !name.startsWith('node:') && !name.startsWith('_'))
    .map((name) => ({
        name,
        message: `Import the builtin as 'node:${name}'.`,
    }))

export default [
    {
        ignores: ['node_modules', 'public', 'dist'],
    },
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
        },
        rules: {
            indent: ['error', 4],
            semi: ['error', 'never'],
            quotes: ['error', 'single'],
            'no-unused-vars': ['warn'],
            'no-restricted-imports': ['error', { paths: bareBuiltins }],
        },
    },
]
