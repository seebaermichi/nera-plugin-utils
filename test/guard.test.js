import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { GET_ASSETS_CORE, assertCoreVersion, coreVersion, satisfiesFloor } from '../src/guard.js'
import * as subpath from '@nera-static/plugin-utils/guard'

describe('/guard subpath', () => {
    it('exports the same functions as src/guard.js', () => {
        expect(subpath.assertCoreVersion).toBe(assertCoreVersion)
        expect(subpath.coreVersion).toBe(coreVersion)
        expect(subpath.satisfiesFloor).toBe(satisfiesFloor)
        expect(subpath.GET_ASSETS_CORE).toBe('4.13.0')
    })
})

describe('satisfiesFloor', () => {
    it.each([
        ['4.13.0', true],
        ['4.13.1', true],
        ['4.14.0', true],
        ['5.0.0', true],
        ['4.12.9', false],
        ['3.99.99', false],
        ['4.9.0', false],
    ])('%s against 4.13.0 → %s', (version, expected) => {
        expect(satisfiesFloor(version, '4.13.0')).toBe(expected)
    })

    it('compares parts as numbers, not strings', () => {
        expect(satisfiesFloor('4.100.0', '4.13.0')).toBe(true)
        expect(satisfiesFloor('10.0.0', '9.0.0')).toBe(true)
    })

    it('puts a prerelease below its release', () => {
        expect(satisfiesFloor('4.13.0-beta.1', '4.13.0')).toBe(false)
    })

    it('lets a prerelease of a later version pass', () => {
        expect(satisfiesFloor('4.14.0-rc.1', '4.13.0')).toBe(true)
    })

    it('ignores build metadata', () => {
        expect(satisfiesFloor('4.13.0+sha.abc', '4.13.0')).toBe(true)
    })

    it('trims surrounding whitespace', () => {
        expect(satisfiesFloor(' 4.13.0', '4.13.0')).toBe(true)
        expect(satisfiesFloor('4.13.0\n', '4.13.0')).toBe(true)
    })

    it.each([[''], ['latest'], ['4.13'], ['v4.13.0'], ['4.13.0.1'], [null], [undefined], [4.13]])(
        'is false for the unparseable %j',
        (version) => {
            expect(satisfiesFloor(version, '4.13.0')).toBe(false)
        }
    )

    it.each([['4.13'], ['4.13.0-beta.1'], [''], [undefined]])('throws a TypeError for the floor %j', (floor) => {
        expect(() => satisfiesFloor('4.13.0', floor)).toThrow(TypeError)
    })
})

