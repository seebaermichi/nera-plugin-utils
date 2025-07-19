import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFileSync, unlinkSync, mkdirSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import {
    validateNeraProject,
    publishTemplates,
    publishAllTemplates
} from '../index.js'

const tempDir = './temp-test'
const packageJsonPath = './package.json'
const packageJsonBackup = './package.json.backup'

describe('validateNeraProject', () => {
    beforeEach(() => {
        // Backup existing package.json if it exists
        if (existsSync(packageJsonPath)) {
            writeFileSync(packageJsonBackup, JSON.stringify({}))
        }
    })

    afterEach(() => {
        // Clean up test files
        if (existsSync(packageJsonPath)) {
            unlinkSync(packageJsonPath)
        }
        if (existsSync(packageJsonBackup)) {
            unlinkSync(packageJsonBackup)
        }
    })

    it('returns true for dummy package (test override)', () => {
        writeFileSync(packageJsonPath, JSON.stringify({ name: 'dummy' }))
        expect(validateNeraProject()).toBe(true)
    })

    it('returns true for nera package', () => {
        writeFileSync(packageJsonPath, JSON.stringify({ name: 'nera-my-site' }))
        expect(validateNeraProject()).toBe(true)
    })

    it('returns false for non-nera package', () => {
        writeFileSync(
            packageJsonPath,
            JSON.stringify({ name: 'some-other-package' })
        )
        expect(validateNeraProject()).toBe(false)
    })

    it('returns false when package.json does not exist', () => {
        expect(validateNeraProject()).toBe(false)
    })

    it('returns false when package.json is invalid JSON', () => {
        writeFileSync(packageJsonPath, 'invalid json')
        expect(validateNeraProject()).toBe(false)
    })
})

describe('publishTemplates', () => {
    beforeEach(() => {
        // Setup test environment
        writeFileSync(packageJsonPath, JSON.stringify({ name: 'dummy' }))

        // Create source directory with test templates
        mkdirSync(join(tempDir, 'source'), { recursive: true })
        writeFileSync(
            join(tempDir, 'source', 'template.pug'),
            'div Template content'
        )
        writeFileSync(
            join(tempDir, 'source', 'nested.pug'),
            'div Nested template'
        )

        // Clean destination if exists
        if (existsSync(join(tempDir, 'views'))) {
            rmSync(join(tempDir, 'views'), { recursive: true })
        }
    })

    afterEach(() => {
        // Clean up
        if (existsSync(tempDir)) {
            rmSync(tempDir, { recursive: true })
        }
        if (existsSync(packageJsonPath)) {
            unlinkSync(packageJsonPath)
        }
        if (existsSync('./views')) {
            rmSync('./views', { recursive: true })
        }
    })

    it('publishes single template successfully', () => {
        const result = publishTemplates({
            pluginName: 'plugin-test',
            sourceDir: join(tempDir, 'source'),
            templateFiles: 'template.pug',
            expectedPackageName: 'dummy'
        })

        expect(result).toBe(true)
        expect(existsSync('./views/vendor/plugin-test/template.pug')).toBe(true)
    })

    it('publishes multiple templates successfully', () => {
        const result = publishTemplates({
            pluginName: 'plugin-test',
            sourceDir: join(tempDir, 'source'),
            templateFiles: ['template.pug', 'nested.pug'],
            expectedPackageName: 'dummy'
        })

        expect(result).toBe(true)
        expect(existsSync('./views/vendor/plugin-test/template.pug')).toBe(true)
        expect(existsSync('./views/vendor/plugin-test/nested.pug')).toBe(true)
    })

    it('returns false when not in valid Nera project', () => {
        unlinkSync(packageJsonPath)

        const result = publishTemplates({
            pluginName: 'plugin-test',
            sourceDir: join(tempDir, 'source'),
            templateFiles: 'template.pug'
        })

        expect(result).toBe(false)
    })

    it('skips when destination already exists', () => {
        // Create destination first
        mkdirSync('./views/vendor/plugin-test', { recursive: true })

        const result = publishTemplates({
            pluginName: 'plugin-test',
            sourceDir: join(tempDir, 'source'),
            templateFiles: 'template.pug',
            expectedPackageName: 'dummy'
        })

        expect(result).toBe(true)
        expect(existsSync('./views/vendor/plugin-test/template.pug')).toBe(
            false
        )
    })
})

describe('publishAllTemplates', () => {
    beforeEach(() => {
        writeFileSync(packageJsonPath, JSON.stringify({ name: 'dummy' }))

        // Create source directory with multiple .pug files
        mkdirSync(join(tempDir, 'source'), { recursive: true })
        writeFileSync(
            join(tempDir, 'source', 'template1.pug'),
            'div Template 1'
        )
        writeFileSync(
            join(tempDir, 'source', 'template2.pug'),
            'div Template 2'
        )
        writeFileSync(
            join(tempDir, 'source', 'not-template.txt'),
            'Not a template'
        )

        // Clean destination if exists
        if (existsSync('./views')) {
            rmSync('./views', { recursive: true })
        }
    })

    afterEach(() => {
        if (existsSync(tempDir)) {
            rmSync(tempDir, { recursive: true })
        }
        if (existsSync(packageJsonPath)) {
            unlinkSync(packageJsonPath)
        }
        if (existsSync('./views')) {
            rmSync('./views', { recursive: true })
        }
    })

    it('publishes all .pug templates', () => {
        const result = publishAllTemplates({
            pluginName: 'plugin-test',
            sourceDir: join(tempDir, 'source'),
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
        unlinkSync(join(tempDir, 'source', 'template1.pug'))
        unlinkSync(join(tempDir, 'source', 'template2.pug'))

        const result = publishAllTemplates({
            pluginName: 'plugin-test',
            sourceDir: join(tempDir, 'source'),
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
})
