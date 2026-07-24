import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
    writeFileSync,
    readFileSync,
    unlinkSync,
    mkdirSync,
    rmSync,
    existsSync
} from 'fs'
import { join, resolve } from 'path'
import {
    validateNeraProject,
    publishTemplates,
    publishAllTemplates,
    publishAsset,
    resolveViewsDir,
    resolveAssetsDir
} from '../index.js'

const tempDir = resolve('./temp-test')
const testProjectDir = join(tempDir, 'test-project')
const sourceDir = join(tempDir, 'source')

describe('validateNeraProject', () => {
    let originalCwd

    beforeEach(() => {
        // Store original working directory
        originalCwd = process.cwd()

        // Create isolated test project directory
        mkdirSync(testProjectDir, { recursive: true })

        // Change to test directory
        process.chdir(testProjectDir)
    })

    afterEach(() => {
        // Return to original directory
        process.chdir(originalCwd)

        // Clean up test files
        if (existsSync(tempDir)) {
            rmSync(tempDir, { recursive: true })
        }
    })

    it('returns true for dummy package (test override)', () => {
        writeFileSync('./package.json', JSON.stringify({ name: 'dummy' }))
        expect(validateNeraProject()).toBe(true)
    })

    it('returns true for nera package', () => {
        writeFileSync(
            './package.json',
            JSON.stringify({ name: 'nera-my-site' })
        )
        expect(validateNeraProject()).toBe(true)
    })

    it('returns false for non-nera package', () => {
        writeFileSync(
            './package.json',
            JSON.stringify({ name: 'some-other-package' })
        )
        expect(validateNeraProject()).toBe(false)
    })

    it('returns false when package.json does not exist', () => {
        expect(validateNeraProject()).toBe(false)
    })

    it('returns false when package.json is invalid JSON', () => {
        writeFileSync('./package.json', 'invalid json')
        expect(validateNeraProject()).toBe(false)
    })

    it('accepts a project by shape regardless of its name', () => {
        // Nine plugins ship `expectedPackageName: 'dummy'`, so before the
        // shape check a user whose site is named `my-blog` was refused by
        // all nine while standing in a perfectly valid Nera project.
        writeFileSync('./package.json', JSON.stringify({ name: 'my-blog' }))
        mkdirSync('./config', { recursive: true })
        mkdirSync('./pages', { recursive: true })
        writeFileSync('./config/app.yaml', 'lang: en')

        expect(validateNeraProject()).toBe(true)
    })

    it('still rejects an unrelated project that only has one marker', () => {
        writeFileSync('./package.json', JSON.stringify({ name: 'my-blog' }))
        mkdirSync('./config', { recursive: true })
        writeFileSync('./config/app.yaml', 'lang: en')
        // no pages/ directory

        expect(validateNeraProject()).toBe(false)
    })
})

