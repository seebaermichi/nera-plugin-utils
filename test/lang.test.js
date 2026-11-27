import { describe, it, expect } from 'vitest'
import { siteLang, pageLang, siteLanguages, isLanguageMap, localize } from '../src/lang.js'

describe('siteLang', () => {
    it('returns app.lang trimmed', () => {
        expect(siteLang({ lang: 'de' })).toBe('de')
        expect(siteLang({ lang: ' de ' })).toBe('de')
    })

    it.each([
        ['no app', undefined],
        ['null', null],
        ['no lang', {}],
        ['a blank lang', { lang: '  ' }],
        ['an empty lang', { lang: '' }],
        ['a non-string lang', { lang: 7 }],
    ])('falls back to en for %s', (_, app) => {
        expect(siteLang(app)).toBe('en')
    })

    it('uses the given fallback', () => {
        expect(siteLang({}, 'default')).toBe('default')
        expect(siteLang({}, '')).toBe('')
    })
})

describe('pageLang', () => {
    it('trims meta.lang, so `lang: \'de \'` is de (real bug 4)', () => {
        expect(pageLang({ lang: 'de ' }, { lang: 'en' })).toBe('de')
    })

    it('prefers meta.lang over app.lang', () => {
        expect(pageLang({ lang: 'es' }, { lang: 'de' })).toBe('es')
    })

    it.each([
        ['no meta', undefined],
        ['no meta.lang', {}],
        ['a blank meta.lang', { lang: ' ' }],
        ['a non-string meta.lang', { lang: ['de'] }],
    ])('falls back to app.lang trimmed for %s', (_, meta) => {
        expect(pageLang(meta, { lang: ' de' })).toBe('de')
    })

    it('falls back to en, or the given fallback, when neither is set', () => {
        expect(pageLang({}, {})).toBe('en')
        expect(pageLang(undefined, undefined)).toBe('en')
        expect(pageLang({ lang: '' }, { lang: '' }, '')).toBe('')
    })
})

describe('siteLanguages', () => {
    it('collects app.lang and the translations keys, trimmed', () => {
        const app = { lang: ' de ', translations: { en: {}, ' es': {}, de: {} } }
        expect([...siteLanguages(app)]).toEqual(['de', 'en', 'es'])
    })

    it('leaves out blank languages and ignores non-object translations', () => {
        expect([...siteLanguages({ lang: ' ', translations: { ' ': {}, fr: {} } })]).toEqual(['fr'])
        expect([...siteLanguages({ lang: 'de', translations: ['en'] })]).toEqual(['de'])
    })

    it('is empty when the site sets neither', () => {
        expect(siteLanguages(undefined).size).toBe(0)
        expect(siteLanguages({}).size).toBe(0)
    })
})

describe('isLanguageMap', () => {
    const languages = new Set(['en', 'de'])

    it('accepts a map whose keys are all languages, a subset included', () => {
        expect(isLanguageMap({ en: 'a', de: 'b' }, languages)).toBe(true)
        expect(isLanguageMap({ de: 'b' }, languages)).toBe(true)
    })

    it('rejects a map with a key that is no language', () => {
        expect(isLanguageMap({ en: 'a', title: 'b' }, languages)).toBe(false)
    })

    it('takes any iterable of languages', () => {
        expect(isLanguageMap({ en: 'a' }, ['en'])).toBe(true)
        expect(isLanguageMap({ fr: 'a' }, ['en'])).toBe(false)
    })

    it('accepts any non-empty plain object when no languages are given', () => {
        expect(isLanguageMap({ anything: 1 })).toBe(true)
    })

    it.each([
        ['an empty object', {}],
        ['a string', 'en'],
        ['an array', ['en']],
        ['null', null],
        ['a Date', new Date()],
    ])('rejects %s', (_, value) => {
        expect(isLanguageMap(value, languages)).toBe(false)
        expect(isLanguageMap(value)).toBe(false)
    })
})

describe('localize', () => {
    const map = { en: 'Hello', de: 'Hallo' }

    it('returns a string as it is, whatever the language', () => {
        expect(localize('Hi', 'de')).toBe('Hi')
        expect(localize('', 'de')).toBe('')
    })

    it('returns the entry for the language', () => {
        expect(localize(map, 'de')).toBe('Hallo')
    })

    it('trims the language code', () => {
        expect(localize(map, 'de ')).toBe('Hallo')
    })

    it('gives null for a missing language without fallbacks (feed\'s chain)', () => {
        expect(localize(map, 'fr')).toBeNull()
    })

    it('falls back to the site language (structured-data\'s chain)', () => {
        expect(localize(map, 'fr', { fallbacks: ['de'] })).toBe('Hallo')
    })

    it('falls back to en, then any entry (consent\'s chain)', () => {
        const options = { fallbacks: ['en'], any: true }
        expect(localize(map, 'fr', options)).toBe('Hello')
        expect(localize({ es: 'Hola', it: 'Ciao' }, 'fr', options)).toBe('Hola')
    })

    it('tries the fallbacks in order and skips blank codes', () => {
        expect(localize(map, 'fr', { fallbacks: ['', 'es', 'de', 'en'] })).toBe('Hallo')
        expect(localize(map, undefined, { fallbacks: ['en'] })).toBe('Hello')
    })

    it('counts only text entries, so blank and null values fall back', () => {
        const partial = { de: '  ', es: null, en: 'Hello' }
        expect(localize(partial, 'de', { fallbacks: ['en'] })).toBe('Hello')
        expect(localize(partial, 'es', { fallbacks: ['en'] })).toBe('Hello')
        expect(localize({ de: '', fr: 1, it: 'Ciao' }, 'de', { any: true })).toBe('Ciao')
    })

    it('returns the entry untrimmed', () => {
        expect(localize({ de: ' Hallo ' }, 'de')).toBe(' Hallo ')
    })

    it('ignores inherited keys', () => {
        expect(localize({}, 'constructor')).toBeNull()
        expect(localize({}, 'toString', { any: true })).toBeNull()
    })

    it.each([
        ['undefined', undefined],
        ['null', null],
        ['a number', 3],
        ['an array', ['Hello']],
    ])('gives null for %s', (_, value) => {
        expect(localize(value, 'en', { fallbacks: ['en'], any: true })).toBeNull()
    })

    it('gives null for a map without any usable entry, even with any', () => {
        expect(localize({ de: '' }, 'en', { any: true })).toBeNull()
    })
})
