import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { load } from 'js-yaml'
import { createConfigReader, getConfig, loadPluginConfig } from '../src/config.js'
import { getConfig as rootGetConfig } from '../index.js'

afterEach(() => {
    vi.restoreAllMocks()
})

describe('getConfig', () => {
    it('is the same function from . and /config', () => {
        expect(rootGetConfig).toBe(getConfig)
    })
})

describe('loadPluginConfig', () => {
    let cwd

    beforeEach(() => {
        cwd = mkdtempSync(path.join(tmpdir(), 'plugin-utils-config-'))
    })

    afterEach(() => {
        rmSync(cwd, { recursive: true, force: true })
    })

    const write = (relative, content) => {
        const file = path.join(cwd, relative)
        mkdirSync(path.dirname(file), { recursive: true })
        writeFileSync(file, content)
    }

    it('reads config/<name>.yaml from cwd', () => {
        write('config/sitemap.yaml', 'output: map.xml\n')
        expect(loadPluginConfig('sitemap', { cwd })).toEqual({ output: 'map.xml' })
    })

    it('returns {} when the file is missing', () => {
        expect(loadPluginConfig('sitemap', { cwd })).toEqual({})
    })

    it('honours app.folders.config', () => {
        write('config/sitemap.yaml', 'output: wrong.xml\n')
        write('settings/sitemap.yaml', 'output: right.xml\n')
        const app = { folders: { config: './settings' } }
        expect(loadPluginConfig('sitemap', { cwd, app })).toEqual({ output: 'right.xml' })
    })

    it.each([
        ['an empty string', ''],
        ['blank text', '   '],
        ['a non-string', 5],
    ])('falls back to config/ when folders.config is %s', (_, config) => {
        write('config/sitemap.yaml', 'output: map.xml\n')
        const app = { folders: { config } }
        expect(loadPluginConfig('sitemap', { cwd, app })).toEqual({ output: 'map.xml' })
    })

    it('returns the raw document without checking it', () => {
        write('config/sitemap.yaml', '- a\n- b\n')
        expect(loadPluginConfig('sitemap', { cwd })).toEqual(['a', 'b'])
    })

    it('uses process.cwd() by default', () => {
        const spy = vi.spyOn(process, 'cwd').mockReturnValue(cwd)
        write('config/feed.yaml', 'limit: 5\n')
        expect(loadPluginConfig('feed')).toEqual({ limit: 5 })
        expect(spy).toHaveBeenCalled()
    })
})

