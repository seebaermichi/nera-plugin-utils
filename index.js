import fs from 'fs'
import path from 'path'
import yaml from 'js-yaml'

export function getConfig(filePath) {
    if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8')
        return yaml.load(content) || {}
    }
    return {}
}

/**
 * Turns a user-authored string into a URL-safe slug, for anything that becomes
 * a path segment, an HTML `id`, or a URL fragment.
 *
 * Lives here because plugins kept reinventing it and getting it wrong. The
 * naive rule — `text.toLowerCase().replace(/[^\w]+/g, '-')` — is ASCII-only:
 * `\w` is `[A-Za-z0-9_]`, so `Über uns` becomes `-ber-uns` and `Straße`
 * becomes `stra-e`. A leading hyphen is legal in an HTML `id` but is **not** a
 * valid CSS identifier, so `#-ber-uns` matches nothing in a stylesheet and
 * `document.querySelector('#-ber-uns')` throws. That shipped in
 * `plugin-one-page` until v3.0.0.
 *
 * The rule:
 *   1. `ß` → `ss` first, because it has no NFKD decomposition and would
 *      otherwise become a hyphen mid-word. The expansion is the same in every
 *      language that uses it.
 *   2. NFKD, then drop combining marks, so `é` → `e` rather than a hyphen.
 *   3. Lowercase, collapse every remaining run of non-alphanumerics to a
 *      single `-`, and trim leading and trailing hyphens.
 *
 * A string with no Latin letters or digits (`日本語`, `!!!`) yields `''`.
 * Callers must decide what that means — omitting the element is usually better
 * than emitting an empty `id`.
 *
 * @param {string} text - The string to slugify
 * @returns {string} - URL-safe slug, or `''` if nothing usable remains
 */
export function slugify(text) {
    return String(text)
        .replace(/ß/g, 'ss')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
}

/**
 * Validates if the current working directory is a valid Nera project
 *
 * A directory qualifies if it *looks* like a Nera project — it contains both
 * `config/app.yaml` and `pages/` — or if its package name matches. The shape
 * check is the primary signal; the name check is retained so that projects
 * scaffolded before this release, and the `expectedPackageName` test
 * override, keep working.
 *
 * @param {string} [expectedPackageName] - Override for testing purposes (defaults to 'dummy')
 * @returns {boolean} - True if valid Nera project
 */
export function validateNeraProject(expectedPackageName = 'dummy') {
    const packageJsonPath = path.resolve(process.cwd(), 'package.json')

    if (!fs.existsSync(packageJsonPath)) {
        return false
    }

    const looksLikeNeraProject =
        fs.existsSync(path.resolve(process.cwd(), 'config/app.yaml')) &&
        fs.existsSync(path.resolve(process.cwd(), 'pages'))

    try {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
        return (
            looksLikeNeraProject ||
            pkg.name === expectedPackageName ||
            pkg.name.startsWith('nera')
        )
    } catch (e) {
        console.error(`❌ Error reading package.json: ${e.message}`)
        return false
    }
}

/**
 * Resolves the project's presentation directory for `views` or `assets`, the
 * same way the generator does (core.js), so a plugin publishes where the build
 * will actually look:
 *
 *   1. An explicit `folders.<key>` in config/app.yaml always wins.
 *   2. Otherwise, if a local `theme/` folder exists, it is `theme/<key>` — the
 *      generator renders themed sites from `theme/views` and serves from
 *      `theme/assets`, and a plugin's files are the site's own override layer,
 *      so they belong there.
 *   3. Otherwise the deprecated root `<key>/`, byte-identical to before the
 *      theme system existed.
 *
 * @param {string} cwd - Project root
 * @param {'views'|'assets'} key - Which presentation folder to resolve
 * @returns {string} - Absolute path to the resolved directory
 */
function resolvePresentationDir(cwd, key) {
    const appConfig = getConfig(path.resolve(cwd, 'config/app.yaml'))
    const explicit = appConfig?.folders?.[key]

    if (typeof explicit === 'string' && explicit.trim()) {
        return path.resolve(cwd, explicit)
    }

    if (fs.existsSync(path.resolve(cwd, 'theme'))) {
        return path.resolve(cwd, 'theme', key)
    }

    return path.resolve(cwd, key)
}

