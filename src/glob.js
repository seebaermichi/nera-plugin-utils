/**
 * Pattern matching for page hrefs and site assets, shared by every Nera
 * plugin and tool (`@nera-static/plugin-utils/glob`).
 *
 * Two rule sets, kept apart on purpose: `matchesPattern`/`matchesAny` are the
 * `*` glob of the sitemap and feed `exclude` lists; `readIgnoreList` and
 * `isIgnoredAsset` mirror how `@nera-static/core` applies `.neraignore`
 * (`getIgnoredFiles`/`ignoreFiles` in `src/render.js`), which knows no
 * wildcards at all.
 */
import fs from 'node:fs'
import path from 'node:path'
import { escapeRegExp } from './html.js'

/** The site's ignore list, read from the site root as core reads it. */
export const IGNORE_FILE = '.neraignore'

/**
 * Whether `href` matches `pattern`: `*` matches any run of characters
 * (including `/` and none at all), everything else is literal, anchored at
 * both ends. A value that is not a string never matches.
 *
 * @param {unknown} href
 * @param {unknown} pattern
 * @returns {boolean}
 * @example matchesPattern('/drafts/a.html', '/drafts/*') // true
 */
export function matchesPattern(href, pattern) {
    if (typeof href !== 'string' || typeof pattern !== 'string') return false
    const source = pattern.split('*').map(escapeRegExp).join('.*')
    return new RegExp(`^${source}$`).test(href)
}

/**
 * Whether `href` matches any of `patterns` (see `matchesPattern`).
 *
 * @param {unknown} href
 * @param {unknown[]} [patterns]
 * @returns {boolean}
 */
export function matchesAny(href, patterns = []) {
    return Array.isArray(patterns) && patterns.some((pattern) => matchesPattern(href, pattern))
}

/**
 * The patterns in the site's `.neraignore`: one per line, trimmed, blank
 * lines dropped, `[]` when the file does not exist. Read from `cwd`, the
 * site root, not from `assets/`, as core reads it.
 *
 * @param {string} [cwd] the site root
 * @returns {string[]}
 */
export function readIgnoreList(cwd = process.cwd()) {
    const file = path.join(cwd, IGNORE_FILE)
    if (!fs.existsSync(file)) return []
    return fs
        .readFileSync(file, 'utf8')
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line !== '')
}

/**
 * Whether core's site asset pass skips `file`: its path relative to `root`
 * (the assets folder), with POSIX separators, equals a pattern or starts with
 * a pattern plus `/`. There are no wildcards and no trailing-slash form:
 * `images` skips `images/a.png`, `images/` skips nothing, and `robots` does
 * not skip `robots.txt`. Core's `ignoreFiles` returns the opposite (whether
 * to keep the file); this name says what `true` means.
 *
 * @param {string[]} ignoreList from `readIgnoreList`
 * @param {string} file an absolute path, or one relative to the same base as `root`
 * @param {string} root the assets folder the patterns are relative to
 * @returns {boolean}
 */
export function isIgnoredAsset(ignoreList, file, root) {
    const relative = path.relative(root, file).replace(/\\/g, '/')
    return ignoreList.some((pattern) => relative === pattern || relative.startsWith(`${pattern}/`))
}
