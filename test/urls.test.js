import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
    resolveOrigin,
    encodePath,
    joinUrl,
    siteUrl,
    normalizeBasePath,
    withBasePath,
    stripBasePath,
    hasScheme,
    isInside,
    srcsetUrls,
    mapSrcset,
} from '../src/urls.js'

describe('resolveOrigin', () => {
    let cwd

    beforeEach(() => {
        cwd = mkdtempSync(path.join(tmpdir(), 'plugin-utils-urls-'))
    })

    afterEach(() => {
        rmSync(cwd, { recursive: true, force: true })
    })

    const write = (relative, content) => {
        const file = path.join(cwd, relative)
        mkdirSync(path.dirname(file), { recursive: true })
        writeFileSync(file, content)
    }

    it('takes app.origin, trimmed of whitespace and trailing slashes', () => {
        expect(resolveOrigin({ cwd, app: { origin: ' https://ex.com/ ' } })).toBe('https://ex.com')
    })

    it('drops every trailing slash', () => {
        expect(resolveOrigin({ cwd, app: { origin: 'https://ex.com///' } })).toBe('https://ex.com')
    })

    it('prefers app.origin over canonical-links', () => {
        write('config/canonical-links.yaml', 'app_origin: https://other.com\n')
        expect(resolveOrigin({ cwd, app: { origin: 'https://ex.com' } })).toBe('https://ex.com')
    })

    it.each([
        ['missing', undefined],
        ['blank', '   '],
        ['a non-string', 42],
    ])('falls back to canonical-links app_origin when app.origin is %s', (_, origin) => {
        write('config/canonical-links.yaml', 'app_origin: " https://ex.com/ "\n')
        expect(resolveOrigin({ cwd, app: { origin } })).toBe('https://ex.com')
    })

    it('honours app.folders.config for the canonical-links file', () => {
        write('config/canonical-links.yaml', 'app_origin: https://wrong.com\n')
        write('settings/canonical-links.yaml', 'app_origin: https://right.com\n')
        const app = { folders: { config: './settings' } }
        expect(resolveOrigin({ cwd, app })).toBe('https://right.com')
    })

    it('works without an app', () => {
        write('config/canonical-links.yaml', 'app_origin: https://ex.com\n')
        expect(resolveOrigin({ cwd })).toBe('https://ex.com')
    })

    it.each([
        ['no file', null],
        ['a file without app_origin', 'other: 1\n'],
        ['a blank app_origin', 'app_origin: ""\n'],
        ['a list instead of a mapping', '- https://ex.com\n'],
    ])('gives \'\' for %s', (_, content) => {
        if (content !== null) write('config/canonical-links.yaml', content)
        expect(resolveOrigin({ cwd, app: {} })).toBe('')
    })
})

describe('encodePath', () => {
    it.each([
        ['spaces and non-ASCII', '/über uns.html', '/%C3%BCber%20uns.html'],
        ['an already-encoded escape, left alone', '/a%20b.html', '/a%20b.html'],
        ['a lower-case escape, left alone', '/a%c3%bc.html', '/a%c3%bc.html'],
        ['a bare percent', '/100%.html', '/100%25.html'],
        ['a percent with one hex digit', '/a%2.html', '/a%252.html'],
        ['a percent with non-hex digits', '/a%zz.html', '/a%25zz.html'],
        ['URL delimiters, left alone', '/a/b.html?x=1&y=2#top', '/a/b.html?x=1&y=2#top'],
        ['angle brackets', '/<a>.html', '/%3Ca%3E.html'],
        ['a lone surrogate, as U+FFFD', '/a\uD800.html', '/a%EF%BF%BD.html'],
        ['null', null, ''],
        ['undefined', undefined, ''],
        ['a number', 5, '5'],
    ])('encodes %s', (_, input, expected) => {
        expect(encodePath(input)).toBe(expected)
    })

    it('does not encode twice', () => {
        const once = encodePath('/über uns.html')
        expect(encodePath(once)).toBe(once)
    })
})

describe('joinUrl', () => {
    it('encodes base path and href under the origin (real bug 3)', () => {
        expect(joinUrl('https://ex.com', '/sub', '/über uns.html'))
            .toBe('https://ex.com/sub/%C3%BCber%20uns.html')
    })

    it.each([
        ['an empty base path', ''],
        ['no base path', undefined],
        ['a null base path', null],
    ])('joins with %s', (_, basePath) => {
        expect(joinUrl('https://ex.com', basePath, '/a.html')).toBe('https://ex.com/a.html')
    })

    it('keeps /index.html verbatim', () => {
        expect(joinUrl('https://ex.com', '', '/index.html')).toBe('https://ex.com/index.html')
    })

    it('uses the origin as given', () => {
        expect(joinUrl('https://ex.com/ ', '', '/a.html')).toBe('https://ex.com/ /a.html')
    })
})

