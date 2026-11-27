import { describe, it, expect } from 'vitest'
import { parse, parseDocument } from 'yaml'
import { FRONTMATTER_OPTIONS, splitFrontmatter } from '../src/frontmatter.js'

// What core does with a page's frontmatter: split by its block rule, parse
// with its options, an empty block giving `{}`.
const parseMeta = (raw) => {
    const split = splitFrontmatter(raw)
    return split ? parse(split.yamlText, FRONTMATTER_OPTIONS) || {} : {}
}

describe('FRONTMATTER_OPTIONS', () => {
    it('are core\'s options', () => {
        expect(FRONTMATTER_OPTIONS).toEqual({
            schema: 'core',
            customTags: ['timestamp'],
            merge: true,
            uniqueKeys: false,
        })
    })

    it('are frozen, nested array included', () => {
        expect(Object.isFrozen(FRONTMATTER_OPTIONS)).toBe(true)
        expect(Object.isFrozen(FRONTMATTER_OPTIONS.customTags)).toBe(true)
        expect(() => {
            FRONTMATTER_OPTIONS.merge = false
        }).toThrow(TypeError)
        expect(() => FRONTMATTER_OPTIONS.customTags.push('binary')).toThrow(TypeError)
    })

    it('read an unquoted date as a Date and a quoted one as a string', () => {
        const meta = parseMeta('---\ndate: 2026-03-01\nquoted: "2026-03-01"\n---\n')
        expect(meta.date).toEqual(new Date(Date.UTC(2026, 2, 1)))
        expect(meta.quoted).toBe('2026-03-01')
    })

    it('let a repeated key take the last value', () => {
        expect(parseMeta('---\nlayout: a\nlayout: b\n---\n')).toEqual({ layout: 'b' })
    })

    it('let a `<<` merge key supply `layout`', () => {
        const meta = parseMeta('---\nbase: &base\n  layout: page\n<<: *base\n---\n')
        expect(meta.layout).toBe('page')
    })

    it('stay unchanged after parse and parseDocument use them', () => {
        parse('a: 1', FRONTMATTER_OPTIONS)
        parseDocument('a: 1', FRONTMATTER_OPTIONS)
        expect(FRONTMATTER_OPTIONS.customTags).toEqual(['timestamp'])
    })
})

describe('splitFrontmatter', () => {
    it('splits the block from the body', () => {
        expect(splitFrontmatter('---\nlayout: page\ntitle: A\n---\n# Hi\n')).toEqual({
            yamlText: 'layout: page\ntitle: A',
            body: '# Hi\n',
        })
    })

    it('reads CRLF and a lone CR as LF, as markdown-it does', () => {
        const expected = { yamlText: 'layout: page', body: '# Hi\n' }
        expect(splitFrontmatter('---\r\nlayout: page\r\n---\r\n# Hi\r\n')).toEqual(expected)
        expect(splitFrontmatter('---\rlayout: page\r---\r# Hi\r')).toEqual(expected)
    })

    it('gives an empty block as an empty string', () => {
        expect(splitFrontmatter('---\n---\nBody\n')).toEqual({ yamlText: '', body: 'Body\n' })
        expect(parseMeta('---\n---\nBody\n')).toEqual({})
    })

    it('reads the rest of the file as YAML when the block is never closed', () => {
        expect(splitFrontmatter('---\nlayout: page\ntitle: x\n')).toEqual({
            yamlText: 'layout: page\ntitle: x\n',
            body: '',
        })
        expect(splitFrontmatter('---')).toEqual({ yamlText: '', body: '' })
    })

    it('closes only on a line that is exactly `---`', () => {
        for (const line of ['----', '--- ', ' ---']) {
            const split = splitFrontmatter(`---\nlayout: page\n${line}\ntitle: t\n---\nBody\n`)
            expect(split).toEqual({ yamlText: `layout: page\n${line}\ntitle: t`, body: 'Body\n' })
        }
    })

    it('leaves a `----` line in the YAML, where it fails to parse as in core', () => {
        const split = splitFrontmatter('---\nlayout: page\n----\ntitle: t\n---\nBody\n')
        expect(() => parse(split.yamlText, FRONTMATTER_OPTIONS)).toThrow()
    })

    it('keeps blank lines inside the block and a later `---` rule in the body', () => {
        expect(splitFrontmatter('---\nlayout: page\n\ntitle: t\n---\nA\n\n---\n\nB\n')).toEqual({
            yamlText: 'layout: page\n\ntitle: t',
            body: 'A\n\n---\n\nB\n',
        })
    })

    it('gives an empty body when the closing line ends the file', () => {
        expect(splitFrontmatter('---\nlayout: page\n---')).toEqual({ yamlText: 'layout: page', body: '' })
    })

    it.each([
        ['no fence', '# Title\n\nText\n'],
        ['a BOM before the fence', '\uFEFF---\nlayout: page\n---\n'],
        ['an indented fence', ' ---\nlayout: page\n---\n'],
        ['a fence with trailing space', '--- \nlayout: page\n---\n'],
        ['four dashes', '----\nlayout: page\n---\n'],
        ['a fence after a blank line', '\n---\nlayout: page\n---\n'],
        ['an empty file', ''],
    ])('returns null for %s', (_, raw) => {
        expect(splitFrontmatter(raw)).toBeNull()
    })

    it.each([
        ['undefined', undefined],
        ['null', null],
        ['a number', 7],
    ])('returns null for %s', (_, raw) => {
        expect(splitFrontmatter(raw)).toBeNull()
    })
})
