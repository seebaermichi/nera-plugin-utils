/**
 * Reading and checking a site's plugin config files
 * (`@nera-static/plugin-utils/config`): `getConfig` parses one YAML file,
 * `loadPluginConfig` finds a plugin's file in the site, and
 * `createConfigReader` merges it over the plugin's defaults key by key, with
 * one set of warnings for the whole fleet.
 */

import fs from 'node:fs'
import path from 'node:path'
// js-yaml 5 dropped the default export; `load` is a named export now.
import { load } from 'js-yaml'
import { isPlainObject, textOr } from './values.js'

// js-yaml 5 throws on a document with no content, where 4 returned undefined.
// A packaged config whose every key is commented out is the normal case here —
// that is how plugins ship their defaults — so it has to keep behaving like an
// absent config instead of crashing the build. Real syntax errors still throw.
function hasNoDocument(content) {
    return content
        .split('\n')
        .every((line) => {
            const trimmed = line.trim()
            return trimmed === '' || trimmed.startsWith('#')
        })
}

/**
 * The parsed YAML file at `filePath`, or `{}` when it is missing or holds
 * nothing but comments and blank lines. Malformed YAML throws.
 *
 * @param {string} filePath
 * @returns {unknown} whatever the document holds (usually a mapping)
 */
export function getConfig(filePath) {
    if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8')
        if (hasNoDocument(content)) {
            return {}
        }
        return load(content) || {}
    }
    return {}
}

/**
 * The site's `config/<name>.yaml`, parsed by `getConfig` and not checked
 * (`{}` when it is missing). The folder is `app.folders.config` when set,
 * else `config`, relative to `cwd`.
 *
 * @param {string} name the file name without `.yaml` (`'sitemap'`)
 * @param {{ cwd?: string, app?: object }} [options]
 * @returns {unknown} the raw parsed document, for `createConfigReader`
 */
export function loadPluginConfig(name, { cwd = process.cwd(), app } = {}) {
    const folder = textOr(app?.folders?.config, 'config')
    return getConfig(path.resolve(cwd, folder, `${name}.yaml`))
}

/**
 * A value as a warning shows it: `a date` for a `Date`, else its JSON, else
 * `String(value)` (for `undefined`, a function, or what JSON cannot write).
 *
 * @param {unknown} value
 * @returns {string}
 */
function show(value) {
    if (value instanceof Date) return 'a date'
    try {
        return JSON.stringify(value) ?? String(value)
    } catch {
        return String(value)
    }
}

/**
 * The defaults-and-readers skeleton every plugin config shares. Every
 * message starts with `<file>: ` and goes to `warn`:
 *
 * - `expected a mapping at the top level, using defaults`
 * - `ignoring unknown key <where><key>`
 * - `invalid <key> <value>, using <fallback>` — or `, ignoring it` when the
 *   fallback is `null` or `undefined`
 * - `ignoring <path>, expected <what>`
 *
 * `normalize(raw)` starts from a fresh copy of `defaults` and, for each key
 * of `raw`, calls `readers[key](value, current, reader)` and stores what it
 * returns. A key without its own reader warns as unknown (also `constructor`
 * or `toString`, which every object inherits), a `null` value (an empty key
 * in YAML) keeps the default, and a reader that returns `undefined` keeps it
 * too. The third argument is the reader object itself, so a reader warns
 * through `reader.bad`, `reader.ignore` or `reader.warn` with the same prefix.
 *
 * @param {object} options
 * @param {string} options.file the file as the site owner knows it
 *     (`'config/sitemap.yaml'`)
 * @param {object} options.defaults the full default config, a plain object;
 *     each `defaults()` and `normalize()` call gets its own deep copy
 * @param {Record<string, (value: unknown, current: unknown, reader: object) => unknown>} options.readers
 *     one function per known top-level key
 * @param {(msg: string) => void} [options.warn] where messages go (default
 *     `console.warn`; usually a `createLogger(...).warn`)
 * @returns {{
 *     defaults: () => object,
 *     normalize: (raw: unknown) => object,
 *     show: (value: unknown) => string,
 *     bad: (key: string, value: unknown, fallback: unknown) => unknown,
 *     ignore: (where: string, what: string) => undefined,
 *     unknown: (where: string, key: string) => void,
 *     warn: (msg: string) => void,
 * }}
 */
export function createConfigReader({ file, defaults, readers, warn = console.warn }) {
    if (!isPlainObject(defaults)) {
        throw new TypeError(`createConfigReader(${show(file)}): defaults must be a plain object`)
    }
    if (!isPlainObject(readers)) {
        throw new TypeError(`createConfigReader(${show(file)}): readers must be a plain object`)
    }

    const reader = {
        defaults: () => structuredClone(defaults),
        show,
        warn: (msg) => warn(`${file}: ${msg}`),
        bad(key, value, fallback) {
            const using = fallback === null || fallback === undefined
                ? 'ignoring it'
                : `using ${show(fallback)}`
            reader.warn(`invalid ${key} ${show(value)}, ${using}`)
            return fallback
        },
        ignore(where, what) {
            reader.warn(`ignoring ${where}, expected ${what}`)
            return undefined
        },
        unknown(where, key) {
            reader.warn(`ignoring unknown key ${where}${show(key)}`)
        },
        normalize(raw) {
            const config = reader.defaults()
            if (raw === null || raw === undefined) return config
            if (!isPlainObject(raw)) {
                reader.warn('expected a mapping at the top level, using defaults')
                return config
            }
            for (const [key, value] of Object.entries(raw)) {
                if (!Object.hasOwn(readers, key)) {
                    reader.unknown('', key)
                    continue
                }
                // A key present but empty reads as null; treat it like an absent key.
                if (value === null) continue
                const result = readers[key](value, config[key], reader)
                if (result !== undefined) config[key] = result
            }
            return config
        },
    }
    return reader
}