describe('siteUrl', () => {
    it.each([
        ['an empty base path', '', 'https://ex.com'],
        ['a base path', '/sub', 'https://ex.com/sub'],
        ['a base path with a trailing slash', '/sub/', 'https://ex.com/sub'],
        ['a base path that needs encoding', '/my site', 'https://ex.com/my%20site'],
        ['no base path', undefined, 'https://ex.com'],
        ['a non-string base path', 5, 'https://ex.com'],
    ])('joins %s', (_, basePath, expected) => {
        expect(siteUrl('https://ex.com', basePath)).toBe(expected)
    })

    it('gives the prefix of every joinUrl', () => {
        expect(joinUrl('https://ex.com', '/my site', '/a.html'))
            .toBe(`${siteUrl('https://ex.com', '/my site')}/a.html`)
    })
})

describe('normalizeBasePath', () => {
    // The cases core's comment on `normalizeBasePath` (core.js) names.
    it.each([
        ['absent', undefined, ''],
        ['null', null, ''],
        ['a non-string', 5, ''],
        ['empty', '', ''],
        ['blank', '   ', ''],
        ['a lone slash', '/', ''],
        ['a slash with whitespace', ' / ', ''],
        ['a bare name', 'nera-website', '/nera-website'],
        ['a name with a trailing slash', 'x/', '/x'],
        ['a nested path with slashes', '/foo/bar/', '/foo/bar'],
        ['several trailing slashes', '/foo//', '/foo'],
        ['surrounding whitespace', '  /foo  ', '/foo'],
        ['a leading double slash, kept like core', '//cdn', '//cdn'],
    ])('normalises %s', (_, input, expected) => {
        expect(normalizeBasePath(input)).toBe(expected)
    })

    it('is idempotent', () => {
        expect(normalizeBasePath(normalizeBasePath('foo/bar/'))).toBe('/foo/bar')
    })
})

describe('withBasePath', () => {
    it.each([
        ['a root-absolute URL', '/a.html', '/sub/a.html'],
        ['the root', '/', '/sub/'],
        ['a URL that only starts like the base path', '/subway.html', '/sub/subway.html'],
        ['a protocol-relative URL, unchanged', '//cdn.ex.com/a.js', '//cdn.ex.com/a.js'],
        ['a relative URL, unchanged', 'a.html', 'a.html'],
        ['a URL with a scheme, unchanged', 'https://ex.com/a', 'https://ex.com/a'],
        ['a fragment, unchanged', '#top', '#top'],
        ['the base path itself, unchanged', '/sub', '/sub'],
        ['an already-prefixed URL, unchanged', '/sub/a.html', '/sub/a.html'],
    ])('prefixes %s', (_, url, expected) => {
        expect(withBasePath(url, '/sub')).toBe(expected)
    })

    it.each([null, undefined, 5])('returns the non-string %s unchanged', (url) => {
        expect(withBasePath(url, '/sub')).toBe(url)
    })

    it('changes nothing for an empty base path', () => {
        expect(withBasePath('/a.html', '')).toBe('/a.html')
    })

    it('is idempotent', () => {
        expect(withBasePath(withBasePath('/a.html', '/sub'), '/sub')).toBe('/sub/a.html')
    })
})

describe('stripBasePath', () => {
    it.each([
        ['a prefixed URL', '/sub/a.html', '/a.html'],
        ['the base path itself, as the root', '/sub', '/'],
        ['the base path with a slash', '/sub/', '/'],
        ['a URL that only starts like the base path, unchanged', '/subway.html', '/subway.html'],
        ['an unprefixed URL, unchanged', '/a.html', '/a.html'],
        ['a relative URL, unchanged', 'sub/a.html', 'sub/a.html'],
    ])('strips %s', (_, url, expected) => {
        expect(stripBasePath(url, '/sub')).toBe(expected)
    })

    it('changes nothing for an empty base path', () => {
        expect(stripBasePath('/sub/a.html', '')).toBe('/sub/a.html')
    })

    it.each([null, undefined, 5])('returns the non-string %s unchanged', (url) => {
        expect(stripBasePath(url, '/sub')).toBe(url)
    })

    it('undoes withBasePath', () => {
        expect(stripBasePath(withBasePath('/a/b.html', '/sub'), '/sub')).toBe('/a/b.html')
    })
})

