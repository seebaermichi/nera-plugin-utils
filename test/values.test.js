import { describe, it, expect } from 'vitest'
import { runInNewContext } from 'node:vm'
import { isPlainObject, isText, textOr } from '../src/values.js'

describe('isPlainObject', () => {
    it.each([
        ['an object literal', { a: 1 }],
        ['an empty object', {}],
        ['Object.create(null)', Object.create(null)],
        ['a parsed JSON object', JSON.parse('{"a":1}')],
        ['an object of another realm', runInNewContext('({ a: 1 })')],
    ])('accepts %s', (_, value) => {
        expect(isPlainObject(value)).toBe(true)
    })

    class Thing {}

    it.each([
        ['null', null],
        ['undefined', undefined],
        ['an array', [1, 2]],
        ['an array of another realm', runInNewContext('[1, 2]')],
        ['a Date', new Date()],
        ['a Date of another realm', runInNewContext('new Date()')],
        ['a Map', new Map()],
        ['a class instance', new Thing()],
        ['a function', () => {}],
        ['a string', 'text'],
        ['a number', 1],
    ])('rejects %s', (_, value) => {
        expect(isPlainObject(value)).toBe(false)
    })
})

describe('isText', () => {
    it.each([
        ['a word', 'hello'],
        ['a padded word', '  hello  '],
    ])('accepts %s', (_, value) => {
        expect(isText(value)).toBe(true)
    })

    it.each([
        ['an empty string', ''],
        ['a blank string', ' \n\t '],
        ['a number', 42],
        ['null', null],
        ['undefined', undefined],
        ['an array of strings', ['a']],
    ])('rejects %s', (_, value) => {
        expect(isText(value)).toBe(false)
    })
})

describe('textOr', () => {
    it('returns the text trimmed', () => {
        expect(textOr('  hello world \n')).toBe('hello world')
    })

    it('returns the fallback for a blank string', () => {
        expect(textOr('   ', 'default')).toBe('default')
    })

    it('returns the fallback for a non-string', () => {
        expect(textOr(42, 'default')).toBe('default')
        expect(textOr(null, 'default')).toBe('default')
    })

    it('returns undefined without a fallback', () => {
        expect(textOr('')).toBeUndefined()
        expect(textOr(undefined)).toBeUndefined()
    })
})
