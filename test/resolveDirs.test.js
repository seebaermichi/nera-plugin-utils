import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync, mkdtempSync, mkdirSync, realpathSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { publishTemplates, resolveAssetsDir, resolveViewsDir } from '../index.js'

// The cases mirror `computeFolders` in @nera-static/core (src/core.js): a
// plugin must publish where the build will look, so every row here is the
// answer core gives for the same site.

let root

beforeEach(() => {
    root = realpathSync(mkdtempSync(path.join(tmpdir(), 'plugin-utils-dirs-')))
})

afterEach(() => {
    rmSync(root, { recursive: true, force: true })
})

const appYaml = (content) => {
    mkdirSync(path.join(root, 'config'), { recursive: true })
    writeFileSync(path.join(root, 'config/app.yaml'), content)
}

const dir = (relative) => mkdirSync(path.join(root, relative), { recursive: true })

const resolved = () => ({
    views: path.relative(root, resolveViewsDir(root)),
    assets: path.relative(root, resolveAssetsDir(root)),
})

describe('resolveViewsDir / resolveAssetsDir follow core\'s computeFolders', () => {
    it('uses the deprecated root folders on a site without theme', () => {
        expect(resolved()).toEqual({ views: 'views', assets: 'assets' })
    })

    it('uses theme/ on a thin site that names a theme and has neither theme/ nor views/ (themeOnly)', () => {
        appYaml('theme: \'@nera-static/theme-blog\'\n')

        expect(resolved()).toEqual({ views: 'theme/views', assets: 'theme/assets' })
    })

    it('uses theme/ for assets too when only a root assets/ exists beside the theme', () => {
        // core decides themeOnly by the root views/ alone
        appYaml('theme: \'@nera-static/theme-blog\'\n')
        dir('assets')

        expect(resolved()).toEqual({ views: 'theme/views', assets: 'theme/assets' })
    })

    it('uses theme/ when a theme/ folder exists, with or without theme:', () => {
        dir('theme')
        expect(resolved()).toEqual({ views: 'theme/views', assets: 'theme/assets' })

        appYaml('theme: \'@nera-static/theme-blog\'\n')
        expect(resolved()).toEqual({ views: 'theme/views', assets: 'theme/assets' })
    })

    it('stays on the legacy root views/ when theme: is set but a root views/ exists', () => {
        appYaml('theme: \'@nera-static/theme-blog\'\n')
        dir('views')

        expect(resolved()).toEqual({ views: 'views', assets: 'assets' })
    })

    it('ignores an empty theme:', () => {
        appYaml('theme: \'\'\n')

        expect(resolved()).toEqual({ views: 'views', assets: 'assets' })
    })

    it('lets an explicit folders.<key> win over themeOnly, per key', () => {
        appYaml('theme: \'@nera-static/theme-blog\'\nfolders:\n  views: ./views\n')

        expect(resolved()).toEqual({ views: 'views', assets: 'theme/assets' })
    })
})

describe('publishTemplates on a themeOnly site', () => {
    let originalCwd

    beforeEach(() => {
        originalCwd = process.cwd()
        process.chdir(root)
        writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'dummy' }))
        appYaml('theme: \'@nera-static/theme-blog\'\n')
        dir('source')
        writeFileSync(path.join(root, 'source/template.pug'), 'div Template content')
    })

    afterEach(() => {
        process.chdir(originalCwd)
    })

    it('writes theme/views/vendor/<plugin>/, where the build looks', () => {
        const result = publishTemplates({
            pluginName: 'plugin-test',
            sourceDir: path.join(root, 'source'),
            templateFiles: 'template.pug',
            expectedPackageName: 'dummy',
        })

        expect(result).toBe(true)
        expect(existsSync(path.join(root, 'theme/views/vendor/plugin-test/template.pug'))).toBe(true)
        expect(existsSync(path.join(root, 'views'))).toBe(false)
    })
})
