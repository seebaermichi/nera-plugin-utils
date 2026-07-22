import { describe, it, expect } from 'vitest'
import { slugify } from '../index.js'

describe('slugify', () => {
    it.each([
        ['javascript', 'javascript'],
        ['JavaScript', 'javascript'],
        ['CSS', 'css'],
        ['web development', 'web-development'],
        ['  spaced  out  ', 'spaced-out'],
        ['vue.js', 'vue-js'],
        ['C++', 'c'],
        ['Übergrößen', 'ubergrossen'],
        ['Café', 'cafe'],
        ['---', ''],
    ])('slugifies %o to %o — inherited from plugin-tags', (input, expected) => {
        expect(slugify(input)).toBe(expected)
    })

    it.each([
        ['About Our Company', 'about-our-company'],
        ['Über uns', 'uber-uns'],
        ['Qué hacemos', 'que-hacemos'],
        ['Straße', 'strasse'],
        ['About Us!', 'about-us'],
    ])('slugifies %o to %o — inherited from plugin-one-page', (input, expected) => {
        expect(slugify(input)).toBe(expected)
    })

    it('never returns a value with a leading or trailing hyphen', () => {
        // The defect this helper exists to prevent: a leading hyphen is legal
        // in an HTML id but is not a valid CSS identifier, so `#-ber-uns`
        // matches nothing and querySelector throws on it.
        for (const input of ['Über uns', '!!!Hallo!!!', '— Dash —', '  x  ']) {
            expect(slugify(input)).not.toMatch(/^-|-$/)
        }
    })

    it('returns an empty string when nothing usable remains', () => {
        for (const input of ['日本語', '!!!', '', '   ', '-']) {
            expect(slugify(input)).toBe('')
        }
    })

    it('collapses runs of separators into a single hyphen', () => {
        expect(slugify('a---b___c   d')).toBe('a-b-c-d')
    })

    it('coerces non-string input rather than throwing', () => {
        expect(slugify(42)).toBe('42')
        expect(slugify(null)).toBe('null')
        expect(slugify(undefined)).toBe('undefined')
    })

    it('is idempotent — slugifying a slug returns it unchanged', () => {
        for (const input of ['Über uns', 'web development', 'C++', 'Straße']) {
            const once = slugify(input)
            expect(slugify(once)).toBe(once)
        }
    })
})
