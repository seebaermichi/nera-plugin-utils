import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { walkFiles } from '../src/files.js'

let root

// Write `files` (paths relative to `root`, `/`-separated) with their folders.
const touch = (...files) => {
    for (const file of files) {
        const full = path.join(root, ...file.split('/'))
        mkdirSync(path.dirname(full), { recursive: true })
        writeFileSync(full, file)
    }
}

// The platform form of `/`-separated relative paths.
const native = (...files) => files.map((file) => path.join(...file.split('/')))

beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'plugin-utils-files-'))
})

afterEach(() => {
    rmSync(root, { recursive: true, force: true })
})

describe('walkFiles', () => {
    it('lists depth first, the entries of each folder in byte order', () => {
        // `a` sorts before `a.md`, so its files come first; uppercase before
        // lowercase, `_` between them. (No names differing only in case: the
        // default macOS file system would make them one file.)
        touch('b.md', 'a.md', 'a/z.md', 'a/b/c.md', 'C.md', '_x.md', 'é.md', 'e.md')

        expect(walkFiles(root, { relative: true })).toEqual(
            native('C.md', '_x.md', 'a/b/c.md', 'a/z.md', 'a.md', 'b.md', 'e.md', 'é.md'),
        )
    })

    it('skips dotfiles and dot folders by default', () => {
        touch('index.md', '.draft.md', '.hidden/a.md', 'blog/.gitkeep', 'blog/post.md')

        expect(walkFiles(root, { relative: true })).toEqual(native('blog/post.md', 'index.md'))
    })

    it('lists dotfiles and walks dot folders with `dotfiles: true`', () => {
        touch('index.md', '.draft.md', '.hidden/a.md', 'blog/.gitkeep', 'blog/post.md')

        expect(walkFiles(root, { relative: true, dotfiles: true })).toEqual(
            native('.draft.md', '.hidden/a.md', 'blog/.gitkeep', 'blog/post.md', 'index.md'),
        )
    })

    it('returns absolute paths by default', () => {
        touch('a.css', 'img/b.png')

        expect(walkFiles(root)).toEqual([path.join(root, 'a.css'), path.join(root, 'img', 'b.png')])
    })

    it('resolves a relative `dir` against the working directory', () => {
        touch('a.css')
        const relativeRoot = path.relative(process.cwd(), root)

        expect(walkFiles(relativeRoot)).toEqual([path.join(root, 'a.css')])
        expect(walkFiles(relativeRoot, { relative: true })).toEqual(['a.css'])
    })

    it('keeps only the given extension, compared exactly', () => {
        touch('a.md', 'b.MD', 'c.markdown', 'd.txt', 'md', 'sub/e.md')

        expect(walkFiles(root, { relative: true, ext: '.md' })).toEqual(native('a.md', 'sub/e.md'))
        expect(walkFiles(root, { relative: true, ext: ['.md', '.markdown'] })).toEqual(
            native('a.md', 'c.markdown', 'sub/e.md'),
        )
        expect(walkFiles(root, { relative: true, ext: 'md' })).toEqual([])
    })

    it('gives [] for a folder that does not exist or is a file', () => {
        touch('a.md')

        expect(walkFiles(path.join(root, 'missing'))).toEqual([])
        expect(walkFiles(path.join(root, 'a.md'))).toEqual([])
    })

    it('lists nothing for an empty folder', () => {
        mkdirSync(path.join(root, 'empty'))

        expect(walkFiles(root)).toEqual([])
    })

    describe('symbolic links', () => {
        it('lists a linked file under the link name and walks a linked folder', () => {
            touch('target/a.md', 'file.md')
            symlinkSync(path.join(root, 'target'), path.join(root, 'linked'), 'dir')
            symlinkSync(path.join(root, 'file.md'), path.join(root, 'alias.md'))

            expect(walkFiles(root, { relative: true })).toEqual(
                native('alias.md', 'file.md', 'linked/a.md', 'target/a.md'),
            )
        })

        it('walks a folder linked twice under both names', () => {
            touch('target/a.md')
            symlinkSync(path.join(root, 'target'), path.join(root, 'one'), 'dir')
            symlinkSync(path.join(root, 'target'), path.join(root, 'two'), 'dir')

            expect(walkFiles(root, { relative: true })).toEqual(
                native('one/a.md', 'target/a.md', 'two/a.md'),
            )
        })

        it('skips a dangling link', () => {
            touch('a.md')
            symlinkSync(path.join(root, 'gone.md'), path.join(root, 'dangling.md'))
            symlinkSync(path.join(root, 'gone'), path.join(root, 'dangling'), 'dir')

            expect(walkFiles(root, { relative: true })).toEqual(['a.md'])
        })

        it('does not loop on a link back to an ancestor', () => {
            touch('a/b.md')
            symlinkSync(root, path.join(root, 'a', 'up'), 'dir')
            symlinkSync(path.join(root, 'a'), path.join(root, 'a', 'self'), 'dir')

            expect(walkFiles(root, { relative: true })).toEqual(native('a/b.md'))
        })

        it('walks a linked root', () => {
            touch('target/a.md')
            const link = path.join(root, 'link')
            symlinkSync(path.join(root, 'target'), link, 'dir')

            expect(walkFiles(link)).toEqual([path.join(link, 'a.md')])
        })
    })
})
