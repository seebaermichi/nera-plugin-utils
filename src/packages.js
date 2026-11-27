/**
 * Finding packages the way a site sees them
 * (`@nera-static/plugin-utils/packages`): `requireFromSite` resolves from the
 * site's own `node_modules`, not from the calling package's, and `ownVersion`
 * reads the version of the package a module belongs to. The package-name
 * rules (`isPluginPackage`, `pluginShortName`, `pluginPackage`,
 * `themePackage`) say which packages core loads as plugins and which package
 * a plugin or theme spec names.
 */

import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

/**
 * A `require` that resolves from the site root `cwd`, as if the site's own
 * `package.json` asked. Use it for packages the site installs (core, a theme,
 * an optional highlighter): resolved from a plugin, they would come from the
 * plugin's dependencies or not be found at all. The `package.json` need not
 * exist; only its folder counts.
 *
 * @param {string} [cwd] the site root (default `process.cwd()`)
 * @returns {NodeJS.Require} use `.resolve(spec)` for a path, call it to load
 */
export function requireFromSite(cwd = process.cwd()) {
    return createRequire(path.join(path.resolve(cwd), 'package.json'))
}

/**
 * The `version` of the package the module at `url` belongs to: the nearest
 * `package.json` with a `version`, from the module's folder upwards (a
 * `{ "type": "module" }` manifest in between is skipped). `null` when there is
 * none or it cannot be read.
 *
 * @param {string|URL} url the module's `import.meta.url` (a path works too)
 * @returns {string|null}
 * @example ownVersion(import.meta.url) // '1.7.0'
 */
export function ownVersion(url) {
    const file = String(url).startsWith('file:') ? fileURLToPath(url) : path.resolve(String(url))
    let dir = path.dirname(file)
    for (;;) {
        const version = readVersion(path.join(dir, 'package.json'))
        if (version !== undefined) return version
        const parent = path.dirname(dir)
        if (parent === dir) return null
        dir = parent
    }
}

// The manifest's version; `undefined` when the file does not exist or names no
// version (keep walking up), `null` when it exists but cannot be parsed.
function readVersion(file) {
    let text
    try {
        text = fs.readFileSync(file, 'utf-8')
    } catch {
        return undefined
    }
    try {
        const { version } = JSON.parse(text)
        return typeof version === 'string' ? version : undefined
    } catch {
        return null
    }
}

const SCOPE = '@nera-static/'
const PLUGIN_PREFIX = 'plugin-'
const PLUGIN_SCOPE_PREFIX = `${SCOPE}${PLUGIN_PREFIX}`
// In the scope's `plugin-` namespace, but no plugin: this library.
const NOT_PLUGINS = new Set([`${PLUGIN_SCOPE_PREFIX}utils`])
const PLUGIN_NAME = /^[a-z0-9][a-z0-9-]*$/
const CATALOG_URL = 'https://nera.js.org/plugins/'

/**
 * Whether core loads the dependency `name` as a plugin: an
 * `@nera-static/plugin-*` package other than `@nera-static/plugin-utils`
 * (core's `setup-plugins.js` rule). The scope's other members (`core`,
 * `nera`, `validate`, `theme-*`, `starter-*`) are none.
 *
 * @param {unknown} name a package name from a site's `dependencies`
 * @returns {boolean}
 * @example isPluginPackage('@nera-static/plugin-tags') // true
 */
export function isPluginPackage(name) {
    return typeof name === 'string' && name.startsWith(PLUGIN_SCOPE_PREFIX) && !NOT_PLUGINS.has(name)
}

/**
 * The name core gives a plugin package in its log and in
 * `config/plugin-order.yaml`: the package name without `@nera-static/`
 * (core's `shortPluginName`); any other name is returned unchanged.
 *
 * @param {string} name
 * @returns {string}
 * @example pluginShortName('@nera-static/plugin-tags') // 'plugin-tags'
 */
export function pluginShortName(name) {
    return name.startsWith(SCOPE) ? name.slice(SCOPE.length) : name
}

/**
 * The official plugin a spec names, in the forms `nera plugin add` takes:
 * `<name>`, `plugin-<name>` or `@nera-static/plugin-<name>`.
 *
 * @param {unknown} spec
 * @returns {{ name: string, pkg: string }} `name` without prefix (`sitemap`),
 *   `pkg` the package (`@nera-static/plugin-sitemap`)
 * @throws {TypeError} for anything else: another scope, a version or tag
 *   (`x@1`), a path, an uppercase name, `utils` (the library)
 * @example pluginPackage('sitemap') // { name: 'sitemap', pkg: '@nera-static/plugin-sitemap' }
 */
export function pluginPackage(spec) {
    let name = typeof spec === 'string' ? spec : ''
    if (name.startsWith(PLUGIN_SCOPE_PREFIX)) name = name.slice(PLUGIN_SCOPE_PREFIX.length)
    else if (name.startsWith(PLUGIN_PREFIX)) name = name.slice(PLUGIN_PREFIX.length)
    const pkg = `${PLUGIN_SCOPE_PREFIX}${name}`
    if (!PLUGIN_NAME.test(name) || NOT_PLUGINS.has(pkg)) {
        throw new TypeError(
            `${JSON.stringify(spec)} is not a Nera plugin. Give an official plugin as ` +
                '`<name>`, `plugin-<name>` or `@nera-static/plugin-<name>` (e.g. `sitemap`); ' +
                `the catalog is at ${CATALOG_URL}.`
        )
    }
    return { name, pkg }
}

/**
 * The npm package a `theme:` spec names, by core's rule (`theme.js`): a
 * scoped name or one with a `/` is used verbatim (third-party themes), a bare
 * name becomes `@nera-static/theme-<name>`. `null` for a local theme (a spec
 * starting with `.`) and for a missing or blank spec, which mean no package.
 *
 * @param {unknown} spec `app.theme` (or `NERA_THEME`)
 * @returns {string|null}
 * @example themePackage('blog') // '@nera-static/theme-blog'
 */
export function themePackage(spec) {
    if (typeof spec !== 'string' || spec.trim() === '' || spec.startsWith('.')) return null
    return spec.includes('/') || spec.startsWith('@') ? spec : `${SCOPE}theme-${spec}`
}
