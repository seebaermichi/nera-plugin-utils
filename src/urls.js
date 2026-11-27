/**
 * Site URLs, `base_path`, path containment and `srcset`, shared by every
 * Nera plugin and tool (`@nera-static/plugin-utils/urls`).
 *
 * Absolute URLs are percent-encoded (`joinUrl`, `siteUrl`), so a canonical
 * link, a sitemap `<loc>` and a feed `<link>` of the same page are the same
 * string. The `base_path` helpers give exactly `@nera-static/core`'s output.
 */

import path from 'node:path'
import { loadPluginConfig } from './config.js'
import { isPlainObject } from './values.js'

// A percent-escape that is already valid: `%` and two hex digits. The
// capture group keeps it in `split`'s output, at the odd indexes.
const PERCENT_ESCAPE = /(%[0-9A-Fa-f]{2})/

// A URL scheme (`https:`, `mailto:`, `data:`, …), per RFC 3986.
const SCHEME = /^[a-z][a-z0-9+.-]*:/i

// ASCII whitespace as the HTML standard defines it for `srcset`.
const WHITESPACE = /[\t\n\f\r ]/

// The origin without whitespace and trailing slashes, '' for a non-string.
const trimOrigin = (origin) => (typeof origin === 'string' ? origin.trim().replace(/\/+$/, '') : '')

/**
 * The site origin without surrounding whitespace and trailing slashes:
 * `app.origin`, else `app_origin` from the site's
 * `config/canonical-links.yaml` (`app.folders.config` honoured), the order
 * canonical-links, sitemap, feed and validate use. `''` when neither is a
 * non-blank string. The file is only read when `app.origin` is blank or
 * missing; a missing file reads as no origin.
 *
 * @param {{ cwd?: string, app?: object }} [options]
 * @returns {string} e.g. `'https://example.com'`, or `''`
 */
export function resolveOrigin({ cwd = process.cwd(), app } = {}) {
    const own = trimOrigin(app?.origin)
    if (own) return own
    const canonical = loadPluginConfig('canonical-links', { cwd, app })
    return trimOrigin(isPlainObject(canonical) ? canonical.app_origin : undefined)
}

/**
 * `value` with everything a URL may not contain percent-encoded (space,
 * non-ASCII, a `%` that starts no valid escape, …), while valid `%XX`
 * escapes and URL delimiters (`/ ? # & =` …) stay as they are, so an
 * already-encoded path is not encoded twice. Lone surrogates become
 * `%EF%BF%BD` (U+FFFD) instead of throwing. `null` and `undefined` give
 * `''`, other non-strings are converted with `String()`.
 *
 * @param {unknown} value a path such as `meta.href`
 * @returns {string}
 */
export function encodePath(value) {
    const text = value === null || value === undefined ? '' : String(value)
    return text
        .toWellFormed()
        .split(PERCENT_ESCAPE)
        .map((part, index) => (index % 2 ? part : encodeURI(part)))
        .join('')
}

/**
 * The absolute URL of a page: `origin` + `basePath` + the logical `href`
 * (`meta.href`), with the path percent-encoded by `encodePath` but
 * otherwise verbatim (`/index.html` stays). `origin` is used as given
 * (from `resolveOrigin`), `basePath` is core's normalised `app.basePath`
 * (`''` or `'/sub'`).
 *
 * @param {string} origin
 * @param {string} [basePath]
 * @param {string} href
 * @returns {string} e.g. `'https://ex.com/sub/%C3%BCber%20uns.html'`
 */
export function joinUrl(origin, basePath, href) {
    return `${origin}${encodePath(`${basePath || ''}${href}`)}`
}

/**
 * The site's own URL: `origin` + `basePath` without trailing slashes,
 * percent-encoded like `joinUrl`. Ids such as `<siteUrl>/#website` and
 * absolute links hang off it. A non-string `basePath` gives `origin`.
 *
 * @param {string} origin
 * @param {string} [basePath]
 * @returns {string} e.g. `'https://ex.com/sub'`
 */
export function siteUrl(origin, basePath) {
    if (typeof basePath !== 'string') return origin
    return `${origin}${encodePath(basePath.replace(/\/+$/, ''))}`
}

/**
 * A site's `base_path` (config/app.yaml) as a URL prefix, exactly as core
 * normalises it into `app.basePath`: a non-string, blank text or `/` gives
 * `''` (a root-served site); otherwise trimmed, trailing slashes dropped and
 * one leading slash guaranteed (`'nera-website'` → `'/nera-website'`,
 * `'/foo/bar/'` → `'/foo/bar'`).
 *
 * @param {unknown} raw
 * @returns {string}
 */
export function normalizeBasePath(raw) {
    if (typeof raw !== 'string') return ''
    const trimmed = raw.trim()
    if (trimmed === '' || trimmed === '/') return ''
    const noTrailing = trimmed.replace(/\/+$/, '')
    return noTrailing.startsWith('/') ? noTrailing : `/${noTrailing}`
}

