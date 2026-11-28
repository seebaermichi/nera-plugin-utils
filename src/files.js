/**
 * Listing the files under a folder, shared by every Nera plugin and tool
 * (`@nera-static/plugin-utils/files`).
 *
 * One walker for the two ways `@nera-static/core` lists files: the pages
 * folder (dotfiles skipped, names relative to the folder, as the
 * `fs-readdir-recursive` package did) and an assets folder (dotfiles kept,
 * absolute paths). Both orders are the same: depth first, the entries of each
 * folder sorted by their bytes, as libuv's `readdir` returns them on POSIX.
 */
import fs from 'node:fs'
import path from 'node:path'

// Byte order of two entry names, the order libuv's `scandir` sorts by
// (`strcmp`), so the result is the same on every file system and platform.
const byBytes = (a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b))

// The extensions a file may have, from the `ext` option.
const extensionList = (ext) => {
    if (ext === undefined) return null
    return Array.isArray(ext) ? ext : [ext]
}

/**
 * Every file under `dir`, depth first, the entries of each folder in byte
 * order. Symbolic links are followed: a linked file is listed under the link's
 * name, a linked folder is walked, a dangling link is skipped, and a link back
 * to a folder that is already being walked (an ancestor, or the folder
 * itself) is not walked again, so a loop ends. Only regular files are listed;
 * sockets, FIFOs and devices are not. A `dir` that does not exist or is no
 * folder gives `[]`.
 *
 * @param {string} dir the folder to walk
 * @param {object} [options]
 * @param {boolean} [options.dotfiles=false] list entries whose name starts
 *     with `.`; when `false`, a dot folder is not entered either
 * @param {string|string[]} [options.ext] keep only files with this extension
 *     (or one of these), compared exactly with `path.extname`: `'.md'`, not
 *     `'md'`, and `'.MD'` is another extension
 * @param {boolean} [options.relative=false] paths relative to `dir` (with the
 *     platform separator) instead of absolute ones
 * @returns {string[]}
 * @example walkFiles('pages', { relative: true }) // ['blog/a.md', 'index.md']
 */
export function walkFiles(dir, { dotfiles = false, ext, relative = false } = {}) {
    const root = path.resolve(dir)
    const extensions = extensionList(ext)
    const files = []

    const walk = (folder, ancestors) => {
        let real
        try {
            real = fs.realpathSync(folder)
        } catch {
            return
        }
        if (ancestors.has(real)) return
        const inside = new Set(ancestors).add(real)

        const names = fs.readdirSync(folder).sort(byBytes)
        for (const name of names) {
            if (!dotfiles && name.startsWith('.')) continue
            const full = path.join(folder, name)
            let stat
            try {
                stat = fs.statSync(full)
            } catch {
                continue
            }
            if (stat.isDirectory()) {
                walk(full, inside)
            } else if (stat.isFile() && (!extensions || extensions.includes(path.extname(name)))) {
                files.push(relative ? path.relative(root, full) : full)
            }
        }
    }

    if (fs.statSync(root, { throwIfNoEntry: false })?.isDirectory()) walk(root, new Set())
    return files
}
