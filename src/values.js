/**
 * Value checks for parsed YAML and frontmatter, shared by every Nera plugin
 * and tool (`@nera-static/plugin-utils/values`).
 */

/**
 * Whether `value` is a plain object: a mapping as YAML or JSON produce it,
 * or `Object.create(null)`. Arrays, `null`, `Date`, `Map` and class
 * instances are not.
 *
 * An object's prototype must be `null` or an `Object.prototype` — also one
 * of another realm (a `node:vm` context), recognised as the end of its
 * prototype chain, so the check does not depend on this realm's `Object`.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isPlainObject(value) {
    if (value === null || typeof value !== 'object') return false
    const prototype = Object.getPrototypeOf(value)
    return prototype === null || Object.getPrototypeOf(prototype) === null
}

/**
 * Whether `value` is a string with at least one non-whitespace character.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isText(value) {
    return typeof value === 'string' && value.trim() !== ''
}

/**
 * `value` trimmed when it is text (see `isText`), otherwise `fallback`.
 *
 * @template T
 * @param {unknown} value
 * @param {T} [fallback] returned for a non-string or a blank string
 * @returns {string | T}
 */
export function textOr(value, fallback = undefined) {
    return isText(value) ? value.trim() : fallback
}
