import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, realpathSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import {
    isPluginPackage,
    ownVersion,
    pluginPackage,
    pluginShortName,
    requireFromSite,
    themePackage,
} from '../src/packages.js'
import * as subpath from '@nera-static/plugin-utils/packages'

let root

beforeEach(() => {
    // Real path: Node resolves symlinks (macOS /var → /private/var).
    root = realpathSync(mkdtempSync(path.join(tmpdir(), 'plugin-utils-packages-')))
})

afterEach(() => {
    rmSync(root, { recursive: true, force: true })
})

const write = (relative, content) => {
    const file = path.join(root, relative)
    mkdirSync(path.dirname(file), { recursive: true })
    writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content))
    return file
}

describe('/packages subpath', () => {
    it('exports the same functions as src/packages.js', () => {
        expect(subpath.requireFromSite).toBe(requireFromSite)
        expect(subpath.ownVersion).toBe(ownVersion)
        expect(subpath.isPluginPackage).toBe(isPluginPackage)
        expect(subpath.pluginShortName).toBe(pluginShortName)
        expect(subpath.pluginPackage).toBe(pluginPackage)
        expect(subpath.themePackage).toBe(themePackage)
    })
})

describe('requireFromSite', () => {
    it('resolves from the node_modules of the site', () => {
        const manifest = write('site/node_modules/some-theme/package.json', { name: 'some-theme', version: '2.1.0' })
        const require = requireFromSite(path.join(root, 'site'))
        expect(require.resolve('some-theme/package.json')).toBe(manifest)
        expect(require('some-theme/package.json').version).toBe('2.1.0')
    })

    it('needs no package.json in the site root', () => {
        write('site/node_modules/x/package.json', { name: 'x', version: '1.0.0' })
        expect(() => requireFromSite(path.join(root, 'site')).resolve('x/package.json')).not.toThrow()
    })

    it('takes a relative cwd against process.cwd()', () => {
        const relative = path.relative(process.cwd(), path.join(root, 'site'))
        const manifest = write('site/node_modules/x/package.json', { name: 'x', version: '1.0.0' })
        expect(requireFromSite(relative).resolve('x/package.json')).toBe(manifest)
    })

    it('throws MODULE_NOT_FOUND for a package the site does not have', () => {
        mkdirSync(path.join(root, 'site'))
        expect(() => requireFromSite(path.join(root, 'site')).resolve('not-installed-anywhere-xyz'))
            .toThrow(expect.objectContaining({ code: 'MODULE_NOT_FOUND' }))
    })
})

describe('ownVersion', () => {
    it('reads the version of the package of the module from its import.meta.url', () => {
        write('pkg/package.json', { name: 'pkg', version: '1.7.0' })
        const file = write('pkg/index.js', '')
        expect(ownVersion(pathToFileURL(file).href)).toBe('1.7.0')
    })

    it('walks up from a module in a subfolder', () => {
        write('pkg/package.json', { name: 'pkg', version: '3.0.1' })
        const file = write('pkg/src/deep/mod.js', '')
        expect(ownVersion(pathToFileURL(file))).toBe('3.0.1')
    })

    it('skips a manifest without a version (a { "type": "module" } marker)', () => {
        write('pkg/package.json', { name: 'pkg', version: '1.2.3' })
        write('pkg/src/package.json', { type: 'module' })
        const file = write('pkg/src/mod.js', '')
        expect(ownVersion(pathToFileURL(file).href)).toBe('1.2.3')
    })

    it('takes a plain path too', () => {
        write('pkg/package.json', { name: 'pkg', version: '0.4.0' })
        expect(ownVersion(write('pkg/index.js', ''))).toBe('0.4.0')
    })

    it('is null for a manifest that is no JSON', () => {
        write('pkg/package.json', '{ not json')
        expect(ownVersion(pathToFileURL(write('pkg/index.js', '')).href)).toBeNull()
    })

    it('reads the version of plugin-utils itself', async () => {
        const { default: pkg } = await import('../package.json', { with: { type: 'json' } })
        expect(ownVersion(new URL('../src/packages.js', import.meta.url))).toBe(pkg.version)
    })
})

