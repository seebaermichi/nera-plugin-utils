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

Since 1.7.0 the helpers that Nera plugins, core and the tools used to copy from each other live here, one subpath per family (1.8.0 added `/html` to `/pages`). Import them from the subpath, never write a local copy. The `.` export above is unchanged. None of them prints unless that is its job (the logger, `pageDate`'s warning), reads globals beyond a `cwd` default of `process.cwd()`, or calls `process.exit`.

| Subpath | Exports |
|---|---|
| `@nera-static/plugin-utils/values` | `isPlainObject`, `isText`, `textOr` |
| `@nera-static/plugin-utils/log` | `createLogger` |
| `@nera-static/plugin-utils/config` | `getConfig`, `loadPluginConfig`, `createConfigReader` |
| `@nera-static/plugin-utils/packages` | `requireFromSite`, `ownVersion`, `isPluginPackage`, `pluginShortName`, `pluginPackage`, `themePackage` |
| `@nera-static/plugin-utils/guard` | `satisfiesFloor`, `coreVersion`, `assertCoreVersion`, `GET_ASSETS_CORE` |
| `@nera-static/plugin-utils/html` | `escapeHtml`, `escapeXml`, `escapeRegExp` |
| `@nera-static/plugin-utils/lang` | `siteLang`, `pageLang`, `siteLanguages`, `isLanguageMap`, `localize` |
| `@nera-static/plugin-utils/dates` | `toDate`, `formatW3C`, `PUBLISHED_KEYS`, `UPDATED_KEYS`, `pageDate`, `byDate` |
| `@nera-static/plugin-utils/sort` | `byString`, `byHref` |
| `@nera-static/plugin-utils/urls` | `resolveOrigin`, `encodePath`, `joinUrl`, `siteUrl`, `normalizeBasePath`, `withBasePath`, `stripBasePath`, `hasScheme`, `isInside`, `srcsetUrls`, `mapSrcset` |
| `@nera-static/plugin-utils/frontmatter` | `FRONTMATTER_OPTIONS`, `splitFrontmatter` |
| `@nera-static/plugin-utils/glob` | `matchesPattern`, `matchesAny`, `IGNORE_FILE`, `readIgnoreList`, `isIgnoredAsset` |
| `@nera-static/plugin-utils/pages` | `isRenderedPage`, `isNoindex` |

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

#### `isPluginPackage(name: unknown): boolean`

Whether core loads the dependency `name` as a plugin: an `@nera-static/plugin-*` package other than the library `@nera-static/plugin-utils`, core's own rule. The scope's other members (`core`, `nera`, `validate`, `theme-*`, `starter-*`) are no plugins; a non-string is `false`.

#### `pluginShortName(name: string): string`

The name core shows a plugin package under, in its log and in `config/plugin-order.yaml`: the package name without `@nera-static/`. Any other name is returned unchanged.

#### `pluginPackage(spec: unknown): { name: string, pkg: string }`

The official plugin a spec names, in the forms `nera plugin add` takes: `<name>`, `plugin-<name>` or `@nera-static/plugin-<name>`. `name` is the bare name (`'sitemap'`), `pkg` the package. Throws a `TypeError` for anything else (another scope, a version or tag such as `sitemap@1`, a path, an uppercase name, `utils`), with a message that names the accepted forms and the catalog at https://nera.js.org/plugins/.

#### `themePackage(spec: unknown): string | null`

The npm package a `theme:` spec (`app.theme`) names, by core's rule: a scoped name or one with a `/` is used verbatim (a third-party theme), a bare name becomes `@nera-static/theme-<name>`. `null` for a local theme (a spec starting with `.`) and for a missing or blank spec: no package.

```js
import { isPluginPackage, pluginPackage, pluginShortName, themePackage } from '@nera-static/plugin-utils/packages'

isPluginPackage('@nera-static/plugin-tags')    // true
isPluginPackage('@nera-static/plugin-utils')   // false
isPluginPackage('@nera-static/theme-blog')     // false

pluginShortName('@nera-static/plugin-tags')    // 'plugin-tags'

pluginPackage('sitemap')          // { name: 'sitemap', pkg: '@nera-static/plugin-sitemap' }
pluginPackage('plugin-sitemap')   // the same
pluginPackage('utils')            // throws TypeError: "utils" is not a Nera plugin. …

themePackage('blog')              // '@nera-static/theme-blog'
themePackage('@acme/theme-x')     // '@acme/theme-x'
themePackage('./theme')           // null
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

### `/html` — escaping

Each escaper takes any value: `null` and `undefined` give `''`, everything else is converted with `String()` first. Each escapes once (`&amp;` becomes `&amp;amp;`).

#### `escapeHtml(value: unknown): string`

`& < > " '` as entities (`'` as `&#39;`), safe in a text node and in a double- or single-quoted attribute.

#### `escapeXml(value: unknown): string`

`& < > " '` as entities (`'` as `&apos;`), and the characters XML 1.0 forbids even escaped (C0 controls other than tab, LF and CR; lone surrogates; U+FFFE and U+FFFF) **dropped**, so any page text gives a well-formed feed or sitemap.

#### `escapeRegExp(value: unknown): string`

Every regular-expression special character (`. * + ? ^ $ { } ( ) | [ ] \`) escaped, for a `RegExp` that matches the text literally.

```js
import { escapeHtml, escapeRegExp, escapeXml } from '@nera-static/plugin-utils/html'

escapeHtml('<a href="x">Tom & Jerry\'s</a>')
// '&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;'
escapeHtml(null)                       // ''
escapeHtml(42)                         // '42'
escapeXml('Tom & Jerry\'s\u0007')      // 'Tom &amp; Jerry&apos;s' (the BEL is dropped)
escapeRegExp('a.b*(c)')                // 'a\\.b\\*\\(c\\)'
```

### `/lang` — languages and translated values

A language is text, **trimmed**: `lang: 'de '` is `de`, and a blank `lang` counts as absent.

#### `siteLang(app, fallback = 'en'): string`

`app.lang` trimmed, else `fallback`.

#### `pageLang(meta, app, fallback = 'en'): string`

`meta.lang` trimmed, else `siteLang(app, fallback)`.

#### `siteLanguages(app): Set<string>`

`app.lang` plus the keys of `app.translations`, each trimmed, blank ones left out. Empty when the site sets neither.

#### `isLanguageMap(value: unknown, languages?: Iterable<string>): boolean`

Whether `value` is a non-empty plain object and, when `languages` is given, every key is one of them. A map lacking a language still counts (`localize` falls back).

#### `localize(value: unknown, lang: string, { fallbacks = [], any = false } = {}): string | null`

One value in one language. A string is returned as it is. A language map gives its entry for `lang`, else for the first of `fallbacks` it has, else, with `any`, its first entry; only text entries count, so `de: ''` falls back. Anything else, and a map without a usable entry, gives **`null`** (not `undefined`).

```js
import { isLanguageMap, localize, pageLang, siteLang, siteLanguages } from '@nera-static/plugin-utils/lang'

siteLang({ lang: ' de ' })                         // 'de'
siteLang({})                                       // 'en'
pageLang({ lang: 'de ' }, { lang: 'en' })          // 'de'
pageLang({ lang: '  ' }, { lang: 'fr' })           // 'fr'
siteLanguages({ lang: 'en', translations: { de: {}, ' es ': {} } })   // Set { 'en', 'de', 'es' }
isLanguageMap({ en: 'a', xx: 'b' }, ['en', 'de'])  // false

localize({ en: 'Hi', de: 'Hallo' }, 'de')          // 'Hallo'
localize({ en: 'Hi' }, 'de')                       // null
localize({ en: 'Hi' }, 'de', { fallbacks: ['en'] })   // 'Hi'
localize({ fr: 'Salut' }, 'de', { any: true })     // 'Salut'
localize('Hi', 'de')                               // 'Hi'
```

### `/dates` — frontmatter dates

Nothing here reads the build machine's time zone: a time without an offset is read as **UTC**, as YAML reads an unquoted timestamp, so a site gives the same dates and the same order on every machine.

#### `toDate(value: unknown): Date | null`

A valid `Date` (core parses an unquoted frontmatter date into one), or a string `YYYY-MM-DD`, optionally followed by `T` or a space and `hh:mm[:ss[.fraction]]` with an optional `Z` or `±hh:mm` offset (surrounding whitespace ignored). A day or time that does not exist (`2026-02-30`, `24:00`) is `null`, as is every other form (`1.10.2026`, a number, an offset like `+0200`).

#### `formatW3C(value: unknown): string | null`

The date in W3C Datetime form, in UTC: `YYYY-MM-DD` for UTC midnight, else `YYYY-MM-DDThh:mm:ssZ` without milliseconds. Takes whatever `toDate` takes; `null` when that is no date.

#### `PUBLISHED_KEYS`

`['date', 'datePublished', 'published']`, frozen: the keys `pageDate(meta, 'published')` tries, in order.

#### `UPDATED_KEYS`

`['updated', 'updatedAt', 'lastmod', 'dateModified']`, frozen: the keys `pageDate(meta, 'updated')` tries, in order.

**`createdAt` is in neither list**: core fills it from the file's birth time when the frontmatter has no date, and CI stamps every file alike. A caller that wants it as a fallback for sorting passes it to `byDate` itself.

#### `pageDate(meta, kind: 'published' | 'updated', { warn = console.warn } = {}): Date | null`

The first key of the list for `kind` whose value is a usable date; `null` when none is. A present value that is no date warns once (`<href>: ignoring <key> <value>, expected a date like …`) and the next key is tried; an absent, `null` or blank value is skipped silently. Pass your logger's `warn`. Any other `kind` throws a `TypeError`.

#### `byDate(get, { descending = false } = {}): (a, b) => number`

A comparator for `Array.prototype.sort`: `get(item)` returns the item's date in any form `toDate` takes. Oldest first, newest first with `descending`; items without a usable date go **last in both directions**. Equal dates give `0`, so chain a tie-break (`byDate(get)(a, b) || byHref(a, b)`). Throws a `TypeError` when `get` is not a function.

```js
import { byDate, formatW3C, pageDate, toDate } from '@nera-static/plugin-utils/dates'
import { createLogger } from '@nera-static/plugin-utils/log'

toDate('2026-10-01')                    // 2026-10-01T00:00:00.000Z
toDate('2026-10-01 09:30')              // 2026-10-01T09:30:00.000Z (UTC)
toDate('2026-10-01T09:30:00+02:00')     // 2026-10-01T07:30:00.000Z
toDate('2026-02-30')                    // null

formatW3C('2026-10-01')                       // '2026-10-01'
formatW3C('2026-10-01T09:30:15.250+02:00')    // '2026-10-01T07:30:15Z'

const log = createLogger('plugin-feed')
pageDate({ href: '/a.html', date: '2026-02-30', published: '2026-10-01' }, 'published', { warn: log.warn })
// 2026-10-01T00:00:00.000Z, after
// ⚠️ plugin-feed: /a.html: ignoring date "2026-02-30", expected a date like 2026-10-01 or 2026-10-01T09:30:00Z

pagesData.sort(byDate((page) => page.meta.date, { descending: true }))
// newest first, pages without a date at the end
```

### `/sort` — locale-free comparators

They compare UTF-16 code units, like `<` on strings, never with `localeCompare`: the order is the same on every machine (uppercase before lowercase, ASCII before other letters).

#### `byString(a: unknown, b: unknown): -1 | 0 | 1`

Two strings by code unit; a non-string compares as `''` and sorts first.

#### `byHref(a, b): -1 | 0 | 1`

Two pages (`{ meta }`) or two metas by `href` (`x.meta?.href ?? x.href`), as `byString`.

```js
import { byHref, byString } from '@nera-static/plugin-utils/sort'

['b', 'B', 'a', 'ä'].sort(byString)    // ['B', 'a', 'b', 'ä']
pagesData.sort(byHref)                 // by meta.href
```

### `/urls` — origin, absolute URLs, `base_path`, containment, `srcset`

Absolute URLs are percent-encoded, so a canonical link, a sitemap `<loc>` and a feed `<link>` of the same page are the same string. The `base_path` helpers give exactly core's output.

#### `resolveOrigin({ cwd = process.cwd(), app } = {}): string`

`app.origin`, else `app_origin` from the site's `config/canonical-links.yaml` (`app.folders.config` honoured), without surrounding whitespace and trailing slashes; `''` when neither is set. The file is only read when `app.origin` is blank or missing.

#### `encodePath(value: unknown): string`

`value` with everything a URL may not contain percent-encoded (space, non-ASCII, a `%` that starts no valid escape), while valid `%XX` escapes and URL delimiters stay, so an encoded path is not encoded twice. A lone surrogate becomes `%EF%BF%BD`; `null`/`undefined` give `''`.

#### `joinUrl(origin: string, basePath: string, href: string): string`

The absolute URL of a page: `origin` + `basePath` + `href` (`meta.href`), the path encoded by `encodePath`, otherwise verbatim (`/index.html` stays).

#### `siteUrl(origin: string, basePath?: string): string`

The site's own URL, `origin` + `basePath` without trailing slashes, encoded like `joinUrl`. A non-string `basePath` gives `origin`.

#### `normalizeBasePath(raw: unknown): string`

`base_path` from `config/app.yaml` as core normalises it into `app.basePath`: a non-string, blank text or `/` gives `''`; otherwise trimmed, trailing slashes dropped, one leading slash guaranteed.

#### `withBasePath(url: unknown, basePath: string): unknown`

`url` under `basePath`, as core prefixes every root-absolute URL of a built page. Only a string starting with a single `/` is prefixed; `//cdn/…`, a URL with a scheme, a relative URL, a non-string and a value already under `basePath` come back unchanged, so applying it twice is harmless.

#### `stripBasePath(url: unknown, basePath: string): unknown`

The inverse: `basePath` itself gives `'/'`, `basePath/…` loses the prefix, anything else (`/subway` for `/sub`) comes back unchanged.

#### `hasScheme(url: unknown): boolean`

Whether `url` starts with a scheme (`https:`, `mailto:`, `data:`, any case). `//host/…` has none.

#### `isInside(root: string, target: string, { self = true } = {}): boolean`

Whether the path `target` is `root` or lies below it, compared after `path.resolve` (symlinks not followed). A child folder named `..foo` is inside; `/site/publication` is not inside `/site/public`. With `self: false`, `root` itself does not count.

#### `srcsetUrls(value: unknown): string[]`

The URLs of a `srcset`, by the HTML standard's candidate rule: a URL ends at whitespace, so a comma inside it (`?w=1,2`, a data URI) does not split it. A non-string gives `[]`.

#### `mapSrcset(value: unknown, fn: (url, index) => unknown): unknown`

`value` with each candidate URL replaced by `fn(url, index)`; descriptors, commas and whitespace are kept byte for byte. A non-string comes back unchanged.

```js
import {
    encodePath, hasScheme, isInside, joinUrl, mapSrcset, normalizeBasePath,
    resolveOrigin, siteUrl, srcsetUrls, stripBasePath, withBasePath,
} from '@nera-static/plugin-utils/urls'

resolveOrigin({ app: { origin: ' https://ex.com/ ' } })   // 'https://ex.com'

encodePath('/über uns.html')                     // '/%C3%BCber%20uns.html'
encodePath('/%C3%BCber.html')                    // '/%C3%BCber.html'
joinUrl('https://ex.com', '/sub', '/über uns.html')   // 'https://ex.com/sub/%C3%BCber%20uns.html'
siteUrl('https://ex.com', '/sub/')               // 'https://ex.com/sub'

normalizeBasePath('nera-website/')               // '/nera-website'
normalizeBasePath('/')                           // ''
withBasePath('/css/main.css', '/sub')            // '/sub/css/main.css'
withBasePath('/sub/a.html', '/sub')              // '/sub/a.html'
withBasePath('//cdn.example.com/x.js', '/sub')   // '//cdn.example.com/x.js'
stripBasePath('/sub/a.html', '/sub')             // '/a.html'
stripBasePath('/subway', '/sub')                 // '/subway'
hasScheme('mailto:x@y.z')                        // true

isInside('/site/public', '/site/public/a.html')         // true
isInside('/site/public', '/site/public', { self: false })   // false
isInside('/site/public', '/site/publication')           // false

srcsetUrls('/a.jpg?w=1,2 1x, /b.jpg 2x')         // ['/a.jpg?w=1,2', '/b.jpg']
mapSrcset('/a.jpg 1x, /b.jpg 2x', (url) => withBasePath(url, '/sub'))
// '/sub/a.jpg 1x, /sub/b.jpg 2x'
```

### `/frontmatter` — how core reads a page's frontmatter

Both mirror `@nera-static/core`, so a page the validator or an editor accepts parses the same way in the build.

#### `FRONTMATTER_OPTIONS`

The frozen `yaml` parse options core uses: `{ schema: 'core', customTags: ['timestamp'], merge: true, uniqueKeys: false }` — unquoted dates become `Date` objects, `<<` merge keys work, a repeated key takes the last value. Pass them to `yaml.parse` from your own `yaml` dependency; this package does not depend on `yaml`.

#### `splitFrontmatter(raw: string): { yamlText: string, body: string } | null`

A page file split by core's rule: CRLF and a lone CR read as LF, the first line must be exactly `---`, the next line that is exactly `---` closes the block (`----` or `--- ` do not). Without a closing line the rest is YAML and the body is empty; an empty block gives `yamlText: ''`. **`null`** when the file has no frontmatter (first line not `---`, a leading BOM or indentation, or `raw` not a string).

```js
import { parse } from 'yaml'
import { FRONTMATTER_OPTIONS, splitFrontmatter } from '@nera-static/plugin-utils/frontmatter'

splitFrontmatter('---\r\ntitle: Hi\r\n---\r\n# Body\r\n')   // { yamlText: 'title: Hi', body: '# Body\n' }
splitFrontmatter('# no frontmatter')                         // null
splitFrontmatter('---\n---\nx')                              // { yamlText: '', body: 'x' }

const parts = splitFrontmatter(raw)
const meta = parts ? parse(parts.yamlText, FRONTMATTER_OPTIONS) ?? {} : {}
```

### `/glob` — exclude patterns and `.neraignore`

Two rule sets, kept apart on purpose: the `*` glob of the sitemap and feed `exclude` lists, and core's `.neraignore` rule, which knows no wildcards.

#### `matchesPattern(href: unknown, pattern: unknown): boolean`

`*` matches any run of characters (`/` included, none at all), everything else is literal, anchored at both ends. A non-string never matches.

#### `matchesAny(href: unknown, patterns: unknown[] = []): boolean`

Whether `href` matches any of `patterns`; a non-array matches nothing.

#### `IGNORE_FILE`

`'.neraignore'`, the file name `readIgnoreList` reads from the site root.

#### `readIgnoreList(cwd = process.cwd()): string[]`

The patterns in the site's `.neraignore`, one per line, trimmed, blank lines dropped; `[]` when the file does not exist. Read from the site root, as core reads it.

#### `isIgnoredAsset(ignoreList: string[], file: string, root: string): boolean`

Whether core's asset copy skips `file`: its path relative to `root` (the assets folder), with `/` separators, equals a pattern or starts with a pattern plus `/`. So `images` skips `images/a.png`, `images/` skips nothing, and `robots` does not skip `robots.txt`.

```js
import { isIgnoredAsset, matchesAny, matchesPattern, readIgnoreList } from '@nera-static/plugin-utils/glob'

matchesPattern('/drafts/a.html', '/drafts/*')            // true
matchesPattern('/drafts/a.html', '/drafts')              // false
matchesAny('/404.html', ['/404.html', '/drafts/*'])      // true

const ignored = readIgnoreList()                         // e.g. ['images', 'robots']
isIgnoredAsset(['images'], '/site/assets/images/a.png', '/site/assets')    // true
isIgnoredAsset(['robots'], '/site/assets/robots.txt', '/site/assets')      // false
```

### `/pages` — which pages a plugin acts on

#### `isRenderedPage(meta): boolean`

Whether core renders the page: a non-blank `layout` and `href`. Core skips a page without `layout` silently, so a sitemap, feed or search index listing it points at nothing.

#### `isNoindex(meta, app): boolean`

Whether the page asks search engines not to index it: `meta.robots`, or `app.robots` when the page sets none, contains `noindex` in any case.

```js
import { isNoindex, isRenderedPage } from '@nera-static/plugin-utils/pages'

isRenderedPage({ layout: 'pages/default.pug', href: '/a.html' })   // true
isRenderedPage({ href: '/a.html' })                                // false
isNoindex({ robots: 'NoIndex, follow' }, {})                       // true
isNoindex({}, { robots: 'noindex' })                               // true
isNoindex({ robots: 'index' }, { robots: 'noindex' })              // false
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
