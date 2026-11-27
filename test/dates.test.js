import { describe, it, expect, vi, afterEach } from 'vitest'
import {
    toDate,
    formatW3C,
    PUBLISHED_KEYS,
    UPDATED_KEYS,
    pageDate,
    byDate,
} from '../src/dates.js'

const utc = (...parts) => new Date(Date.UTC(parts[0], parts[1] - 1, ...parts.slice(2)))

describe('toDate', () => {
    it.each([
        ['a date', '2026-10-01', utc(2026, 10, 1)],
        ['a time without offset, as UTC (real bug 6)', '2026-10-01 09:30', utc(2026, 10, 1, 9, 30)],
        ['a T time without offset, as UTC', '2026-10-01T09:30', utc(2026, 10, 1, 9, 30)],
        ['seconds', '2026-10-01T09:30:15', utc(2026, 10, 1, 9, 30, 15)],
        ['a fraction, cut to milliseconds', '2026-10-01T09:30:15.1239Z', utc(2026, 10, 1, 9, 30, 15, 123)],
        ['a short fraction', '2026-10-01T09:30:15.5Z', utc(2026, 10, 1, 9, 30, 15, 500)],
        ['Z', '2026-10-01T09:30:00Z', utc(2026, 10, 1, 9, 30)],
        ['a positive offset', '2026-10-01T09:30:00+02:00', utc(2026, 10, 1, 7, 30)],
        ['a negative offset', '2026-10-01T09:30:00-05:30', utc(2026, 10, 1, 15, 0)],
        ['a space before the offset', '2026-10-01 09:30 +02:00', utc(2026, 10, 1, 7, 30)],
        ['surrounding whitespace', '  2026-10-01  ', utc(2026, 10, 1)],
        ['a leap day', '2028-02-29', utc(2028, 2, 29)],
        ['an offset that crosses the day', '2026-10-01T00:30:00+01:00', utc(2026, 9, 30, 23, 30)],
    ])('reads %s', (_, input, expected) => {
        expect(toDate(input)).toEqual(expected)
    })

    it.each([
        ['an impossible day (real bug 6)', '2026-02-30'],
        ['a non-leap Feb 29', '2026-02-29'],
        ['month 13', '2026-13-01'],
        ['month 0', '2026-00-10'],
        ['day 0', '2026-10-00'],
        ['hour 24', '2026-10-01T24:00'],
        ['minute 60', '2026-10-01T09:60'],
        ['second 60', '2026-10-01T09:30:60'],
        ['an offset hour 24', '2026-10-01T09:30:00+24:00'],
        ['an offset minute 60', '2026-10-01T09:30:00+02:60'],
        ['a German date', '1.10.2026'],
        ['a month only', '2026-10'],
        ['an hour without minutes', '2026-10-01T09'],
        ['an offset without colon', '2026-10-01T09:30:00+0200'],
        ['a lowercase z', '2026-10-01T09:30:00z'],
        ['text', 'yesterday'],
        ['an empty string', ''],
    ])('refuses %s', (_, input) => {
        expect(toDate(input)).toBeNull()
    })

    it.each([
        ['a number', 1790899200000],
        ['null', null],
        ['undefined', undefined],
        ['an object', { date: '2026-10-01' }],
        ['an invalid Date', new Date('nope')],
    ])('refuses %s', (_, input) => {
        expect(toDate(input)).toBeNull()
    })

    it('returns a valid Date as it is', () => {
        const date = utc(2026, 10, 1, 9, 30)
        expect(toDate(date)).toBe(date)
    })

    it('gives a YAML Date and a string of the same instant equal results', () => {
        expect(toDate(utc(2026, 10, 1))).toEqual(toDate('2026-10-01'))
        expect(toDate(utc(2026, 10, 1, 9, 30))).toEqual(toDate('2026-10-01 09:30'))
    })
})