describe('publishTemplates', () => {
    let originalCwd

    beforeEach(() => {
        // Store original working directory
        originalCwd = process.cwd()

        // Create isolated test project directory
        mkdirSync(testProjectDir, { recursive: true })
        mkdirSync(sourceDir, { recursive: true })

        // Change to test directory
        process.chdir(testProjectDir)

        // Setup test environment with package.json
        writeFileSync('./package.json', JSON.stringify({ name: 'dummy' }))

        // Create test templates in source directory
        writeFileSync(join(sourceDir, 'template.pug'), 'div Template content')
        writeFileSync(join(sourceDir, 'nested.pug'), 'div Nested template')
    })

    afterEach(() => {
        // Return to original directory
        process.chdir(originalCwd)

        // Clean up test files
        if (existsSync(tempDir)) {
            rmSync(tempDir, { recursive: true })
        }
    })

    it('publishes single template successfully', () => {
        const result = publishTemplates({
            pluginName: 'plugin-test',
            sourceDir: sourceDir,
            templateFiles: 'template.pug',
            expectedPackageName: 'dummy'
        })

        expect(result).toBe(true)
        expect(existsSync('./views/vendor/plugin-test/template.pug')).toBe(true)
    })

    it('publishes multiple templates successfully', () => {
        const result = publishTemplates({
            pluginName: 'plugin-test',
            sourceDir: sourceDir,
            templateFiles: ['template.pug', 'nested.pug'],
            expectedPackageName: 'dummy'
        })

        expect(result).toBe(true)
        expect(existsSync('./views/vendor/plugin-test/template.pug')).toBe(true)
        expect(existsSync('./views/vendor/plugin-test/nested.pug')).toBe(true)
    })

    it('returns false when not in valid Nera project', () => {
        unlinkSync('./package.json')

        const result = publishTemplates({
            pluginName: 'plugin-test',
            sourceDir: sourceDir,
            templateFiles: 'template.pug'
        })

        expect(result).toBe(false)
    })

    it('skips when destination already exists', () => {
        // Create destination first
        mkdirSync('./views/vendor/plugin-test', { recursive: true })

        const result = publishTemplates({
            pluginName: 'plugin-test',
            sourceDir: sourceDir,
            templateFiles: 'template.pug',
            expectedPackageName: 'dummy'
        })

        expect(result).toBe(true)
        expect(existsSync('./views/vendor/plugin-test/template.pug')).toBe(
            false
        )
    })

    it('overwrites an existing destination when force is set', () => {
        mkdirSync('./views/vendor/plugin-test', { recursive: true })
        writeFileSync(
            './views/vendor/plugin-test/template.pug',
            'div Customized by the user'
        )

        const result = publishTemplates({
            pluginName: 'plugin-test',
            sourceDir: sourceDir,
            templateFiles: 'template.pug',
            expectedPackageName: 'dummy',
            force: true
        })

        expect(result).toBe(true)
        expect(
            readFileSync('./views/vendor/plugin-test/template.pug', 'utf-8')
        ).toBe('div Template content')
    })

    it('returns false when a source template is missing', () => {
        // `return false` inside a forEach callback returned from the
        // callback, not the function, so this reported success.
        const result = publishTemplates({
            pluginName: 'plugin-test',
            sourceDir: sourceDir,
            templateFiles: 'does-not-exist.pug',
            expectedPackageName: 'dummy'
        })

        expect(result).toBe(false)
    })

    it('does not leave a partial destination when a source is missing', () => {
        const result = publishTemplates({
            pluginName: 'plugin-test',
            sourceDir: sourceDir,
            templateFiles: ['template.pug', 'does-not-exist.pug'],
            expectedPackageName: 'dummy'
        })

        expect(result).toBe(false)
        // A partial copy would trip the skip-if-exists check on the retry,
        // permanently wedging the publish.
        expect(existsSync('./views/vendor/plugin-test')).toBe(false)
    })

    it('publishes into theme/views/vendor when a theme folder exists', () => {
        // A themed site renders from theme/views; publishing to root views/
        // put templates where the layered resolver never looks.
        mkdirSync('./theme', { recursive: true })

        const result = publishTemplates({
            pluginName: 'plugin-test',
            sourceDir: sourceDir,
            templateFiles: 'template.pug',
            expectedPackageName: 'dummy'
        })

        expect(result).toBe(true)
        expect(
            existsSync('./theme/views/vendor/plugin-test/template.pug')
        ).toBe(true)
        expect(existsSync('./views/vendor/plugin-test/template.pug')).toBe(
            false
        )
    })

    it('honors an explicit folders.views over the theme probe', () => {
        mkdirSync('./theme', { recursive: true })
        mkdirSync('./config', { recursive: true })
        writeFileSync('./config/app.yaml', 'folders:\n  views: ./custom-views\n')

        const result = publishTemplates({
            pluginName: 'plugin-test',
            sourceDir: sourceDir,
            templateFiles: 'template.pug',
            expectedPackageName: 'dummy'
        })

        expect(result).toBe(true)
        expect(
            existsSync('./custom-views/vendor/plugin-test/template.pug')
        ).toBe(true)
        expect(
            existsSync('./theme/views/vendor/plugin-test/template.pug')
        ).toBe(false)
    })
})

describe('resolveViewsDir / resolveAssetsDir', () => {
    let originalCwd

    beforeEach(() => {
        originalCwd = process.cwd()
        mkdirSync(testProjectDir, { recursive: true })
        process.chdir(testProjectDir)
        writeFileSync('./package.json', JSON.stringify({ name: 'dummy' }))
    })

    afterEach(() => {
        process.chdir(originalCwd)
        if (existsSync(tempDir)) {
            rmSync(tempDir, { recursive: true })
        }
    })

    it('defaults to the deprecated root folders with no theme', () => {
        expect(resolveViewsDir()).toBe(resolve(testProjectDir, 'views'))
        expect(resolveAssetsDir()).toBe(resolve(testProjectDir, 'assets'))
    })

    it('resolves to theme/ folders when a theme folder exists', () => {
        mkdirSync('./theme', { recursive: true })

        expect(resolveViewsDir()).toBe(resolve(testProjectDir, 'theme/views'))
        expect(resolveAssetsDir()).toBe(resolve(testProjectDir, 'theme/assets'))
    })

    it('honors explicit folders in config/app.yaml', () => {
        mkdirSync('./config', { recursive: true })
        writeFileSync(
            './config/app.yaml',
            'folders:\n  views: ./v\n  assets: ./a\n'
        )

        expect(resolveViewsDir()).toBe(resolve(testProjectDir, 'v'))
        expect(resolveAssetsDir()).toBe(resolve(testProjectDir, 'a'))
    })
})

