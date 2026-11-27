import { describe, it, expect } from 'vitest'
import { isNoindex, isRenderedPage } from '../src/pages.js'
import * as subpath from '@nera-static/plugin-utils/pages'

describe('/pages subpath', () => {
    it('exports the same functions as src/pages.js', () => {
        expect(subpath.isRenderedPage).toBe(isRenderedPage)
        expect(subpath.isNoindex).toBe(isNoindex)
    })
})

describe('isRenderedPage', () => {
    it('takes a page with a layout and an href', () => {
        expect(isRenderedPage({ layout: 'pages/default.pug', href: '/index.html' })).toBe(true)
    })

    it.each([
        ['no layout', { href: '/a.html' }],
        ['an empty layout', { layout: '', href: '/a.html' }],
        ['a blank layout', { layout: '  ', href: '/a.html' }],
        ['a layout that is no string', { layout: true, href: '/a.html' }],
        ['no href', { layout: 'pages/default.pug' }],
        ['an empty href', { layout: 'pages/default.pug', href: '' }],
        ['an href that is no string', { layout: 'pages/default.pug', href: 7 }],
    ])('refuses a page with %s', (_, meta) => {
        expect(isRenderedPage(meta)).toBe(false)
    })

    it.each([undefined, null])('refuses a missing meta (%s)', (meta) => {
        expect(isRenderedPage(meta)).toBe(false)
    })
})

describe('isNoindex', () => {
    it.each(['noindex', 'NoIndex, follow', 'follow,NOINDEX'])('finds noindex in the page robots %s', (robots) => {
        expect(isNoindex({ robots }, {})).toBe(true)
    })

    it('falls back to app.robots when the page sets none', () => {
        expect(isNoindex({}, { robots: 'noindex' })).toBe(true)
        expect(isNoindex({ robots: '' }, { robots: 'noindex' })).toBe(true)
    })

    it('lets the page robots win over app.robots', () => {
        expect(isNoindex({ robots: 'index, follow' }, { robots: 'noindex' })).toBe(false)
        expect(isNoindex({ robots: 'noindex' }, { robots: 'index' })).toBe(true)
    })

    it.each([
        ['no robots anywhere', {}, {}],
        ['index, follow', { robots: 'index, follow' }, {}],
        ['a robots value that is no string', { robots: ['noindex'] }, {}],
        ['a missing meta and app', undefined, undefined],
    ])('is false for %s', (_, meta, app) => {
        expect(isNoindex(meta, app)).toBe(false)
    })
})
