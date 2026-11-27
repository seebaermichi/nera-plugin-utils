import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, realpathSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { ownVersion, requireFromSite } from '../src/packages.js'
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
