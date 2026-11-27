import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { IGNORE_FILE, isIgnoredAsset, matchesAny, matchesPattern, readIgnoreList } from '../src/glob.js'

describe('matchesPattern', () => {
    it('matches literally, anchored at both ends', () => {
        expect(matchesPattern('/about.html', '/about.html')).toBe(true)
        expect(matchesPattern('/de/about.html', '/about.html')).toBe(false)
        expect(matchesPattern('/about.html.bak', '/about.html')).toBe(false)
    })

    it('lets `*` match any run of characters, `/` and nothing included', () => {
        expect(matchesPattern('/drafts/a.html', '/drafts/*')).toBe(true)
        expect(matchesPattern('/drafts/2026/a.html', '/drafts/*')).toBe(true)
        expect(matchesPattern('/drafts/', '/drafts/*')).toBe(true)
        expect(matchesPattern('/de/drafts/a.html', '*/drafts/*')).toBe(true)
        expect(matchesPattern('/drafts', '/drafts/*')).toBe(false)
    })

    it('treats every other regular-expression character literally', () => {
        expect(matchesPattern('/a.html', '/a.html')).toBe(true)
        expect(matchesPattern('/aXhtml', '/a.html')).toBe(false)
        expect(matchesPattern('/a+b(1)?[x]{2}|$^\\.html', '/a+b(1)?[x]{2}|$^\\.html')).toBe(true)
        expect(matchesPattern('/ab.html', '/a+b.html')).toBe(false)
    })

    it.each([
        ['a non-string href', 7, '*'],
        ['a missing href', undefined, '*'],
        ['a non-string pattern', '/a.html', null],
    ])('never matches %s', (_, href, pattern) => {
        expect(matchesPattern(href, pattern)).toBe(false)
    })
})

describe('matchesAny', () => {
    it('matches when one pattern does', () => {
        expect(matchesAny('/tags/a.html', ['/drafts/*', '/tags/*'])).toBe(true)
        expect(matchesAny('/about.html', ['/drafts/*', '/tags/*'])).toBe(false)
    })

    it('matches nothing without patterns', () => {
        expect(matchesAny('/about.html')).toBe(false)
        expect(matchesAny('/about.html', [])).toBe(false)
        expect(matchesAny('/about.html', null)).toBe(false)
    })
})

describe('readIgnoreList', () => {
    let cwd

    beforeEach(() => {
        cwd = mkdtempSync(path.join(tmpdir(), 'plugin-utils-glob-'))
    })

    afterEach(() => {
        rmSync(cwd, { recursive: true, force: true })
    })

    it('is [] without a .neraignore', () => {
        expect(readIgnoreList(cwd)).toEqual([])
    })

    it('reads one trimmed pattern per line, blank lines dropped', () => {
        writeFileSync(path.join(cwd, IGNORE_FILE), '  drafts \n\nimages/raw\r\n   \nrobots.txt')
        expect(readIgnoreList(cwd)).toEqual(['drafts', 'images/raw', 'robots.txt'])
    })

    it('reads from process.cwd() by default', () => {
        writeFileSync(path.join(cwd, IGNORE_FILE), 'drafts\n')
        const previous = process.cwd()
        process.chdir(cwd)
        try {
            expect(readIgnoreList()).toEqual(['drafts'])
        } finally {
            process.chdir(previous)
        }
    })
})

describe('isIgnoredAsset', () => {
    const root = path.join(path.sep, 'site', 'assets')
    const file = (relative) => path.join(root, ...relative.split('/'))

    it('ignores a file that equals a pattern', () => {
        expect(isIgnoredAsset(['robots.txt'], file('robots.txt'), root)).toBe(true)
        expect(isIgnoredAsset(['css/draft.css'], file('css/draft.css'), root)).toBe(true)
    })

    it('ignores everything under a folder pattern', () => {
        expect(isIgnoredAsset(['images'], file('images/a.png'), root)).toBe(true)
        expect(isIgnoredAsset(['images'], file('images/raw/b.png'), root)).toBe(true)
    })

    it('does not match a prefix that is not a whole segment', () => {
        expect(isIgnoredAsset(['robots'], file('robots.txt'), root)).toBe(false)
        expect(isIgnoredAsset(['images'], file('images-old/a.png'), root)).toBe(false)
    })

    it('knows no wildcards and no trailing-slash form, as core', () => {
        expect(isIgnoredAsset(['*.png'], file('a.png'), root)).toBe(false)
        expect(isIgnoredAsset(['images/'], file('images/a.png'), root)).toBe(false)
    })

    it('ignores nothing with an empty list', () => {
        expect(isIgnoredAsset([], file('a.png'), root)).toBe(false)
    })
})
