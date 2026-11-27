import { describe, it, expect } from 'vitest'
import { escapeHtml, escapeXml, escapeRegExp } from '../src/html.js'

describe('escapeHtml', () => {
    it('escapes the five HTML special characters, the apostrophe as &#39;', () => {
        expect(escapeHtml('<a href="x" title=\'y\'>Tom & Jerry</a>'))
            .toBe('&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;Tom &amp; Jerry&lt;/a&gt;')
    })

    it('escapes once: an entity in the input is text and gets escaped again', () => {
        // code-blocks escapes raw source code, where `&amp;` is literal text.
        expect(escapeHtml('&amp; &lt;')).toBe('&amp;amp; &amp;lt;')
    })

    it('is safe in a single-quoted attribute value', () => {
        expect(escapeHtml('it\'s')).not.toContain('\'')
    })

    it('leaves other text untouched, including non-ASCII and control characters', () => {
        expect(escapeHtml('Grüße — 日本 \u0001')).toBe('Grüße — 日本 \u0001')
    })

    it('stringifies non-strings and gives an empty string for null and undefined', () => {
        expect(escapeHtml(42)).toBe('42')
        expect(escapeHtml(true)).toBe('true')
        expect(escapeHtml(null)).toBe('')
        expect(escapeHtml(undefined)).toBe('')
    })
})

describe('escapeXml', () => {
    it('escapes the five XML special characters, the apostrophe as &apos;', () => {
        expect(escapeXml('<t a="1" b=\'2\'>R&D</t>'))
            .toBe('&lt;t a=&quot;1&quot; b=&apos;2&apos;&gt;R&amp;D&lt;/t&gt;')
    })

    it('drops the C0 controls XML 1.0 forbids and keeps tab, LF and CR', () => {
        expect(escapeXml('a\u0000b\u0008c\u000Bd\u000Ce\u001Ff')).toBe('abcdef')
        expect(escapeXml('a\tb\nc\rd')).toBe('a\tb\nc\rd')
    })

    it('drops U+FFFE and U+FFFF', () => {
        expect(escapeXml('a￾b￿c')).toBe('abc')
    })

    it('drops lone surrogates and keeps surrogate pairs', () => {
        expect(escapeXml('a\uD83Db')).toBe('ab')
        expect(escapeXml('a\uDE00b')).toBe('ab')
        expect(escapeXml('x😀y')).toBe('x😀y')
    })

    it('stringifies non-strings and gives an empty string for null and undefined', () => {
        expect(escapeXml(3.5)).toBe('3.5')
        expect(escapeXml(null)).toBe('')
        expect(escapeXml(undefined)).toBe('')
    })
})

describe('escapeRegExp', () => {
    it('escapes every regular-expression special character, * included', () => {
        const special = '.*+?^${}()|[]\\'
        expect(escapeRegExp(special)).toBe('\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\')
        expect(new RegExp(`^${escapeRegExp(special)}$`).test(special)).toBe(true)
    })

    it('makes a pattern match its text literally', () => {
        const pattern = new RegExp(`^${escapeRegExp('a.b*')}$`)
        expect(pattern.test('a.b*')).toBe(true)
        expect(pattern.test('axbbb')).toBe(false)
    })

    it('leaves characters without a special meaning untouched', () => {
        expect(escapeRegExp('page-data: key_1/ä')).toBe('page-data: key_1/ä')
    })

    it('stringifies non-strings and gives an empty string for null and undefined', () => {
        expect(escapeRegExp(1.5)).toBe('1\\.5')
        expect(escapeRegExp(null)).toBe('')
        expect(escapeRegExp(undefined)).toBe('')
    })
})
