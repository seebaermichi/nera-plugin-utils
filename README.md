# @nera-static/plugin-utils

[![Test](https://github.com/seebaermichi/nera-plugin-utils/actions/workflows/test.yml/badge.svg)](https://github.com/seebaermichi/nera-plugin-utils/actions/workflows/test.yml)
[![npm version](https://img.shields.io/npm/v/@nera-static/plugin-utils)](https://www.npmjs.com/package/@nera-static/plugin-utils)

🛠 Utility helpers for developing plugins for the [Nera](https://github.com/seebaermichi/nera) static site generator.

---

## 📦 Installation

```bash
npm install @nera-static/plugin-utils
```

---

## 📚 Features

### Configuration Loading

#### `getConfig(filePath: string): object`

Reads and parses a YAML config file, returning its contents as a JavaScript object.

Returns `{}` if the file does not exist or is empty — it never throws. **Supply a JS fallback for every key you read.**

Plugins read config from the *user's* site, not from the package. The `config/<name>.yaml` shipped inside a plugin is documentation only; it is never merged with the user's copy. Resolve against `process.cwd()`:

```js
import path from 'path'
import { getConfig } from '@nera-static/plugin-utils'

const config = getConfig(path.resolve(process.cwd(), 'config/my-plugin.yaml'))
const title = config.title || 'Default title'
```

### Template Publishing

#### `validateNeraProject(expectedPackageName?: string): boolean`

Validates if the current working directory is a valid Nera project.

A `package.json` must be present. Given that, the directory qualifies if it *looks* like a Nera project — it contains both `config/app.yaml` and `pages/` — or if its `package.json` name matches `expectedPackageName` or starts with `nera`. The shape check means a project can be named anything, but it does not remove the `package.json` requirement.

```js
import { validateNeraProject } from '@nera-static/plugin-utils'

if (validateNeraProject()) {
    console.log('Valid Nera project!')
}
```

#### `publishTemplates(options): boolean`

Publishes specific template files from a plugin to a Nera project.

If `views/vendor/<pluginName>/` already exists, publishing is **skipped** and the function returns `true` — this protects the customizations you have made to previously published templates. Pass `force: true` to overwrite them.

```js
import { publishTemplates } from '@nera-static/plugin-utils'

const result = publishTemplates({
    pluginName: 'plugin-my-awesome-plugin',
    sourceDir: path.resolve(__dirname, '../views/'),
    templateFiles: ['template.pug', 'another-template.pug'], // or single file as string
    expectedPackageName: 'dummy', // optional, for testing
    force: false, // optional, re-publish over an existing destination
})
```

Returns `false` if any listed template is missing from `sourceDir`. Sources are all verified before anything is copied, so a failure never leaves a partially published destination.

#### `publishAllTemplates(options): boolean`

Publishes all `.pug` template files from a plugin's views directory to a Nera project, **including those in subdirectories**, preserving their structure. A template that does `include partials/nav` therefore ships together with the partial it depends on.

```js
import { publishAllTemplates } from '@nera-static/plugin-utils'

const result = publishAllTemplates({
    pluginName: 'plugin-my-awesome-plugin',
    sourceDir: path.resolve(__dirname, '../views/'),
    expectedPackageName: 'dummy', // optional, for testing
    force: false, // optional, re-publish over an existing destination
})
```

Returns `true` and logs a warning if `sourceDir` contains no `.pug` files; an unreadable `sourceDir` returns `false`. A publish script following the `process.exit(result ? 0 : 1)` pattern below therefore exits `0` having copied nothing — check your `sourceDir` if a plugin's templates never appear.

> The `__dirname` used in these option examples is not defined in ESM. See the CLI Integration example below for the two lines that define it.

### Template Publishing CLI Integration

These functions are designed to be used in `bin/publish-template.js` scripts that can be executed via npm scripts:

```js
#!/usr/bin/env node

import path from 'path'
import { fileURLToPath } from 'url'
import { publishAllTemplates } from '@nera-static/plugin-utils'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pluginName = 'plugin-my-awesome-plugin'
const sourceDir = path.resolve(__dirname, '../views/')

const result = publishAllTemplates({
    pluginName,
    sourceDir,
    expectedPackageName: 'dummy', // for test-only override
})

process.exit(result ? 0 : 1)
```

---

## 🧱 Use Cases

This package is intended for use inside Nera plugins to:

1. **Load Configuration**: Simplify loading YAML configuration files
2. **Publish Templates**: Standardize template publishing across plugins
3. **Validate Projects**: Ensure commands run in valid Nera projects

### Example Plugin Structure

```js
// index.js - Main plugin file
import path from 'path'
import { getConfig } from '@nera-static/plugin-utils'

export function getAppData(data) {
    const config = getConfig(
        path.resolve(process.cwd(), 'config/my-plugin.yaml')
    )

    // Spread the incoming app. The return value REPLACES `app` wholesale --
    // returning a bare object discards every other plugin's data, silently.
    return {
        ...data.app,
        myPlugin: {
            // ... plugin logic using config
        },
    }
}
```

A plugin exports `getAppData` and/or `getMetaData`. Both receive a single object — `{ app, pagesData }` — and both must be **synchronous**. `getAppData` must return a plain object, `getMetaData` an array; a wrong return type is skipped with a console warning while the build still succeeds, so a plugin that appears to "do nothing" is usually a return-type problem.

See the [Nera contributing guide](https://github.com/seebaermichi/nera/blob/main/CONTRIBUTING.md) for the full plugin contract.

```js
// bin/publish-template.js - Template publishing script
#!/usr/bin/env node

import path from 'path'
import { fileURLToPath } from 'url'
import { publishAllTemplates } from '@nera-static/plugin-utils'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const result = publishAllTemplates({
  pluginName: 'plugin-my-awesome-plugin',
  sourceDir: path.resolve(__dirname, '../views/')
})

process.exit(result ? 0 : 1)
```

---

## 🧪 Development

```bash
npx vitest run      # single pass -- `npm test` is watch mode
npm run lint
```

---

## 🤝 Contributing

Issues and pull requests are welcome. See the
[Nera contributing guide](https://github.com/seebaermichi/nera/blob/main/CONTRIBUTING.md)
for plugin development, the hook contract, and local setup.

For this repo specifically:

- `npx vitest run` and `npm run lint` must pass (`npm test` is watch mode).
- Bump the version and update `CHANGELOG.md` **in the same commit** as the change.
- Every plugin in the fleet depends on this package, so treat the exported
  function signatures as a public contract — changing one is a **major** bump.
- Releases publish from CI on a pushed `v*` tag. Never run `npm publish`.

---

## 🧑‍💻 Maintainers

Created and maintained by [@seebaermichi](https://github.com/seebaermichi)

---

## 🧩 Compatibility

- **Node.js**: >= 20.0.0
- **Runtime dependency**: `js-yaml ^4.1.0` only
- **Nera**: no direct dependency on the generator — this package is used by
  plugins, not by the generator itself

---

## 📦 License

MIT