describe('time zone independence', () => {
    const original = process.env.TZ
    afterEach(() => {
        if (original === undefined) delete process.env.TZ
        else process.env.TZ = original
    })

    const items = [
        { href: '/b.html', date: '2026-10-01 23:30' },
        { href: '/a.html', date: '2026-10-02 00:15' },
        { href: '/c.html', date: utc(2026, 10, 1, 12) },
        { href: '/d.html', date: '2026-10-01' },
    ]

    const run = () => ({
        parsed: toDate('2026-10-01 09:30').getTime(),
        formatted: formatW3C('2026-10-01 09:30'),
        order: [...items].sort(byDate((item) => item.date)).map((item) => item.href),
    })

    it('parses, formats and sorts the same in Los Angeles and Tokyo', () => {
        process.env.TZ = 'America/Los_Angeles'
        const losAngeles = run()
        process.env.TZ = 'Asia/Tokyo'
        const tokyo = run()
        expect(losAngeles).toEqual(tokyo)
        // And both equal what UTC-built dates give, whether or not the TZ
        // change reached this worker.
        expect(tokyo).toEqual({
            parsed: Date.UTC(2026, 9, 1, 9, 30),
            formatted: '2026-10-01T09:30:00Z',
            order: ['/d.html', '/c.html', '/b.html', '/a.html'],
        })
    })
})

describe('formatW3C', () => {
    it.each([
        ['UTC midnight as a day', utc(2026, 10, 1), '2026-10-01'],
        ['a date string as a day', '2026-10-01', '2026-10-01'],
        ['a time without milliseconds', utc(2026, 10, 1, 9, 30, 15, 250), '2026-10-01T09:30:15Z'],
        ['an offset in UTC', '2026-10-01T09:30:00+02:00', '2026-10-01T07:30:00Z'],
        ['an offset-less time as UTC', '2026-10-01 09:30', '2026-10-01T09:30:00Z'],
        ['an offset that lands on UTC midnight as a day', '2026-10-01T02:00:00+02:00', '2026-10-01'],
    ])('writes %s', (_, input, expected) => {
        expect(formatW3C(input)).toBe(expected)
    })

    it.each([
        ['an impossible day', '2026-02-30'],
        ['an invalid Date', new Date('nope')],
        ['null', null],
    ])('returns null for %s', (_, input) => {
        expect(formatW3C(input)).toBeNull()
    })
})

describe('key lists', () => {
    it('are the decided lists, without createdAt', () => {
        expect(PUBLISHED_KEYS).toEqual(['date', 'datePublished', 'published'])
        expect(UPDATED_KEYS).toEqual(['updated', 'updatedAt', 'lastmod', 'dateModified'])
        expect(PUBLISHED_KEYS).not.toContain('createdAt')
        expect(UPDATED_KEYS).not.toContain('createdAt')
    })

    it('are frozen', () => {
        expect(Object.isFrozen(PUBLISHED_KEYS)).toBe(true)
        expect(Object.isFrozen(UPDATED_KEYS)).toBe(true)
    })
})