describe('isPluginPackage', () => {
    it.each(['@nera-static/plugin-tags', '@nera-static/plugin-structured-data'])('takes %s as a plugin', (name) => {
        expect(isPluginPackage(name)).toBe(true)
    })

    it.each([
        '@nera-static/plugin-utils',
        '@nera-static/core',
        '@nera-static/nera',
        '@nera-static/validate',
        '@nera-static/installer',
        '@nera-static/theme-blog',
        '@nera-static/starter-blog',
        '@nera-static/highlightjs-pug',
        'plugin-tags',
        '@other/plugin-tags',
        'nera-plugin-tags',
    ])('takes %s as no plugin', (name) => {
        expect(isPluginPackage(name)).toBe(false)
    })

    it('matches core\'s prefix rule exactly, so an empty plugin name still counts', () => {
        // setup-plugins.js: startsWith('@nera-static/plugin-') minus plugin-utils.
        expect(isPluginPackage('@nera-static/plugin-')).toBe(true)
        expect(isPluginPackage('@nera-static/plugin-utils-extra')).toBe(true)
    })

    it.each([undefined, null, 7, {}])('takes %s as no plugin', (value) => {
        expect(isPluginPackage(value)).toBe(false)
    })
})

describe('pluginShortName', () => {
    it('drops the scope, like core\'s log and plugin-order.yaml', () => {
        expect(pluginShortName('@nera-static/plugin-tags')).toBe('plugin-tags')
    })

    it('returns any other name unchanged', () => {
        expect(pluginShortName('my-local-plugin')).toBe('my-local-plugin')
        expect(pluginShortName('@other/plugin-x')).toBe('@other/plugin-x')
    })
})

describe('pluginPackage', () => {
    it.each(['sitemap', 'plugin-sitemap', '@nera-static/plugin-sitemap'])('maps %s to @nera-static/plugin-sitemap', (spec) => {
        expect(pluginPackage(spec)).toEqual({ name: 'sitemap', pkg: '@nera-static/plugin-sitemap' })
    })

    it('keeps dashes and digits in the name', () => {
        expect(pluginPackage('structured-data')).toEqual({
            name: 'structured-data',
            pkg: '@nera-static/plugin-structured-data',
        })
        expect(pluginPackage('h2')).toEqual({ name: 'h2', pkg: '@nera-static/plugin-h2' })
    })

    it.each([
        'utils',
        'plugin-utils',
        '@nera-static/plugin-utils',
        '@other/plugin-x',
        '@nera-static/core',
        'sitemap@1.0.0',
        './plugins/x',
        'Sitemap',
        '-x',
        '',
        'plugin-',
        undefined,
        null,
        7,
    ])('throws a TypeError for %s', (spec) => {
        expect(() => pluginPackage(spec)).toThrow(TypeError)
    })

    it('names the spec and the accepted forms in its message', () => {
        expect(() => pluginPackage('@other/plugin-x')).toThrow(
            /"@other\/plugin-x" is not a Nera plugin\. Give an official plugin as `<name>`, `plugin-<name>` or `@nera-static\/plugin-<name>`/
        )
    })
})

describe('themePackage', () => {
    it('expands a bare name to @nera-static/theme-<name>', () => {
        expect(themePackage('blog')).toBe('@nera-static/theme-blog')
    })

    it.each(['@nera-static/theme-stack', '@acme/theme-shop', 'acme/theme'])('uses %s verbatim', (spec) => {
        expect(themePackage(spec)).toBe(spec)
    })

    it.each(['.', './theme', '../shared/theme'])('gives null for the local theme %s', (spec) => {
        expect(themePackage(spec)).toBeNull()
    })

    it.each(['', '   ', undefined, null, 7])('gives null for the blank or missing spec %s', (spec) => {
        expect(themePackage(spec)).toBeNull()
    })
})
