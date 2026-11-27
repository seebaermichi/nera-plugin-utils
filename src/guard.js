/**
 * The core version guard (`@nera-static/plugin-utils/guard`). A plugin that
 * relies on a hook of a newer `@nera-static/core` (`getAssets` since 4.13.0)
 * is silently never called on an older one, and the build still exits 0. The
 * plugin checks core's version from `getAppData` and fails loudly instead;
 * `peerDependencies` reports the same at install time, this catches an
 * install that ignored it.
 */

import { createRequire } from 'node:module'
import { requireFromSite } from './packages.js'

/** The floor `assertCoreVersion` checks when none is given: the `getAssets` hook. */
export const GET_ASSETS_CORE = '4.13.0'

// `x.y.z` with an optional `-prerelease` and `+build` (ignored), surrounding
// whitespace allowed; `null` for anything else.
function parseVersion(version) {
    if (typeof version !== 'string') return null
    const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(version.trim())
    return match ? { numbers: match.slice(1, 4).map(Number), prerelease: match[4] !== undefined } : null
}

/**
 * Whether `version` is `floor` or later, by semver precedence: major, minor
 * and patch compared as numbers, and a prerelease (`4.13.0-beta.1`) below its
 * release. Surrounding whitespace is ignored. Anything that is no version is
 * `false`.
 *
 * @param {unknown} version
 * @param {string} floor a plain `x.y.z` version
 * @returns {boolean}
 * @throws {TypeError} when `floor` is not a plain `x.y.z` version
 */
export function satisfiesFloor(version, floor) {
    const need = parseVersion(floor)
    if (!need || need.prerelease) {
        throw new TypeError(`satisfiesFloor: floor must be a plain x.y.z version, got ${JSON.stringify(floor)}`)
    }
    const have = parseVersion(version)
    if (!have) return false
    for (let i = 0; i < 3; i++) {
        if (have.numbers[i] !== need.numbers[i]) return have.numbers[i] > need.numbers[i]
    }
    return !have.prerelease
}

/**
 * The version of `@nera-static/core` this build most likely runs on, or
 * `null` when it cannot be found. Resolved from the site root `cwd` first,
 * then, when given, from `from`: the plugin's `import.meta.url`, for a
 * symlinked plugin that resolves from its real path, where its devDependency
 * core answers for the site's. Without `from` only the site is asked.
 *
 * @param {{ cwd?: string, from?: string|URL }} [options]
 * @returns {string|null}
 */
export function coreVersion({ cwd = process.cwd(), from } = {}) {
    const requires = [() => requireFromSite(cwd)]
    if (from !== undefined) requires.push(() => createRequire(from))
    for (const make of requires) {
        try {
            const { version } = make()('@nera-static/core/package.json')
            if (typeof version === 'string') return version
        } catch {
            // Not found from here: ask the next one.
        }
    }
    return null
}

/**
 * Throw when core is known to be older than `need`. An unknown version passes:
 * some core is calling the plugin, and refusing on a guess would block a
 * working setup.
 *
 * @param {object} options
 * @param {string} options.plugin who is asking, verbatim (`'plugin-sitemap'`)
 * @param {string} [options.need] the floor (default `GET_ASSETS_CORE`)
 * @param {string} [options.why] what needs it (default `'the getAssets hook'`)
 * @param {string} [options.cwd] the site root, for `coreVersion`
 * @param {string|URL} [options.from] the plugin's `import.meta.url`, for `coreVersion`
 * @param {string|null} [options.version] core's version (default `coreVersion({ cwd, from })`)
 * @throws {Error} `<plugin>: @nera-static/core <version> is too old; it needs >= <need> (<why>). Update with …`
 */
export function assertCoreVersion({
    plugin,
    need = GET_ASSETS_CORE,
    why = 'the getAssets hook',
    cwd,
    from,
    version = coreVersion({ cwd, from }),
}) {
    if (version === null || satisfiesFloor(version, need)) return
    throw new Error(
        `${plugin}: @nera-static/core ${version} is too old; it needs >= ${need} (${why}). ` +
            'Update with `npm update @nera-static/nera` (or `@nera-static/core`).'
    )
}
