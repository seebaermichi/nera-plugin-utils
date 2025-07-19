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
 * @param {string} [expectedPackageName] - Override for testing purposes (defaults to 'dummy')
 * @returns {boolean} - True if valid Nera project
 */
export function validateNeraProject(expectedPackageName = 'dummy') {
    const packageJsonPath = path.resolve(process.cwd(), 'package.json')

    if (!fs.existsSync(packageJsonPath)) {
        return false
    }

    try {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
        return pkg.name === expectedPackageName || pkg.name.startsWith('nera')
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
 * @returns {boolean} - True if templates were published successfully
 */
export function publishTemplates({
    pluginName,
    sourceDir,
    templateFiles,
    expectedPackageName
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

    // Check if destination already exists
    if (fs.existsSync(destinationDir)) {
        console.log(
            `⚠️ Templates already exist at ${destinationDir}. Skipping.`
        )
        return true
    }

    // Ensure templateFiles is an array
    const filesToCopy = Array.isArray(templateFiles)
        ? templateFiles
        : [templateFiles]

    try {
        // Create destination directory
        fs.mkdirSync(destinationDir, { recursive: true })

        // Copy each template file
        filesToCopy.forEach((templateFile) => {
            const sourcePath = path.resolve(sourceDir, templateFile)
            const destPath = path.resolve(destinationDir, templateFile)

            if (!fs.existsSync(sourcePath)) {
                console.error(`❌ Source template not found: ${sourcePath}`)
                return false
            }

            // Create subdirectories if needed
            fs.mkdirSync(path.dirname(destPath), { recursive: true })

            fs.copyFileSync(sourcePath, destPath)
            console.log(`✅ Copied ${templateFile} to ${destPath}`)
        })

        console.log(`✅ Templates copied to: ${destinationDir}`)
        return true
    } catch (error) {
        console.error(`❌ Failed to copy templates: ${error.message}`)
        return false
    }
}

/**
 * Publishes all .pug template files from a plugin's views directory
 * @param {Object} options - Configuration options
 * @param {string} options.pluginName - Name of the plugin (e.g., 'plugin-popular-content')
 * @param {string} options.sourceDir - Absolute path to the plugin's views directory
 * @param {string} [options.expectedPackageName] - Override for testing purposes
 * @returns {boolean} - True if templates were published successfully
 */
export function publishAllTemplates({
    pluginName,
    sourceDir,
    expectedPackageName
}) {
    try {
        // Get all .pug files from source directory
        const pugFiles = fs
            .readdirSync(sourceDir)
            .filter((file) => file.endsWith('.pug'))

        if (pugFiles.length === 0) {
            console.log('⚠️ No .pug template files found to publish.')
            return true
        }

        return publishTemplates({
            pluginName,
            sourceDir,
            templateFiles: pugFiles,
            expectedPackageName
        })
    } catch (error) {
        console.error(`❌ Error reading source directory: ${error.message}`)
        return false
    }
}