describe('hasScheme', () => {
    it.each([
        ['https', 'https://ex.com', true],
        ['upper case', 'HTTPS://ex.com', true],
        ['mailto', 'mailto:a@ex.com', true],
        ['tel', 'tel:+49', true],
        ['data', 'data:image/png;base64,AAAA', true],
        ['a scheme with + . -', 'git+ssh://host', true],
        ['protocol-relative', '//cdn.ex.com', false],
        ['root-absolute', '/a.html', false],
        ['relative', 'a.html', false],
        ['a digit first', '1http://x', false],
        ['a colon later in the path', '/a:b', false],
        ['empty', '', false],
        ['a non-string', 5, false],
        ['null', null, false],
    ])('%s', (_, url, expected) => {
        expect(hasScheme(url)).toBe(expected)
    })
})

describe('isInside', () => {
    const root = path.resolve('/site/assets')

    it.each([
        ['a child', path.join(root, 'a.png'), true],
        ['a nested child', path.join(root, 'img', 'a.png'), true],
        ['a folder named ..foo', path.join(root, '..foo', 'a.png'), true],
        ['a file named ..', path.join(root, '..a'), true],
        ['the parent', path.dirname(root), false],
        ['a sibling', path.resolve('/site/pages/a.md'), false],
        ['a sibling with the root as prefix', path.resolve('/site/assets-old/a.png'), false],
        ['an escape through ..', path.join(root, '..', 'pages'), false],
    ])('%s', (_, target, expected) => {
        expect(isInside(root, target)).toBe(expected)
    })

    it('counts the root itself by default', () => {
        expect(isInside(root, root)).toBe(true)
        expect(isInside(root, `${root}${path.sep}`)).toBe(true)
    })

    it('does not count the root itself with self: false', () => {
        expect(isInside(root, root, { self: false })).toBe(false)
        expect(isInside(root, path.join(root, 'a.png'), { self: false })).toBe(true)
        expect(isInside(root, path.dirname(root), { self: false })).toBe(false)
    })

    it('resolves relative paths against the working directory', () => {
        expect(isInside('assets', path.resolve('assets', 'a.png'))).toBe(true)
    })
})

describe('srcsetUrls', () => {
    it.each([
        ['one URL', '/a.jpg', ['/a.jpg']],
        ['candidates with descriptors', '/a.jpg 1x, /b.jpg 2x', ['/a.jpg', '/b.jpg']],
        ['width descriptors without spaces after commas', '/a.jpg 480w,/b.jpg 800w', ['/a.jpg', '/b.jpg']],
        ['a comma in the query', '/a.jpg?a=1,2 1x, /b.jpg 2x', ['/a.jpg?a=1,2', '/b.jpg']],
        ['a data URI', 'data:image/png;base64,AAAA 1x, /b.jpg 2x', ['data:image/png;base64,AAAA', '/b.jpg']],
        ['a URL ended by commas', '/a.jpg,, /b.jpg', ['/a.jpg', '/b.jpg']],
        ['surrounding whitespace and newlines', '\n  /a.jpg 1x,\n  /b.jpg 2x\n', ['/a.jpg', '/b.jpg']],
        ['a comma inside parenthesised descriptors', '/a.jpg (x, y), /b.jpg', ['/a.jpg', '/b.jpg']],
        ['parentheses that do not nest, as the standard reads them', '/a.jpg (a(b)c, /b.jpg', ['/a.jpg', '/b.jpg']],
        ['empty candidates', ', , /a.jpg', ['/a.jpg']],
        ['an empty value', '', []],
        ['a blank value', '   ', []],
    ])('reads %s', (_, value, expected) => {
        expect(srcsetUrls(value)).toEqual(expected)
    })

    it.each([null, undefined, 5])('gives [] for %s', (value) => {
        expect(srcsetUrls(value)).toEqual([])
    })
})

describe('mapSrcset', () => {
    it('replaces each URL and keeps descriptors, commas and spacing', () => {
        expect(mapSrcset('/a.jpg 1x,/b.jpg  2x', (url) => `/sub${url}`))
            .toBe('/sub/a.jpg 1x,/sub/b.jpg  2x')
    })

    it('keeps a comma in the query and a data URI whole', () => {
        const value = '/a.jpg?a=1,2 1x, data:image/png;base64,AAAA 2x'
        expect(mapSrcset(value, (url) => withBasePath(url, '/sub')))
            .toBe('/sub/a.jpg?a=1,2 1x, data:image/png;base64,AAAA 2x')
    })

    it('gives the value back for an identity function', () => {
        const value = '\n  /a.jpg 1x,,\n  /b.jpg (x, y) 2x , '
        expect(mapSrcset(value, (url) => url)).toBe(value)
    })

    it('passes the candidate index and stringifies the result', () => {
        expect(mapSrcset('/a.jpg 1x, /b.jpg 2x', (url, index) => index)).toBe('0 1x, 1 2x')
    })

    it.each([null, undefined, 5])('returns the non-string %s unchanged', (value) => {
        expect(mapSrcset(value, () => 'x')).toBe(value)
    })
})
