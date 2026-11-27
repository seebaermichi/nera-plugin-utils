/**
 * Languages of a site and its pages, and values translated per language,
 * shared by every Nera plugin and tool (`@nera-static/plugin-utils/lang`).
 *
 * A language is text (see `isText`), trimmed: `lang: 'de '` is `de`, and a
 * blank `lang` counts as absent.
 */

import { isPlainObject, isText, textOr } from './values.js'

/**
 * The site's language: `app.lang` trimmed, or `fallback` when it is missing,
 * not a string or blank.
 *
 * @param {{ lang?: unknown } | undefined | null} app
 * @param {string} [fallback]
 * @returns {string}
 */
export function siteLang(app, fallback = 'en') {
    return textOr(app?.lang, fallback)
}

/**
 * A page's language: `meta.lang` trimmed, else the site's (see `siteLang`),
 * else `fallback`.
 *
 * @param {{ lang?: unknown } | undefined | null} meta
 * @param {{ lang?: unknown } | undefined | null} app
 * @param {string} [fallback]
 * @returns {string}
 */
export function pageLang(meta, app, fallback = 'en') {
    return textOr(meta?.lang) ?? siteLang(app, fallback)
}

/**
 * The languages of a site: `app.lang` plus the keys of `app.translations`,
 * each trimmed; blank ones are left out. Empty when the site sets neither.
 *
 * @param {{ lang?: unknown, translations?: unknown } | undefined | null} app
 * @returns {Set<string>}
 */
export function siteLanguages(app) {
    const languages = new Set()
    if (isText(app?.lang)) languages.add(app.lang.trim())
    if (isPlainObject(app?.translations)) {
        for (const key of Object.keys(app.translations)) {
            if (isText(key)) languages.add(key.trim())
        }
    }
    return languages
}

/**
 * Whether `value` is a language map: a non-empty plain object (see
 * `isPlainObject`) — and, when `languages` is given, one whose keys are all
 * among them. A subset counts, so a map lacking one language is still a
 * language map (and `localize` falls back).
 *
 * @param {unknown} value
 * @param {Iterable<string>} [languages] e.g. `siteLanguages(app)`
 * @returns {boolean}
 */
export function isLanguageMap(value, languages) {
    if (!isPlainObject(value)) return false
    const keys = Object.keys(value)
    if (keys.length === 0) return false
    if (languages === undefined) return true
    const known = languages instanceof Set ? languages : new Set(languages)
    return keys.every((key) => known.has(key))
}

/**
 * One value in one language. A string is returned as it is. A language map
 * (a plain object) gives its entry for `lang`, else for the first of
 * `fallbacks` it has (each code trimmed, blank ones skipped), else — with
 * `any` — its first entry; an entry counts only when it is text (see
 * `isText`), so `de: ''` or `de: null` falls back.
 * Anything else, and a map without a usable entry, gives `null`.
 *
 * The plugins' chains are options: `{ fallbacks: [siteLang(app)] }`,
 * `{ fallbacks: ['en'], any: true }`, or none at all.
 *
 * @param {unknown} value a string or `{ <lang>: string }`
 * @param {string} lang
 * @param {{ fallbacks?: string[], any?: boolean }} [options]
 * @returns {string | null}
 */
export function localize(value, lang, { fallbacks = [], any = false } = {}) {
    if (typeof value === 'string') return value
    if (!isPlainObject(value)) return null
    for (const candidate of [lang, ...fallbacks]) {
        const code = textOr(candidate)
        if (code !== undefined && Object.hasOwn(value, code) && isText(value[code])) {
            return value[code]
        }
    }
    if (any) {
        const first = Object.values(value).find(isText)
        if (first !== undefined) return first
    }
    return null
}
