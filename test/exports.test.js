import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { escapeRegExp } from '../src/html.js'

const root = path.resolve(import.meta.dirname, '..')
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8')

const entries = Object.entries(pkg.exports)
const subpaths = entries.filter(([subpath]) => subpath !== '.')

// Whether the published `files` list ships `target` (`./src/x.js`).
const shipped = (target) => {
    const file = path.posix.normalize(target)
    return pkg.files.some((entry) => file === entry || file.startsWith(`${entry.replace(/\/+$/, '')}/`))
}

// A `#### \`<name>` heading, the name followed by no further identifier character.
const hasHeading = (name) => new RegExp(`^#### \`${escapeRegExp(name)}(?![\\w$])`, 'm').test(readme)

describe('package exports', () => {
    it('declares the 1.9.0 subpaths', () => {
        expect(Object.keys(pkg.exports)).toEqual(expect.arrayContaining([
            '.', './values', './log', './config', './packages', './guard',
            './html', './lang', './dates', './sort', './urls', './frontmatter', './glob', './pages', './files',
        ]))
    })

    it.each(entries)('%s points at a file that exists and is published', (subpath, target) => {
        expect(fs.existsSync(path.join(root, target))).toBe(true)
        expect(shipped(target)).toBe(true)
    })

    it.each(entries)('%s loads by its package name and exports something', async (subpath) => {
        const module = await import(path.posix.join(pkg.name, subpath))
        expect(Object.keys(module).length).toBeGreaterThan(0)
    })

    it.each(subpaths)('every named export of %s has a README heading', async (subpath) => {
        const module = await import(path.posix.join(pkg.name, subpath))
        const missing = Object.keys(module).filter((name) => !hasHeading(name))
        expect(missing).toEqual([])
    })

    it.each(subpaths)('%s is listed in the README table', (subpath) => {
        expect(readme).toContain(`| \`${pkg.name}/${subpath.slice(2)}\` |`)
    })

    it('the heading check finds no heading for an unknown name', () => {
        expect(hasHeading('noSuchExport')).toBe(false)
        expect(hasHeading('isText')).toBe(true)
        // A name is not documented by a heading that only starts with it.
        expect(hasHeading('toDat')).toBe(false)
        expect(hasHeading('toDate')).toBe(true)
    })
})
