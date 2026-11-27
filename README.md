# @nera-static/plugin-utils

[![Test](https://github.com/seebaermichi/nera-plugin-utils/actions/workflows/test.yml/badge.svg)](https://github.com/seebaermichi/nera-plugin-utils/actions/workflows/test.yml)
[![npm version](https://img.shields.io/npm/v/@nera-static/plugin-utils)](https://www.npmjs.com/package/@nera-static/plugin-utils)

🛠 Utility helpers for developing plugins for the [Nera](https://github.com/seebaermichi/nera) static site generator.

📖 **Documentation:** [nera.js.org](https://nera.js.org)

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

Returns `{}` if the file does not exist, is empty or holds nothing but comments. Malformed YAML throws. **Supply a JS fallback for every key you read.** The same function is exported from `@nera-static/plugin-utils/config`, next to `loadPluginConfig` and `createConfigReader` (see [Shared helpers](#-shared-helpers-subpath-exports)), which find the file and check it for you.

Plugins read config from the *user's* site, not from the package. The `config/<name>.yaml` shipped inside a plugin is documentation only; it is never merged with the user's copy. Resolve against `process.cwd()`:

```js
import path from 'node:path'
import { getConfig } from '@nera-static/plugin-utils'

const config = getConfig(path.resolve(process.cwd(), 'config/my-plugin.yaml'))
const title = config.title || 'Default title'
```

### Slugs

#### `slugify(text: string): string`

Turns a user-authored string into a URL-safe slug, for anything that becomes a path segment, an HTML `id`, or a URL fragment.

```js
import { slugify } from '@nera-static/plugin-utils'

slugify('Web Development')   // 'web-development'
slugify('Über uns')          // 'uber-uns'
slugify('Straße')            // 'strasse'
slugify('Café')              // 'cafe'
slugify('About Us!')         // 'about-us'
slugify('日本語')             // ''
```

**Use this rather than writing your own.** The obvious one-liner is ASCII-only and produces broken output:

```js
text.toLowerCase().replace(/[^\w]+/g, '-')   // ❌ don't
```

`\w` is `[A-Za-z0-9_]`, so `Über uns` becomes `-ber-uns` and `Straße` becomes `stra-e`. A leading hyphen is legal in an HTML `id` but is **not a valid CSS identifier** — `#-ber-uns` matches nothing in a stylesheet and `document.querySelector('#-ber-uns')` throws. That defect shipped in `plugin-one-page` until v3.0.0.

The rule: `ß` → `ss` (it has no NFKD decomposition, so it would otherwise become a hyphen mid-word), then NFKD with combining marks dropped, then lowercase, then every run of non-alphanumerics collapsed to a single `-`, then leading and trailing hyphens trimmed. It is idempotent.

A string with no Latin letters or digits returns `''`. **Decide what that means at the call site** — omitting the element is usually better than emitting `id=""`:

```js
const id = slugify(heading)
return id ? `<a id="${id}"></a>` : ''
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

The destination is **theme-aware**, resolved exactly as the generator resolves its views folder (see `resolveViewsDir` below): `theme/views/vendor/<pluginName>/` on a themed site (one with a local `theme/` folder — what `nera new` scaffolds), the deprecated root `views/vendor/<pluginName>/` otherwise. If it already exists, publishing is **skipped** and the function returns `true` — this protects the customizations you have made to previously published templates. Pass `force: true` to overwrite them.

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

#### `publishAsset(options): boolean`

Publishes a **single support file** — a plugin's client script, say — into the project's assets folder, theme-aware (`theme/assets/` on a themed site, deprecated root `assets/` otherwise) and with the same skip-if-exists rule as `publishTemplates`. Use it for plugins that ship a runtime asset alongside their templates, so the asset lands where a themed build actually serves it rather than a root `assets/` copy the build ignores.

```js
import { publishAsset } from '@nera-static/plugin-utils'

const result = publishAsset({
    sourceFile: path.resolve(__dirname, '../views/my-plugin.js'),
    targetPath: 'js/my-plugin.js', // relative to the resolved assets root
    expectedPackageName: 'dummy', // optional, for testing
    force: false, // optional, overwrite an existing file
})
```

Returns `false` outside a Nera project or when `sourceFile` is missing; a deliberate skip of an existing file returns `true`.

#### `resolveViewsDir(cwd?): string` / `resolveAssetsDir(cwd?): string`

Return the project's `views` / `assets` directory as an absolute path, resolved the same way the generator does: an explicit `folders.<key>` string in `config/app.yaml` wins, resolved against the project root (a blank `''` is the root itself, as in core); otherwise `theme/views` / `theme/assets` when a local `theme/` folder exists, or when `app.yaml` sets `theme:` and the site has no root `views/` folder (a thin themed site with no presentation of its own); otherwise the deprecated root folder. `publishTemplates` and `publishAsset` use these internally, but they are exported for plugins that need to report or reason about where their files went.

> The `__dirname` used in these option examples is not defined in ESM. See the CLI Integration example below for the two lines that define it.

### Template Publishing CLI Integration

These functions are designed to be used in `bin/publish-template.js` scripts that can be executed via npm scripts:

```js
#!/usr/bin/env node

import path from 'node:path'
import { fileURLToPath } from 'node:url'
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

## 🧩 Shared helpers (subpath exports)

Since 1.7.0 the helpers that Nera plugins, core and the tools used to copy from each other live here, one subpath per family. Import them from the subpath, never write a local copy. The `.` export above is unchanged. None of them prints unless that is its job (the logger), reads globals beyond a `cwd` default of `process.cwd()`, or calls `process.exit`.

| Subpath | Exports |
|---|---|
| `@nera-static/plugin-utils/values` | `isPlainObject`, `isText`, `textOr` |
| `@nera-static/plugin-utils/log` | `createLogger` |
| `@nera-static/plugin-utils/config` | `getConfig`, `loadPluginConfig`, `createConfigReader` |
| `@nera-static/plugin-utils/packages` | `requireFromSite`, `ownVersion` |
| `@nera-static/plugin-utils/guard` | `satisfiesFloor`, `coreVersion`, `assertCoreVersion`, `GET_ASSETS_CORE` |

### `/values` — checks for parsed YAML and frontmatter

#### `isPlainObject(value: unknown): boolean`

`true` for a mapping as YAML or JSON produce it, or `Object.create(null)`: the prototype is `Object.prototype` (of any realm) or `null`. Arrays, `null`, `Date`, `Map` and class instances are `false`, so a frontmatter value like `images: 2026-10-01` (a `Date`) is never taken for a mapping.

#### `isText(value: unknown): boolean`

`true` for a string with at least one non-whitespace character.

#### `textOr(value: unknown, fallback?): string | fallback`

The **trimmed** string when `value` is text (see `isText`), otherwise `fallback` (default `undefined`).

```js
import { isPlainObject, isText, textOr } from '@nera-static/plugin-utils/values'

isPlainObject({ title: 'Blog' })      // true
isPlainObject(Object.create(null))    // true
isPlainObject([])                     // false
isPlainObject(new Date())             // false

isText('  Blog ')                     // true
isText('   ')                         // false

textOr('  Blog  ')                    // 'Blog'
textOr('', 'Untitled')                // 'Untitled'
textOr(42, 'Untitled')                // 'Untitled'
```

### `/log` — one prefix for every message

#### `createLogger(name: string, { sink = console } = {}): { warn, info, page }`

Every line starts with `name`, taken verbatim, so a site owner can tell in a build log where a warning came from:

-   `warn(msg)` prints `⚠️ <name>: <msg>` through `sink.warn`;
-   `info(msg)` prints `ℹ️ <name>: <msg>` through `sink.info`;
-   `page(page, what, todo)` warns about one page: `⚠️ <name>: <page>: <what> — <todo>`.

A test passes its own `sink` (an object with `warn` and `info`) instead of spying on `console`.

```js
import { createLogger } from '@nera-static/plugin-utils/log'

const log = createLogger('plugin-sitemap')

log.warn('no origin set')
// ⚠️ plugin-sitemap: no origin set
log.info('wrote sitemap.xml')
// ℹ️ plugin-sitemap: wrote sitemap.xml
log.page('/blog/first.html', 'no date', 'add `date:` to its frontmatter')
// ⚠️ plugin-sitemap: /blog/first.html: no date — add `date:` to its frontmatter
```

### `/config` — finding and checking a plugin's config file

#### `getConfig(filePath: string): object`

The same function as in `.` (see [Configuration Loading](#configuration-loading)).

#### `loadPluginConfig(name: string, { cwd = process.cwd(), app } = {}): unknown`

The site's `<cwd>/<folder>/<name>.yaml`, parsed by `getConfig` and **not** checked (`{}` when it is missing). `<folder>` is `app.folders.config` when it is set, else `config`. Pass the `app` your hook receives, so a site that moved its config folder still works.

#### `createConfigReader({ file, defaults, readers, warn = console.warn }): reader`

The defaults-and-readers skeleton every plugin config shares, with one set of warnings for the whole fleet:

-   `file` is the file as the site owner knows it (`'config/sitemap.yaml'`); every message starts with `<file>: `.
-   `defaults` is the full default config, a plain object. Each call of `defaults()` or `normalize()` gets its own deep copy (`structuredClone`).
-   `readers` holds one function per known top-level key: `(value, current, reader) => newValue`. `current` is the value so far (the default), `reader` is the object returned here, for its `bad`, `ignore` and `warn`. Returning `undefined` keeps `current`.
-   `warn` is where messages go, usually a `createLogger(...).warn`.

`createConfigReader` throws a `TypeError` when `defaults` or `readers` is not a plain object. The returned `reader` has:

| Member | Does |
|---|---|
| `normalize(raw)` | a fresh copy of `defaults`, with each key of `raw` replaced by what its reader returns. `null`/`undefined` → the defaults, silently. Not a mapping → `expected a mapping at the top level, using defaults`. A key without its own reader (checked with `Object.hasOwn`, so `constructor:` or `toString:` is unknown too) → `ignoring unknown key <key>`. A key whose value is `null` (empty in YAML) keeps its default. |
| `defaults()` | a fresh deep copy of `defaults` |
| `bad(key, value, fallback)` | warns `invalid <key> <value>, using <fallback>` (or `, ignoring it` when `fallback` is `null` or `undefined`) and returns `fallback` |
| `ignore(where, what)` | warns `ignoring <where>, expected <what>` and returns `undefined` |
| `unknown(where, key)` | warns `ignoring unknown key <where><key>`, for nested mappings (`where` like `'labels.'`) |
| `show(value)` | a value as the messages show it: `a date` for a `Date`, else its JSON, else `String(value)` |
| `warn(msg)` | `warn` with the `<file>: ` prefix |

```js
import { createConfigReader, loadPluginConfig } from '@nera-static/plugin-utils/config'
import { createLogger } from '@nera-static/plugin-utils/log'
import { isText } from '@nera-static/plugin-utils/values'

const log = createLogger('plugin-sitemap')

const reader = createConfigReader({
    file: 'config/sitemap.yaml',
    defaults: { changefreq: 'weekly', exclude: [] },
    readers: {
        changefreq: (value, current, r) =>
            isText(value) ? value.trim() : r.bad('changefreq', value, current),
        exclude: (value, current, r) =>
            Array.isArray(value) ? value : r.ignore('exclude', 'a list of paths'),
    },
    warn: log.warn,
})

export function getAppData({ app }) {
    const config = reader.normalize(loadPluginConfig('sitemap', { app }))
    return { ...app, sitemap: config }
}
```

With `changefreq: 3` and `excludes: []` in the site's `config/sitemap.yaml`, the build prints:

```text
⚠️ plugin-sitemap: config/sitemap.yaml: invalid changefreq 3, using "weekly"
⚠️ plugin-sitemap: config/sitemap.yaml: ignoring unknown key "excludes"
```

### `/packages` — packages as the site sees them

#### `requireFromSite(cwd = process.cwd()): NodeJS.Require`

A `require` that resolves from the site root, as if the site's own `package.json` asked. Use it for packages the **site** installs (core, a theme, an optional highlighter): resolved from your plugin, they would come from the plugin's own dependencies, or not be found at all. The `package.json` need not exist; only its folder counts.

#### `ownVersion(url: string | URL): string | null`

The `version` of the package the module at `url` belongs to: the nearest `package.json` with a `version`, from the module's folder upwards (a `{ "type": "module" }` manifest in between is skipped). `null` when there is none or it cannot be parsed. Pass `import.meta.url`; a plain path works too.

```js
import { ownVersion, requireFromSite } from '@nera-static/plugin-utils/packages'

const siteRequire = requireFromSite()
const themeDir = siteRequire.resolve('@nera-static/theme-blog/package.json')

const version = ownVersion(import.meta.url)   // your package's version, e.g. '1.2.0'
```

### `/guard` — failing loudly on a too-old core

A plugin that relies on a hook of a newer `@nera-static/core` (`getAssets` since 4.13.0) is silently never called on an older one, and the build still exits 0. Check core's version from `getAppData` and fail loudly instead; `peerDependencies` reports the same at install time, the guard catches an install that ignored it.

#### `assertCoreVersion({ plugin, need = GET_ASSETS_CORE, why = 'the getAssets hook', cwd, from, version, hint })`

Throws when core is known to be older than `need`:

```text
plugin-sitemap: @nera-static/core 4.12.0 is too old; it needs >= 4.13.0 (the getAssets hook). Update with `npm update @nera-static/nera` (or `@nera-static/core`).
```

`plugin` is the name as you want it shown. `version` defaults to `coreVersion({ cwd, from })`. `hint`, when it is a non-blank string, is appended (trimmed) after the update advice, for a way out that only your plugin knows — e.g. ``hint: 'Or set `assets: false` in config/code-blocks.yaml.'``. An **unknown** version passes: some core is calling the plugin, and refusing on a guess would block a working setup.

#### `coreVersion({ cwd = process.cwd(), from } = {}): string | null`

The version of `@nera-static/core` the build most likely runs on: resolved from the site root `cwd` first, then, when `from` is given, from there. Pass your plugin's `import.meta.url` as `from`, so a symlinked plugin (`npm link`) that resolves from its real path still finds a core. `null` when none is found.

#### `satisfiesFloor(version: unknown, floor: string): boolean`

Whether `version` is `floor` or later by semver precedence: major, minor and patch compared as numbers, a prerelease (`4.13.0-beta.1`) **below** its release, build metadata ignored, surrounding whitespace allowed. Anything that is no version is `false`. Throws a `TypeError` when `floor` is not a plain `x.y.z`.

#### `GET_ASSETS_CORE`

`'4.13.0'`, the core release that introduced the `getAssets` hook, and the default `need`.

```js
import { assertCoreVersion, satisfiesFloor } from '@nera-static/plugin-utils/guard'

export function getAppData({ app }) {
    assertCoreVersion({ plugin: 'plugin-sitemap', from: import.meta.url })
    return { ...app }
}

satisfiesFloor('4.13.0', '4.13.0')          // true
satisfiesFloor(' 4.14.2 ', '4.13.0')        // true
satisfiesFloor('4.13.0-beta.1', '4.13.0')   // false
satisfiesFloor('latest', '4.13.0')          // false
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
import path from 'node:path'
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
#!/usr/bin/env node
// bin/publish-template.js - Template publishing script

import path from 'node:path'
import { fileURLToPath } from 'node:url'
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
- **Runtime dependency**: `js-yaml ^5.2.2` only
- **Nera**: no direct dependency on the generator — this package is used by
  plugins, not by the generator itself

---

## 📦 License

MIT
