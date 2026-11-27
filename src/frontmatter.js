/**
 * How a Nera page's frontmatter is found and parsed, shared by core, the
 * validator and every tool that reads page files
 * (`@nera-static/plugin-utils/frontmatter`).
 *
 * Both mirror `@nera-static/core` (`src/core.js`): its options object and its
 * markdown-it block rule. A difference between the two is a defect here, so
 * a page the validator accepts parses the same way in the build.
 */

/**
 * The `yaml` parse options core reads frontmatter with: unquoted dates
 * become `Date` objects (`timestamp`), `<<` merge keys work, and a repeated
 * key takes the last value. Pass them to `yaml.parse` or `yaml.parseDocument`
 * from your own `yaml` dependency; this package does not depend on `yaml`.
 * Frozen, nested array included, so no caller can change them for another.
 */
export const FRONTMATTER_OPTIONS = Object.freeze({
    schema: 'core',
    customTags: Object.freeze(['timestamp']),
    merge: true,
    uniqueKeys: false,
})

const FENCE = '---'

/**
 * Splits a page file into its frontmatter YAML and its Markdown body, by
 * core's rule: line endings are read as markdown-it reads them (CRLF and a
 * lone CR as LF), the first line must be exactly `---`, and the next line
 * that is exactly `---` closes the block (`----` or `--- ` do not). Without
 * a closing line the rest of the file is YAML and the body is empty; an
 * empty block gives `''`. A leading BOM or indentation means no frontmatter,
 * as in core.
 *
 * @param {string} raw the file's text
 * @returns {{ yamlText: string, body: string } | null} `null` when the file
 *     does not start with a `---` line (or `raw` is not a string)
 */
export function splitFrontmatter(raw) {
    if (typeof raw !== 'string') return null
    const lines = raw.replace(/\r\n?/g, '\n').split('\n')
    if (lines[0] !== FENCE) return null
    const close = lines.indexOf(FENCE, 1)
    if (close === -1) return { yamlText: lines.slice(1).join('\n'), body: '' }
    return {
        yamlText: lines.slice(1, close).join('\n'),
        body: lines.slice(close + 1).join('\n'),
    }
}