/**
 * The project's views directory — `theme/views` on a themed site, the
 * deprecated root `views` otherwise (or whatever `folders.views` in
 * config/app.yaml points to). Published templates land under its `vendor/`.
 *
 * @param {string} [cwd] - Project root (defaults to process.cwd())
 * @returns {string} - Absolute path to the views directory
 */
export function resolveViewsDir(cwd = process.cwd()) {
    return resolvePresentationDir(cwd, 'views')
}

/**
 * The project's assets directory — `theme/assets` on a themed site, the
 * deprecated root `assets` otherwise (or whatever `folders.assets` in
 * config/app.yaml points to). Published support files (e.g. a client script)
 * land under it.
 *
 * @param {string} [cwd] - Project root (defaults to process.cwd())
 * @returns {string} - Absolute path to the assets directory
 */
export function resolveAssetsDir(cwd = process.cwd()) {
    return resolvePresentationDir(cwd, 'assets')
}

/**
 * Publishes template files from a plugin to a Nera project
 * @param {Object} options - Configuration options
 * @param {string} options.pluginName - Name of the plugin (e.g., 'plugin-popular-content')
 * @param {string} options.sourceDir - Absolute path to the plugin's views directory
 * @param {string|string[]} options.templateFiles - Single file or array of template files to copy
 * @param {string} [options.expectedPackageName] - Override for testing purposes
 * @param {boolean} [options.force] - Re-publish over an existing destination, discarding local edits
 * @returns {boolean} - True if templates were published successfully
 */
export function publishTemplates({
    pluginName,
    sourceDir,
    templateFiles,
    expectedPackageName,
    force = false
}) {
    // Validate Nera project
    if (!validateNeraProject(expectedPackageName)) {
        console.error(
            '❌ Please run this command from the root of your Nera project (where the plugin is installed).'
        )
        return false
    }

    // Resolve the views dir the same way the build does: `theme/views/vendor`
    // on a themed site, root `views/vendor` otherwise. Publishing to root on a
    // themed site put files where the layered resolver never looks, so the
    // includes silently found nothing.
    const destinationDir = path.join(resolveViewsDir(), 'vendor', pluginName)

    // Check if destination already exists. Overwriting by default would
    // discard the customizations that publishing exists to enable, so the
    // skip stays and `force` is opt-in.
    if (fs.existsSync(destinationDir) && !force) {
        console.log(
            `⚠️ Templates already exist at ${destinationDir}. Skipping.\n` +
                '    Re-run with --force to overwrite (this will discard your edits).'
        )
        return true
    }

    // Ensure templateFiles is an array
    const filesToCopy = Array.isArray(templateFiles)
        ? templateFiles
        : [templateFiles]

    // Verify every source exists before creating anything. Failing mid-copy
    // would leave a partial destination directory, which the skip above would
    // then treat as already published on the next run.
    const missing = filesToCopy.filter(
        (templateFile) => !fs.existsSync(path.resolve(sourceDir, templateFile))
    )

    if (missing.length > 0) {
        for (const templateFile of missing) {
            console.error(
                `❌ Source template not found: ${path.resolve(sourceDir, templateFile)}`
            )
        }
        return false
    }

    try {
        // Create destination directory
        fs.mkdirSync(destinationDir, { recursive: true })

        // Copy each template file
        for (const templateFile of filesToCopy) {
            const sourcePath = path.resolve(sourceDir, templateFile)
            const destPath = path.resolve(destinationDir, templateFile)

            // Create subdirectories if needed
            fs.mkdirSync(path.dirname(destPath), { recursive: true })

            fs.copyFileSync(sourcePath, destPath)
            console.log(`✅ Copied ${templateFile} to ${destPath}`)
        }

        console.log(`✅ Templates copied to: ${destinationDir}`)
        return true
    } catch (error) {
        console.error(`❌ Failed to copy templates: ${error.message}`)
        return false
    }
}