describe('createConfigReader', () => {
    const FILE = 'config/sitemap.yaml'

    const make = (overrides = {}) => {
        const warn = vi.fn()
        const reader = createConfigReader({
            file: FILE,
            defaults: { output: 'sitemap.xml', exclude: [], robots: true, title: null },
            readers: {
                output: (value, fallback, r) =>
                    typeof value === 'string' ? value : r.bad('output', value, fallback),
                exclude: (value, fallback, r) =>
                    Array.isArray(value) ? value : r.bad('exclude', value, fallback),
                robots: (value) => value !== false,
                title: (value, fallback, r) =>
                    typeof value === 'string' ? value : r.bad('title', value, fallback),
            },
            warn,
            ...overrides,
        })
        return { reader, warn }
    }

    it('returns the defaults for an empty, missing or null config', () => {
        const { reader, warn } = make()
        const expected = { output: 'sitemap.xml', exclude: [], robots: true, title: null }
        expect(reader.normalize({})).toEqual(expected)
        expect(reader.normalize(undefined)).toEqual(expected)
        expect(reader.normalize(null)).toEqual(expected)
        expect(reader.defaults()).toEqual(expected)
        expect(warn).not.toHaveBeenCalled()
    })

    it('reads known keys through their reader', () => {
        const { reader, warn } = make()
        expect(reader.normalize({ output: 'map.xml', robots: false })).toEqual({
            output: 'map.xml', exclude: [], robots: false, title: null,
        })
        expect(warn).not.toHaveBeenCalled()
    })

    it('passes the value, the current value and the reader itself', () => {
        const read = vi.fn(() => 'x')
        const { reader } = make({ defaults: { a: 'default' }, readers: { a: read } })
        reader.normalize({ a: 1 })
        expect(read).toHaveBeenCalledWith(1, 'default', reader)
    })

    it.each([
        ['a list', ['a']],
        ['a string', 'output: map.xml'],
        ['a number', 3],
        ['a date', new Date('2026-10-01')],
    ])('warns and uses the defaults when the top level is %s', (_, raw) => {
        const { reader, warn } = make()
        expect(reader.normalize(raw)).toEqual(reader.defaults())
        expect(warn).toHaveBeenCalledTimes(1)
        expect(warn).toHaveBeenCalledWith(
            'config/sitemap.yaml: expected a mapping at the top level, using defaults'
        )
    })

    it('warns about an unknown key and leaves it out', () => {
        const { reader, warn } = make()
        expect(reader.normalize({ foo: 1 })).toEqual(reader.defaults())
        expect(warn).toHaveBeenCalledWith('config/sitemap.yaml: ignoring unknown key "foo"')
    })

    // `readers[key]` finds what every object inherits; the copies in the
    // fleet let these keys through (as `Object('x')` in five plugins).
    it.each(['constructor', 'toString', 'hasOwnProperty', 'valueOf', '__defineGetter__'])(
        'treats the inherited name %s as an unknown key',
        (key) => {
            const { reader, warn } = make()
            const raw = load(`${key}: x\noutput: map.xml\n`)
            const config = reader.normalize(raw)
            expect(Object.hasOwn(config, key)).toBe(false)
            expect(config.output).toBe('map.xml')
            expect(warn).toHaveBeenCalledTimes(1)
            expect(warn).toHaveBeenCalledWith(`config/sitemap.yaml: ignoring unknown key "${key}"`)
        }
    )

    it('keeps the default for a null value (an empty key in YAML)', () => {
        const read = vi.fn()
        const { reader, warn } = make({ readers: { output: read } })
        expect(reader.normalize(load('output:\n')).output).toBe('sitemap.xml')
        expect(read).not.toHaveBeenCalled()
        expect(warn).not.toHaveBeenCalled()
    })

    it('keeps the default when a reader returns undefined', () => {
        const { reader } = make({ readers: { output: (value, _, r) => r.ignore('output', 'text') } })
        expect(reader.normalize({ output: 5 }).output).toBe('sitemap.xml')
    })

    it('stores a null a reader returns', () => {
        const { reader } = make({ defaults: { title: 'x' }, readers: { title: () => null } })
        expect(reader.normalize({ title: 'y' }).title).toBeNull()
    })

    it('gives every call its own deep copy of the defaults', () => {
        const { reader } = make({
            defaults: { exclude: [], nested: { list: ['a'] } },
            readers: {},
        })
        const first = reader.normalize({})
        first.exclude.push('changed')
        first.nested.list.push('changed')
        reader.defaults().nested.list.push('changed')
        expect(reader.normalize({})).toEqual({ exclude: [], nested: { list: ['a'] } })
        expect(reader.defaults()).toEqual({ exclude: [], nested: { list: ['a'] } })
    })

    it('does not let a reader change the defaults through the current value', () => {
        const { reader } = make({
            defaults: { exclude: ['a'] },
            readers: { exclude: (value, current) => { current.push(value); return current } },
        })
        reader.normalize({ exclude: 'b' })
        expect(reader.normalize({})).toEqual({ exclude: ['a'] })
    })

    it('does not change the raw config', () => {
        const { reader } = make()
        const raw = { output: 'map.xml', foo: 1 }
        reader.normalize(raw)
        expect(raw).toEqual({ output: 'map.xml', foo: 1 })
    })

    describe('messages', () => {
        it('bad: invalid <key> <value>, using <fallback>, prefixed once', () => {
            const { reader, warn } = make()
            reader.normalize({ output: 5 })
            expect(warn).toHaveBeenCalledTimes(1)
            expect(warn).toHaveBeenCalledWith(
                'config/sitemap.yaml: invalid output 5, using "sitemap.xml"'
            )
        })

        it('bad: returns the fallback', () => {
            const { reader } = make()
            expect(reader.bad('limit', 'x', 20)).toBe(20)
        })

        it.each([
            ['null', null],
            ['undefined', undefined],
        ])('bad: says ignoring it when the fallback is %s', (_, fallback) => {
            const { reader, warn } = make()
            expect(reader.bad('title', 5, fallback)).toBe(fallback)
            expect(warn).toHaveBeenCalledWith('config/sitemap.yaml: invalid title 5, ignoring it')
        })

        it('bad: through normalize, a null default reads as ignoring it', () => {
            const { reader, warn } = make()
            expect(reader.normalize({ title: 5 }).title).toBeNull()
            expect(warn).toHaveBeenCalledWith('config/sitemap.yaml: invalid title 5, ignoring it')
        })

        it('bad: shows false and 0 as values, not as missing', () => {
            const { reader, warn } = make()
            reader.bad('limit', 'x', 0)
            reader.bad('robots', 'x', false)
            expect(warn).toHaveBeenNthCalledWith(1, 'config/sitemap.yaml: invalid limit "x", using 0')
            expect(warn).toHaveBeenNthCalledWith(2, 'config/sitemap.yaml: invalid robots "x", using false')
        })

        it('ignore: ignoring <path>, expected <what>, returning undefined', () => {
            const { reader, warn } = make()
            expect(reader.ignore('labels.de', 'a mapping')).toBeUndefined()
            expect(warn).toHaveBeenCalledWith(
                'config/sitemap.yaml: ignoring labels.de, expected a mapping'
            )
        })

        it('unknown: ignoring unknown key <where><key>', () => {
            const { reader, warn } = make()
            reader.unknown('texts.de.', 'title')
            expect(warn).toHaveBeenCalledWith(
                'config/sitemap.yaml: ignoring unknown key texts.de."title"'
            )
        })

        it('warn: any other message, with the prefix', () => {
            const { reader, warn } = make()
            reader.warn('ignoring exclude entries that are not non-empty strings')
            expect(warn).toHaveBeenCalledWith(
                'config/sitemap.yaml: ignoring exclude entries that are not non-empty strings'
            )
        })

        it('goes to console.warn by default', () => {
            const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
            const reader = createConfigReader({ file: FILE, defaults: {}, readers: {} })
            reader.normalize({ foo: 1 })
            expect(spy).toHaveBeenCalledWith('config/sitemap.yaml: ignoring unknown key "foo"')
        })
    })

    describe('show', () => {
        const { reader } = make()

        it.each([
            ['a string as JSON', 'x', '"x"'],
            ['a number', 5, '5'],
            ['false', false, 'false'],
            ['null', null, 'null'],
            ['a list', ['a', 1], '["a",1]'],
            ['a mapping', { a: 1 }, '{"a":1}'],
            ['a date', new Date('2026-10-01'), 'a date'],
            ['undefined', undefined, 'undefined'],
            ['a bigint', 10n, '10'],
        ])('shows %s', (_, value, expected) => {
            expect(reader.show(value)).toBe(expected)
        })

        it('shows a value JSON cannot write without throwing', () => {
            const loop = {}
            loop.self = loop
            expect(reader.show(loop)).toBe('[object Object]')
        })
    })

    it.each([
        ['defaults is not a plain object', { defaults: [] }, /defaults must be a plain object/],
        ['defaults is missing', { defaults: undefined }, /defaults must be a plain object/],
        ['readers is not a plain object', { readers: null }, /readers must be a plain object/],
    ])('throws a TypeError when %s', (_, overrides, message) => {
        expect(() => make(overrides)).toThrow(TypeError)
        expect(() => make(overrides)).toThrow(message)
    })
})