describe('publishAsset', () => {
    let originalCwd

    beforeEach(() => {
        originalCwd = process.cwd()
        mkdirSync(testProjectDir, { recursive: true })
        mkdirSync(sourceDir, { recursive: true })
        process.chdir(testProjectDir)
        writeFileSync('./package.json', JSON.stringify({ name: 'dummy' }))
        writeFileSync(join(sourceDir, 'client.js'), 'console.log("hi")')
    })

    afterEach(() => {
        process.chdir(originalCwd)
        if (existsSync(tempDir)) {
            rmSync(tempDir, { recursive: true })
        }
    })

    const publish = (extra = {}) =>
        publishAsset({
            sourceFile: join(sourceDir, 'client.js'),
            targetPath: 'js/client.js',
            expectedPackageName: 'dummy',
            ...extra
        })

    it('copies into root assets with no theme', () => {
        expect(publish()).toBe(true)
        expect(readFileSync('./assets/js/client.js', 'utf-8')).toBe(
            'console.log("hi")'
        )
    })

    it('copies into theme/assets when a theme folder exists', () => {
        mkdirSync('./theme', { recursive: true })

        expect(publish()).toBe(true)
        expect(existsSync('./theme/assets/js/client.js')).toBe(true)
        expect(existsSync('./assets/js/client.js')).toBe(false)
    })

    it('skips an existing file and preserves the user copy', () => {
        mkdirSync('./assets/js', { recursive: true })
        writeFileSync('./assets/js/client.js', 'mine')

        expect(publish()).toBe(true)
        expect(readFileSync('./assets/js/client.js', 'utf-8')).toBe('mine')
    })

    it('overwrites an existing file when force is set', () => {
        mkdirSync('./assets/js', { recursive: true })
        writeFileSync('./assets/js/client.js', 'mine')

        expect(publish({ force: true })).toBe(true)
        expect(readFileSync('./assets/js/client.js', 'utf-8')).toBe(
            'console.log("hi")'
        )
    })

    it('returns false outside a Nera project', () => {
        unlinkSync('./package.json')

        expect(publish()).toBe(false)
    })

    it('returns false when the source asset is missing', () => {
        expect(
            publishAsset({
                sourceFile: join(sourceDir, 'nope.js'),
                targetPath: 'js/nope.js',
                expectedPackageName: 'dummy'
            })
        ).toBe(false)
    })
})

describe('publishAllTemplates', () => {
    let originalCwd

    beforeEach(() => {
        // Store original working directory
        originalCwd = process.cwd()

        // Create isolated test project directory
        mkdirSync(testProjectDir, { recursive: true })
        mkdirSync(sourceDir, { recursive: true })

        // Change to test directory
        process.chdir(testProjectDir)

        // Setup test environment with package.json
        writeFileSync('./package.json', JSON.stringify({ name: 'dummy' }))

        // Create multiple .pug files and one non-pug file
        writeFileSync(join(sourceDir, 'template1.pug'), 'div Template 1')
        writeFileSync(join(sourceDir, 'template2.pug'), 'div Template 2')
        writeFileSync(join(sourceDir, 'not-template.txt'), 'Not a template')
    })

    afterEach(() => {
        // Return to original directory
        process.chdir(originalCwd)

        // Clean up test files
        if (existsSync(tempDir)) {
            rmSync(tempDir, { recursive: true })
        }
    })

    it('publishes all .pug templates', () => {
        const result = publishAllTemplates({
            pluginName: 'plugin-test',
            sourceDir: sourceDir,
            expectedPackageName: 'dummy'
        })

        expect(result).toBe(true)
        expect(existsSync('./views/vendor/plugin-test/template1.pug')).toBe(
            true
        )
        expect(existsSync('./views/vendor/plugin-test/template2.pug')).toBe(
            true
        )
        expect(existsSync('./views/vendor/plugin-test/not-template.txt')).toBe(
            false
        )
    })

    it('handles directory with no .pug files', () => {
        // Remove .pug files, leave only .txt
        unlinkSync(join(sourceDir, 'template1.pug'))
        unlinkSync(join(sourceDir, 'template2.pug'))

        const result = publishAllTemplates({
            pluginName: 'plugin-test',
            sourceDir: sourceDir,
            expectedPackageName: 'dummy'
        })

        expect(result).toBe(true)
    })

    it('handles non-existent source directory', () => {
        const result = publishAllTemplates({
            pluginName: 'plugin-test',
            sourceDir: './non-existent-dir',
            expectedPackageName: 'dummy'
        })

        expect(result).toBe(false)
    })

    it('publishes templates in subdirectories, preserving structure', () => {
        // Mirrors nera-plugin-navigation, whose templates all
        // `include partials/...`. A non-recursive readdir shipped the
        // top-level templates without the partials they depend on, so
        // nothing compiled.
        mkdirSync(join(sourceDir, 'partials'), { recursive: true })
        mkdirSync(join(sourceDir, 'helper'), { recursive: true })
        writeFileSync(join(sourceDir, 'partials/x.pug'), 'div Partial X')
        writeFileSync(join(sourceDir, 'helper/y.pug'), 'div Helper Y')
        writeFileSync(join(sourceDir, 'partials/notes.txt'), 'Not a template')

        const result = publishAllTemplates({
            pluginName: 'plugin-test',
            sourceDir: sourceDir,
            expectedPackageName: 'dummy'
        })

        expect(result).toBe(true)
        expect(existsSync('./views/vendor/plugin-test/template1.pug')).toBe(
            true
        )
        expect(existsSync('./views/vendor/plugin-test/partials/x.pug')).toBe(
            true
        )
        expect(existsSync('./views/vendor/plugin-test/helper/y.pug')).toBe(true)
        expect(
            existsSync('./views/vendor/plugin-test/partials/notes.txt')
        ).toBe(false)
    })
})
