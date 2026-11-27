/**
 * Finding packages the way a site sees them
 * (`@nera-static/plugin-utils/packages`): `requireFromSite` resolves from the
 * site's own `node_modules`, not from the calling package's, and `ownVersion`
 * reads the version of the package a module belongs to.
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