describe('pageDate', () => {
    it.each(PUBLISHED_KEYS.map((key) => [key]))('reads the published date from %s', (key) => {
        expect(pageDate({ [key]: '2026-10-01' }, 'published', { warn: vi.fn() })).toEqual(utc(2026, 10, 1))
    })

    it.each(UPDATED_KEYS.map((key) => [key]))('reads the updated date from %s', (key) => {
        expect(pageDate({ [key]: '2026-10-01' }, 'updated', { warn: vi.fn() })).toEqual(utc(2026, 10, 1))
    })

    it('takes the first key in list order', () => {
        const meta = { published: '2026-01-01', datePublished: '2026-02-01', date: '2026-03-01' }
        expect(pageDate(meta, 'published')).toEqual(utc(2026, 3, 1))
        const updated = { dateModified: '2026-01-01', lastmod: '2026-02-01', updatedAt: '2026-03-01' }
        expect(pageDate(updated, 'updated')).toEqual(utc(2026, 3, 1))
    })

    it('skips an invalid earlier key, takes a valid later one and warns once with href, key and value', () => {
        const warn = vi.fn()
        const meta = { href: '/post.html', date: '2026-02-30', datePublished: '2026-10-01' }
        expect(pageDate(meta, 'published', { warn })).toEqual(utc(2026, 10, 1))
        expect(warn).toHaveBeenCalledTimes(1)
        expect(warn).toHaveBeenCalledWith(
            '/post.html: ignoring date "2026-02-30", expected a date like 2026-10-01 or 2026-10-01T09:30:00Z'
        )
    })

    it('warns once per invalid value and returns null when none is valid', () => {
        const warn = vi.fn()
        const meta = { href: '/post.html', updated: 'soon', updatedAt: 7, lastmod: new Date('nope') }
        expect(pageDate(meta, 'updated', { warn })).toBeNull()
        expect(warn.mock.calls.map(([message]) => message)).toEqual([
            '/post.html: ignoring updated "soon", expected a date like 2026-10-01 or 2026-10-01T09:30:00Z',
            '/post.html: ignoring updatedAt 7, expected a date like 2026-10-01 or 2026-10-01T09:30:00Z',
            '/post.html: ignoring lastmod an invalid date, expected a date like 2026-10-01 or 2026-10-01T09:30:00Z',
        ])
    })

    it('does not read keys after the first valid one', () => {
        const warn = vi.fn()
        expect(pageDate({ date: '2026-10-01', published: 'nope' }, 'published', { warn })).toEqual(utc(2026, 10, 1))
        expect(warn).not.toHaveBeenCalled()
    })

    it('skips absent, null and blank values silently', () => {
        const warn = vi.fn()
        const meta = { date: null, datePublished: '  ', published: '2026-10-01' }
        expect(pageDate(meta, 'published', { warn })).toEqual(utc(2026, 10, 1))
        expect(pageDate({}, 'published', { warn })).toBeNull()
        expect(pageDate(undefined, 'updated', { warn })).toBeNull()
        expect(warn).not.toHaveBeenCalled()
    })

    it('never reads createdAt', () => {
        const warn = vi.fn()
        const read = vi.fn(() => utc(2026, 10, 1))
        const meta = Object.defineProperty({}, 'createdAt', { get: read, enumerable: true })
        expect(pageDate(meta, 'published', { warn })).toBeNull()
        expect(pageDate(meta, 'updated', { warn })).toBeNull()
        expect(read).not.toHaveBeenCalled()
    })

    it('gives a YAML Date and a string of the same instant equal results', () => {
        expect(pageDate({ date: utc(2026, 10, 1) }, 'published'))
            .toEqual(pageDate({ date: '2026-10-01' }, 'published'))
    })

    it('names a page without href in the warning', () => {
        const warn = vi.fn()
        pageDate({ date: 'nope' }, 'published', { warn })
        expect(warn.mock.calls[0][0]).toMatch(/^a page without href: ignoring date "nope"/)
    })

    it('warns through console.warn by default', () => {
        const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
        try {
            pageDate({ href: '/x.html', date: 'nope' }, 'published')
            expect(spy).toHaveBeenCalledTimes(1)
        } finally {
            spy.mockRestore()
        }
    })

    it.each([['created'], [undefined], ['toString'], ['constructor']])('throws a TypeError for kind %s', (kind) => {
        expect(() => pageDate({}, kind)).toThrow(TypeError)
        expect(() => pageDate({}, kind)).toThrow(/kind must be 'published' or 'updated'/)
    })
})

describe('byDate', () => {
    const items = [
        { href: '/none.html' },
        { href: '/new.html', date: '2026-10-03' },
        { href: '/bad.html', date: '2026-02-30' },
        { href: '/old.html', date: utc(2026, 10, 1) },
        { href: '/mid.html', date: '2026-10-02 09:30' },
    ]
    const get = (item) => item.date
    const hrefs = (list) => list.map((item) => item.href)

    it('sorts oldest first, unusable dates last', () => {
        const sorted = [...items].sort(byDate(get))
        expect(hrefs(sorted).slice(0, 3)).toEqual(['/old.html', '/mid.html', '/new.html'])
        expect(hrefs(sorted).slice(3).sort()).toEqual(['/bad.html', '/none.html'])
    })

    it('sorts newest first with descending, unusable dates still last', () => {
        const sorted = [...items].sort(byDate(get, { descending: true }))
        expect(hrefs(sorted).slice(0, 3)).toEqual(['/new.html', '/mid.html', '/old.html'])
        expect(hrefs(sorted).slice(3).sort()).toEqual(['/bad.html', '/none.html'])
    })

    it('compares equal dates and two unusable dates as 0', () => {
        const compare = byDate(get)
        expect(compare({ date: '2026-10-01' }, { date: utc(2026, 10, 1) })).toBe(0)
        expect(compare({}, { date: 'nope' })).toBe(0)
        expect(byDate(get, { descending: true })({}, {})).toBe(0)
    })

    it('puts an unusable date after a usable one from either side', () => {
        const compare = byDate(get, { descending: true })
        expect(compare({}, { date: '2026-10-01' })).toBeGreaterThan(0)
        expect(compare({ date: '2026-10-01' }, {})).toBeLessThan(0)
    })

    it('throws a TypeError without a getter', () => {
        expect(() => byDate()).toThrow(TypeError)
        expect(() => byDate('date')).toThrow(/get must be a function/)
    })
})
