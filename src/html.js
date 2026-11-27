/**
 * Escaping for HTML, XML and regular expressions, shared by every Nera plugin
 * and tool (`@nera-static/plugin-utils/html`).
 *
 * Each escaper takes any value: `null` and `undefined` give `''`, everything
 * else is converted with `String()` first.
 */

const HTML_ENTITIES = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    '\'': '&#39;',
}

const XML_ENTITIES = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    '\'': '&apos;',
}

// Characters XML 1.0 does not allow anywhere in a document, not even
// escaped: C0 controls other than tab, LF and CR, lone surrogates, and
// U+FFFE/U+FFFF.
const XML_INVALID = new RegExp([
    '[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\uFFFE\\uFFFF]',
    '[\\uD800-\\uDBFF](?![\\uDC00-\\uDFFF])',
    '(?<![\\uD800-\\uDBFF])[\\uDC00-\\uDFFF]',
].join('|'), 'g')

// Every character with a meaning in a JavaScript regular expression.
const REGEXP_SPECIAL = /[.*+?^${}()|[\]\\]/g

const asString = (value) => (value === null || value === undefined ? '' : String(value))

/**
 * `value` escaped for HTML: `& < > " '` become entities (`'` as `&#39;`), so
 * the result is safe in a text node and in a double- or single-quoted
 * attribute value. Escapes once: `&amp;` becomes `&amp;amp;`.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function escapeHtml(value) {
    return asString(value).replace(/[&<>"']/g, (char) => HTML_ENTITIES[char])
}

/**
 * `value` escaped for XML: `& < > " '` become entities (`'` as `&apos;`), and
 * the characters XML 1.0 forbids even escaped (C0 controls but tab, LF and
 * CR; lone surrogates; U+FFFE and U+FFFF) are dropped, so any page text
 * yields a well-formed document.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function escapeXml(value) {
    return asString(value)
        .replace(XML_INVALID, '')
        .replace(/[&<>"']/g, (char) => XML_ENTITIES[char])
}

/**
 * `value` with every regular-expression special character
 * (`. * + ? ^ $ { } ( ) | [ ] \`) escaped, for building a `RegExp` that
 * matches the text literally.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function escapeRegExp(value) {
    return asString(value).replace(REGEXP_SPECIAL, '\\$&')
}
