/**
 * The one prefix for every message a Nera plugin or tool prints
 * (`@nera-static/plugin-utils/log`), so a site owner can tell in a build log
 * full of other plugins where a warning came from.
 */

/**
 * A logger whose messages start with `name`, taken verbatim
 * (`'plugin-sitemap'`, `'validate'`):
 *
 * - `warn(msg)` prints `⚠️ <name>: <msg>` through `sink.warn`;
 * - `info(msg)` prints `ℹ️ <name>: <msg>` through `sink.info`;
 * - `page(page, what, todo)` warns about one page:
 *   `⚠️ <name>: <page>: <what> — <todo>`.
 *
 * @param {string} name who is speaking
 * @param {{ sink?: { warn: (msg: string) => void, info: (msg: string) => void } }} [options]
 *     where the lines go (default `console`; a test passes its own)
 * @returns {{ warn: (msg: string) => void, info: (msg: string) => void,
 *     page: (page: string, what: string, todo: string) => void }}
 */
export function createLogger(name, { sink = console } = {}) {
    const warn = (msg) => sink.warn(`⚠️ ${name}: ${msg}`)
    return {
        warn,
        info: (msg) => sink.info(`ℹ️ ${name}: ${msg}`),
        page: (page, what, todo) => warn(`${page}: ${what} — ${todo}`),
    }
}
