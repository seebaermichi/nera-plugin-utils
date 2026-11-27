import { describe, it, expect, vi, afterEach } from 'vitest'
import { createLogger } from '../src/log.js'

const sink = () => ({ warn: vi.fn(), info: vi.fn() })

describe('createLogger', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('prefixes a warning with the name, verbatim', () => {
        const out = sink()
        createLogger('plugin-sitemap', { sink: out }).warn('no origin set')
        expect(out.warn).toHaveBeenCalledWith('⚠️ plugin-sitemap: no origin set')
        expect(out.info).not.toHaveBeenCalled()
    })

    it('takes a name without the plugin- prefix as it is', () => {
        const out = sink()
        createLogger('validate', { sink: out }).warn('x')
        expect(out.warn).toHaveBeenCalledWith('⚠️ validate: x')
    })

    it('prints info lines through sink.info with their own sign', () => {
        const out = sink()
        createLogger('plugin-images', { sink: out }).info('12 images encoded')
        expect(out.info).toHaveBeenCalledWith('ℹ️ plugin-images: 12 images encoded')
        expect(out.warn).not.toHaveBeenCalled()
    })

    it('warns about one page as page, what and todo', () => {
        const out = sink()
        createLogger('plugin-page-data', { sink: out })
            .page('/blog/a.html', 'unknown key "foo"', 'remove it or add it to config/page-data.yaml')
        expect(out.warn).toHaveBeenCalledWith(
            '⚠️ plugin-page-data: /blog/a.html: unknown key "foo" — remove it or add it to config/page-data.yaml'
        )
    })

    it('writes to the console by default', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const info = vi.spyOn(console, 'info').mockImplementation(() => {})
        const log = createLogger('plugin-x')
        log.warn('a')
        log.info('b')
        expect(warn).toHaveBeenCalledWith('⚠️ plugin-x: a')
        expect(info).toHaveBeenCalledWith('ℹ️ plugin-x: b')
    })
})
