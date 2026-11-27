import { describe, it, expect } from 'vitest'
import { byString, byHref } from '../src/sort.js'

describe('byString', () => {
    it('compares by code unit', () => {
        expect(byString('a', 'b')).toBe(-1)
        expect(byString('b', 'a')).toBe(1)
        expect(byString('a', 'a')).toBe(0)
    })

    it('orders mixed case and non-ASCII by code unit, not by locale', () => {
        const words = ['zebra', 'Äpfel', 'apfel', 'Zebra', 'éclair', 'eclair']
        expect([...words].sort(byString)).toEqual(['Zebra', 'apfel', 'eclair', 'zebra', 'Äpfel', 'éclair'])
    })

    it.each([
        ['undefined', undefined],
        ['null', null],
        ['a number', 7],
        ['an object', {}],
    ])('compares %s as an empty string', (_, value) => {
        expect(byString(value, '')).toBe(0)
        expect(byString(value, 'a')).toBe(-1)
        expect(byString('a', value)).toBe(1)
    })
})

describe('byHref', () => {
    it('sorts pages by meta.href', () => {
        const pages = [{ meta: { href: '/b.html' } }, { meta: { href: '/a.html' } }]
        expect(pages.sort(byHref).map((page) => page.meta.href)).toEqual(['/a.html', '/b.html'])
    })

    it('sorts metas by href', () => {
        const metas = [{ href: '/b.html' }, { href: '/a.html' }]
        expect(metas.sort(byHref).map((meta) => meta.href)).toEqual(['/a.html', '/b.html'])
    })

    it('orders mixed-case and non-ASCII hrefs by code unit', () => {
        const metas = ['/über.html', '/Zoo.html', '/apple.html', '/Apple.html'].map((href) => ({ href }))
        expect(metas.sort(byHref).map((meta) => meta.href))
            .toEqual(['/Apple.html', '/Zoo.html', '/apple.html', '/über.html'])
    })

    it('sorts a missing href first', () => {
        const items = [{ meta: { href: '/a.html' } }, { meta: {} }, null]
        expect(items.sort(byHref)[2]).toEqual({ meta: { href: '/a.html' } })
    })

    it('prefers meta.href over a top-level href', () => {
        expect(byHref({ meta: { href: '/a.html' }, href: '/z.html' }, { href: '/b.html' })).toBe(-1)
    })
})
