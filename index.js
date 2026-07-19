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

    const destinationDir = path.resolve(
        process.cwd(),
        `views/vendor/${pluginName}/`
    )

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
