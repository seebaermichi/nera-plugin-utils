import { describe, it, expect } from 'vitest'
import { writeFileSync, unlinkSync } from 'fs'
import { getConfig } from '../index.js'

const tmpFile = './.tmp-config.yaml'

describe('getConfig', () => {
    it('returns parsed object when file exists', () => {
        writeFileSync(tmpFile, 'title: Hello\nitems:\n  - one\n  - two')
        const config = getConfig(tmpFile)

        expect(config.title).toBe('Hello')
        expect(config.items).toEqual(['one', 'two'])

        unlinkSync(tmpFile)
    })

    it('returns empty object when file does not exist', () => {
        const config = getConfig('./nonexistent.yaml')
        expect(config).toEqual({})
    })

    // Plugins ship their config with every key commented out, so a file with
    // nothing but comments is the common case, not an edge case. js-yaml 5
    // throws on a contentless document, so this has to be handled before the
    // parser sees it.
    it.each([
        ['empty', ''],
        ['a single newline', '\n'],
        ['only whitespace', '   \n  \n'],
        ['only comments', '# order_property: pagination_order\n'],
        ['comments and blank lines', '\n# one\n\n#   two\n\n'],
    ])('returns empty object when the file is %s', (_label, content) => {
        writeFileSync(tmpFile, content)
        expect(getConfig(tmpFile)).toEqual({})

        unlinkSync(tmpFile)
    })

    it('still throws on genuinely malformed YAML', () => {
        writeFileSync(tmpFile, 'a: [1,\n')
        expect(() => getConfig(tmpFile)).toThrow()

        unlinkSync(tmpFile)
    })
})
