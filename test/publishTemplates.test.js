import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFileSync, unlinkSync, mkdirSync, rmSync, existsSync } from 'fs'
import { join, resolve } from 'path'
import {
    validateNeraProject,
    publishTemplates,
    publishAllTemplates
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
})
