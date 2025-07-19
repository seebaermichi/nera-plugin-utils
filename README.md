# @nera-static/plugin-utils

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

```js
import { getConfig } from '@nera-static/plugin-utils'

const config = getConfig('./path/to/config.yaml')
console.log(config.title)
```

### Template Publishing

#### `validateNeraProject(expectedPackageName?: string): boolean`

Validates if the current working directory is a valid Nera project by checking the `package.json`.

```js
import { validateNeraProject } from '@nera-static/plugin-utils'

if (validateNeraProject()) {
    console.log('Valid Nera project!')
}
```

#### `publishTemplates(options): boolean`

Publishes specific template files from a plugin to a Nera project.

```js
import { publishTemplates } from '@nera-static/plugin-utils'

const result = publishTemplates({
    pluginName: 'plugin-my-awesome-plugin',
    sourceDir: path.resolve(__dirname, '../views/'),
    templateFiles: ['template.pug', 'another-template.pug'], // or single file as string
    expectedPackageName: 'dummy', // optional, for testing
})
```

#### `publishAllTemplates(options): boolean`

Publishes all `.pug` template files from a plugin's views directory to a Nera project.

```js
import { publishAllTemplates } from '@nera-static/plugin-utils'

const result = publishAllTemplates({
    pluginName: 'plugin-my-awesome-plugin',
    sourceDir: path.resolve(__dirname, '../views/'),
    expectedPackageName: 'dummy', // optional, for testing
})
```

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
import { getConfig } from '@nera-static/plugin-utils'

export function getAppData(app) {
    const config = getConfig(`${__dirname}/config/my-plugin.yaml`)

    return {
        myPlugin: {
            // ... plugin logic using config
        },
    }
}
```

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

## 🧑‍💻 Maintainers

Created and maintained by [@seebaermichi](https://github.com/seebaermichi)

---

## 📄 License

MIT