describe('coreVersion and assertCoreVersion against a site', () => {
    let root

    beforeEach(() => {
        root = mkdtempSync(path.join(tmpdir(), 'plugin-utils-guard-'))
    })

    afterEach(() => {
        rmSync(root, { recursive: true, force: true })
    })

    // A fake `@nera-static/core` installed under `<root>/<dir>/node_modules`.
    const installCore = (dir, version) => {
        const folder = path.join(root, dir, 'node_modules', '@nera-static', 'core')
        mkdirSync(folder, { recursive: true })
        writeFileSync(path.join(folder, 'package.json'), JSON.stringify({ name: '@nera-static/core', version }))
        return path.join(root, dir)
    }

    // A plugin module at `<root>/<dir>/index.js`, as its `import.meta.url`.
    const pluginUrl = (dir) => {
        mkdirSync(path.join(root, dir), { recursive: true })
        const file = path.join(root, dir, 'index.js')
        writeFileSync(file, '')
        return pathToFileURL(file).href
    }

    describe('coreVersion', () => {
        it('reads the core of the site', () => {
            expect(coreVersion({ cwd: installCore('site', '4.15.1') })).toBe('4.15.1')
        })

        it('prefers the core of the site over that of the plugin', () => {
            const cwd = installCore('site', '4.15.1')
            installCore('plugin', '4.9.0')
            expect(coreVersion({ cwd, from: pluginUrl('plugin') })).toBe('4.15.1')
        })

        it('falls back to the location of the plugin when the site has no core', () => {
            const cwd = path.join(root, 'site')
            mkdirSync(cwd)
            installCore('plugin', '4.14.0')
            expect(coreVersion({ cwd, from: pluginUrl('plugin') })).toBe('4.14.0')
        })

        it('asks only the site without from', () => {
            const cwd = path.join(root, 'site')
            mkdirSync(cwd)
            installCore('plugin', '4.14.0')
            expect(coreVersion({ cwd })).toBeNull()
        })

        it('treats a core manifest without a version as not found', () => {
            const cwd = installCore('site', undefined)
            expect(coreVersion({ cwd })).toBeNull()
            expect(() => assertCoreVersion({ plugin: 'plugin-x', cwd })).not.toThrow()
        })

        it('is null when neither has a core', () => {
            const cwd = path.join(root, 'site')
            mkdirSync(cwd)
            expect(coreVersion({ cwd, from: pluginUrl('plugin') })).toBeNull()
        })

        it('defaults cwd to process.cwd()', () => {
            const cwd = installCore('site', '4.13.2')
            const before = process.cwd()
            process.chdir(cwd)
            try {
                expect(coreVersion()).toBe('4.13.2')
            } finally {
                process.chdir(before)
            }
        })
    })

    describe('assertCoreVersion', () => {
        it('passes a new enough core', () => {
            const cwd = installCore('site', '4.13.0')
            expect(() => assertCoreVersion({ plugin: 'plugin-sitemap', cwd })).not.toThrow()
        })

        it('passes an unknown version', () => {
            const cwd = path.join(root, 'site')
            mkdirSync(cwd)
            expect(() => assertCoreVersion({ plugin: 'plugin-sitemap', cwd })).not.toThrow()
            expect(() => assertCoreVersion({ plugin: 'plugin-sitemap', version: null })).not.toThrow()
        })

        it('throws for a too-old site core, naming plugin, version, need, why and the update', () => {
            const cwd = installCore('site', '4.12.0')
            expect(() =>
                assertCoreVersion({ plugin: 'plugin-sitemap', need: '4.13.0', why: 'the getAssets hook', cwd })
            ).toThrow(
                'plugin-sitemap: @nera-static/core 4.12.0 is too old; it needs >= 4.13.0 (the getAssets hook). ' +
                    'Update with `npm update @nera-static/nera` (or `@nera-static/core`).'
            )
        })

        it('defaults need to the getAssets floor and why to the getAssets hook', () => {
            expect(GET_ASSETS_CORE).toBe('4.13.0')
            expect(() => assertCoreVersion({ plugin: 'plugin-feed', version: '4.12.9' })).toThrow(
                /^plugin-feed: @nera-static\/core 4\.12\.9 is too old; it needs >= 4\.13\.0 \(the getAssets hook\)\./
            )
        })

        it('appends a hint after the update advice, trimmed', () => {
            expect(() =>
                assertCoreVersion({
                    plugin: 'plugin-code-blocks',
                    version: '4.12.0',
                    hint: '  Or set `assets: false` in config/code-blocks.yaml.\n',
                })
            ).toThrow(
                new Error(
                    'plugin-code-blocks: @nera-static/core 4.12.0 is too old; it needs >= 4.13.0 (the getAssets hook). ' +
                        'Update with `npm update @nera-static/nera` (or `@nera-static/core`). ' +
                        'Or set `assets: false` in config/code-blocks.yaml.'
                )
            )
        })

        it('adds nothing for a blank or non-string hint', () => {
            const bare =
                'plugin-x: @nera-static/core 4.12.0 is too old; it needs >= 4.13.0 (the getAssets hook). ' +
                'Update with `npm update @nera-static/nera` (or `@nera-static/core`).'
            for (const hint of [undefined, '', '   ', 42, null]) {
                expect(() => assertCoreVersion({ plugin: 'plugin-x', version: '4.12.0', hint })).toThrow(new Error(bare))
            }
        })

        it('passes a new enough core whatever the hint', () => {
            expect(() => assertCoreVersion({ plugin: 'plugin-x', version: '4.13.0', hint: 'never shown' })).not.toThrow()
        })

        it('checks the floor it is given', () => {
            expect(() => assertCoreVersion({ plugin: 'plugin-x', need: '4.15.0', version: '4.14.0', why: 'y' }))
                .toThrow(/needs >= 4\.15\.0 \(y\)/)
            expect(() => assertCoreVersion({ plugin: 'plugin-x', need: '4.15.0', version: '4.15.0' })).not.toThrow()
        })

        it('throws for a prerelease of the floor', () => {
            expect(() => assertCoreVersion({ plugin: 'plugin-x', version: '4.13.0-beta.1' })).toThrow(/too old/)
        })

        it('uses the core of the plugin through from when the site has none', () => {
            const cwd = path.join(root, 'site')
            mkdirSync(cwd)
            installCore('plugin', '4.10.0')
            expect(() => assertCoreVersion({ plugin: 'plugin-images', cwd, from: pluginUrl('plugin') }))
                .toThrow(/core 4\.10\.0 is too old/)
        })

        it('carries no ROADMAP reference', () => {
            let message = ''
            try {
                assertCoreVersion({ plugin: 'plugin-x', version: '1.0.0' })
            } catch (error) {
                message = error.message
            }
            expect(message).not.toMatch(/roadmap/i)
            expect(message).not.toBe('')
        })
    })
})