/**
 * `url` under `basePath`, as core prefixes every root-absolute URL of a
 * built page: only a string starting with one `/` is prefixed. A
 * protocol-relative `//cdn/…`, a relative or absolute URL with a scheme, a
 * non-string, and a value already under `basePath` (`basePath` itself or
 * `basePath/…`) are returned unchanged, so applying it twice is harmless.
 * An empty `basePath` changes nothing.
 *
 * @param {unknown} url
 * @param {string} basePath normalised, `''` or `'/sub'`
 * @returns {unknown} the prefixed string, or `url` itself
 */
export function withBasePath(url, basePath) {
    if (!basePath || typeof url !== 'string') return url
    if (!url.startsWith('/') || url.startsWith('//')) return url
    if (url === basePath || url.startsWith(`${basePath}/`)) return url
    return `${basePath}${url}`
}

/**
 * The logical path of a root-absolute `url` under `basePath`, the inverse
 * of `withBasePath`: `basePath` itself gives `'/'`, `basePath/…` loses the
 * prefix, anything else (another path, `/subway` for `/sub`, a non-string)
 * is returned unchanged. An empty `basePath` changes nothing.
 *
 * @param {unknown} url
 * @param {string} basePath normalised, `''` or `'/sub'`
 * @returns {unknown} the stripped string, or `url` itself
 */
export function stripBasePath(url, basePath) {
    if (!basePath || typeof url !== 'string') return url
    if (url === basePath) return '/'
    return url.startsWith(`${basePath}/`) ? url.slice(basePath.length) : url
}

/**
 * Whether `url` starts with a URL scheme (`https:`, `mailto:`, `tel:`,
 * `data:`, case-insensitive). `//host/…` has none; a non-string is `false`.
 *
 * @param {unknown} url
 * @returns {boolean}
 */
export function hasScheme(url) {
    return typeof url === 'string' && SCHEME.test(url)
}

/**
 * Whether the path `target` is `root` itself or lies below it, compared
 * lexically after `path.resolve` (symlinks are not followed). A child
 * folder literally named `..foo` is inside. With `self: false`, `root`
 * itself does not count ("strictly below").
 *
 * @param {string} root
 * @param {string} target
 * @param {{ self?: boolean }} [options]
 * @returns {boolean}
 */
export function isInside(root, target, { self = true } = {}) {
    const relative = path.relative(root, target)
    if (relative === '') return self
    return !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative)
}

// The image candidates of a `srcset` value, with each URL's position, by
// the HTML standard's rule: candidates are separated by commas, a URL runs
// to the next whitespace (so `?a=1,2` and `data:…;base64,…` stay whole), a
// URL's trailing commas end the candidate, and the descriptors run to the
// next comma outside parentheses.
function srcsetCandidates(value) {
    const candidates = []
    let pos = 0
    while (pos < value.length) {
        while (pos < value.length && (value[pos] === ',' || WHITESPACE.test(value[pos]))) pos++
        if (pos >= value.length) break

        const start = pos
        while (pos < value.length && !WHITESPACE.test(value[pos])) pos++
        let end = pos
        if (value[end - 1] === ',') {
            while (value[end - 1] === ',') end--
            candidates.push({ start, end })
            continue
        }
        candidates.push({ start, end })

        // The standard's tokenizer does not nest parentheses: the first `)`
        // leaves them, whatever `(` came before it.
        let inParens = false
        while (pos < value.length && (value[pos] !== ',' || inParens)) {
            if (value[pos] === '(') inParens = true
            else if (value[pos] === ')') inParens = false
            pos++
        }
    }
    return candidates
}

/**
 * The URLs of a `srcset` value, in order, parsed by the HTML standard's
 * candidate rule: a URL ends at whitespace, so a comma inside it
 * (`/a.jpg?a=1,2`, a data URI) does not split it. A non-string gives `[]`.
 *
 * @param {unknown} value e.g. `'/a.jpg 1x, /b.jpg 2x'`
 * @returns {string[]}
 */
export function srcsetUrls(value) {
    if (typeof value !== 'string') return []
    return srcsetCandidates(value).map(({ start, end }) => value.slice(start, end))
}

/**
 * `value` with every candidate URL of the `srcset` replaced by
 * `fn(url, index)` (converted with `String()`), found as `srcsetUrls`
 * finds them. Everything else, descriptors, commas and whitespace, is kept
 * byte for byte, so an `fn` that returns its argument gives `value` back.
 * A non-string is returned unchanged.
 *
 * @param {unknown} value
 * @param {(url: string, index: number) => unknown} fn
 * @returns {unknown}
 */
export function mapSrcset(value, fn) {
    if (typeof value !== 'string') return value
    let result = ''
    let last = 0
    srcsetCandidates(value).forEach(({ start, end }, index) => {
        result += value.slice(last, start) + String(fn(value.slice(start, end), index))
        last = end
    })
    return result + value.slice(last)
}