/**
 * Recursively collects .pug files under a directory, as paths relative to it.
 * @param {string} dir - Directory to walk
 * @param {string} [relativeTo] - Root the returned paths are relative to
 * @returns {string[]} - Relative paths of every .pug file found
 */
function collectPugFiles(dir, relativeTo = dir) {
    return fs
        .readdirSync(dir, { withFileTypes: true })
        .flatMap((entry) => {
            const entryPath = path.resolve(dir, entry.name)

            if (entry.isDirectory()) {
                return collectPugFiles(entryPath, relativeTo)
            }

            return entry.name.endsWith('.pug')
                ? [path.relative(relativeTo, entryPath)]
                : []
        })
}

/**
 * Publishes all .pug template files from a plugin's views directory,
 * including those in subdirectories, preserving their structure.
 * @param {Object} options - Configuration options
 * @param {string} options.pluginName - Name of the plugin (e.g., 'plugin-popular-content')
 * @param {string} options.sourceDir - Absolute path to the plugin's views directory
 * @param {string} [options.expectedPackageName] - Override for testing purposes
 * @param {boolean} [options.force] - Re-publish over an existing destination, discarding local edits
 * @returns {boolean} - True if templates were published successfully
 */
export function publishAllTemplates({
    pluginName,
    sourceDir,
    expectedPackageName,
    force = false
}) {
    try {
        // Walk the whole tree: templates that `include partials/...` are
        // useless without the nested files they depend on.
        const pugFiles = collectPugFiles(sourceDir)

        if (pugFiles.length === 0) {
            console.log('⚠️ No .pug template files found to publish.')
            return true
        }

        return publishTemplates({
            pluginName,
            sourceDir,
            templateFiles: pugFiles,
            expectedPackageName,
            force
        })
    } catch (error) {
        console.error(`❌ Error reading source directory: ${error.message}`)
        return false
    }
}

/**
 * Publishes a single support file — a plugin's client script, say — into the
 * project's assets folder, theme-aware and with the same skip-if-exists rule as
 * publishTemplates. Plugins that ship a runtime asset alongside their templates
 * (e.g. plugin-search, plugin-contact-form) should copy it through here so it
 * lands next to the templates (`theme/assets` on a themed site) instead of a
 * hand-rolled root `assets/` copy that a themed build never serves.
 *
 * @param {Object} options - Configuration options
 * @param {string} options.sourceFile - Absolute path to the file to copy
 * @param {string} options.targetPath - Destination relative to the assets root,
 *     e.g. `js/contact-form.js`
 * @param {string} [options.expectedPackageName] - Override for testing purposes
 * @param {boolean} [options.force] - Overwrite an existing file, discarding edits
 * @returns {boolean} - True on success, including a deliberate skip
 */
export function publishAsset({
    sourceFile,
    targetPath,
    expectedPackageName,
    force = false
}) {
    if (!validateNeraProject(expectedPackageName)) {
        console.error(
            '❌ Please run this command from the root of your Nera project (where the plugin is installed).'
        )
        return false
    }

    if (!fs.existsSync(sourceFile)) {
        console.error(`❌ Source asset not found: ${sourceFile}`)
        return false
    }

    const destPath = path.join(resolveAssetsDir(), targetPath)
    // Shown relative to the project root so the message reads the same whether
    // the file went to `theme/assets/…` or the deprecated root `assets/…`.
    const shownPath = path.relative(process.cwd(), destPath)

    // Same rule as publishTemplates: never clobber a user's edited copy.
    if (fs.existsSync(destPath) && !force) {
        console.log(
            `⚠️  ${shownPath} already exists — skipping.\n` +
                '    Re-run with --force to overwrite (this will discard your edits).'
        )
        return true
    }

    try {
        fs.mkdirSync(path.dirname(destPath), { recursive: true })
        fs.copyFileSync(sourceFile, destPath)
        console.log(`✅ Copied ${path.basename(sourceFile)} to ${shownPath}`)
        return true
    } catch (error) {
        console.error(`❌ Failed to copy asset: ${error.message}`)
        return false
    }
}
