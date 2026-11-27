/**
 * Which pages a plugin acts on (`@nera-static/plugin-utils/pages`): the
 * pages core renders and the pages a site keeps out of search engines.
 */

const nonBlank = (value) => typeof value === 'string' && value.trim() !== ''

/**
 * Whether core renders the page: its frontmatter names a `layout` and it has
 * an `href`. Core skips a page without `layout` silently, so a sitemap, feed
 * or search index that lists it points at a page that does not exist.
 *
 * @param {object|null|undefined} meta the page's `meta`
 * @returns {boolean}
 * @example isRenderedPage({ layout: 'pages/default.pug', href: '/a.html' }) // true
 */
export function isRenderedPage(meta) {
    return nonBlank(meta?.layout) && nonBlank(meta?.href)
}

/**
 * Whether the page asks search engines not to index it: its `robots`, or the
 * site's `app.robots` when the page sets none, contains `noindex` (any case,
 * e.g. `'NoIndex, follow'`).
 *
 * @param {object|null|undefined} meta the page's `meta`
 * @param {object|null|undefined} [app] the site's `app`
 * @returns {boolean}
 * @example isNoindex({ robots: 'noindex, follow' }, {}) // true
 */
export function isNoindex(meta, app) {
    const robots = meta?.robots || app?.robots
    return typeof robots === 'string' && /noindex/i.test(robots)
}
