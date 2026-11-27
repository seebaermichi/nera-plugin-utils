# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.7.0] - 2026-11-27

The helpers that Nera plugins, core and the tools copy from each other now
live here, one subpath export per family. Nothing in `.` changed, and no
dependency was added (still `js-yaml` only). Each subpath is documented in
the README under "Shared helpers".

### Added

-   **`@nera-static/plugin-utils/values`**: `isPlainObject(value)` (prototype
    `Object.prototype` or `null`; arrays, `Date`, `Map` and class instances
    are not plain), `isText(value)` (a string with a non-whitespace
    character) and `textOr(value, fallback)` (the trimmed string, else
    `fallback`)
-   **`@nera-static/plugin-utils/log`**: `createLogger(name, { sink })` with
    `warn`, `info` and the page-scoped `page(page, what, todo)`, printing
    `⚠️ <name>: …` (`ℹ️ ` for `info`)
-   **`@nera-static/plugin-utils/config`**: `getConfig` (the same function as
    in `.`), `loadPluginConfig(name, { cwd, app })`, which honours
    `app.folders.config`, and `createConfigReader({ file, defaults, readers,
    warn })` with the fleet's one message set and a date-aware `show()`.
    Unknown keys are found with `Object.hasOwn`, so a YAML key
    `constructor:` or `toString:` now warns as unknown instead of slipping
    into the config, as it did in every plugin's own reader
-   **`@nera-static/plugin-utils/packages`**: `requireFromSite(cwd)`, a
    `require` that resolves from the site root, and
    `ownVersion(import.meta.url)`, the calling package's version
-   **`@nera-static/plugin-utils/guard`**: `assertCoreVersion({ plugin, need,
    why, cwd, from, version })`, `coreVersion({ cwd, from })`,
    `satisfiesFloor(version, floor)` (a prerelease sorts below its release)
    and `GET_ASSETS_CORE` (`'4.13.0'`), the core version guard five plugins
    carried as identical copies

### Changed

-   **every built-in module is imported with the `node:` prefix**, enforced by
    a lint rule; the README examples follow it

### Fixed

-   **`resolveViewsDir` and `resolveAssetsDir` (and so `publishTemplates`,
    `publishAllTemplates` and `publishAsset`) now follow core's `themeOnly`
    rule.** On a site whose `config/app.yaml` sets `theme:` and which has
    neither a `theme/` nor a root `views/` folder, they resolved to the
    deprecated root `views/` / `assets/`; core uses `theme/views` /
    `theme/assets` there. `npm run publish-template` therefore wrote
    `views/vendor/…`, and the new root `views/` switched the build into the
    deprecated layout. Both now return the `theme/` folder, as core does


## [1.6.1] - 2026-10-08

Documentation only — no code changed.

### Fixed

-   **`README.md` Compatibility still listed `js-yaml ^4.1.0`** as the runtime
    dependency; 1.6.0 moved to `js-yaml ^5.2.2`.
-   **The `bin/publish-template.js` example put a comment above the
    `#!/usr/bin/env node` line.** A hashbang is only valid as the very first
    line, so a script copied verbatim failed with a `SyntaxError`.
-   **"Themed site" is now defined where the publish destination is
    described** — a site with a local `theme/` folder, which is what
    `nera new` scaffolds — so plugin authors know which destination their
    users get

## [1.6.0] - 2026-07-27

### Changed

-   **js-yaml 4 → 5.** `getConfig` returns the same shapes it always did for
    every construct a Nera config uses — verified by parsing all 96 YAML files
    across the ecosystem under both versions and diffing the results. One
    difference is worth knowing about: a bare date scalar (`published:
    2026-07-27`) now parses as the string `'2026-07-27'` rather than a `Date`.
    No packaged plugin config declares a date field, so this only affects you
    if you put one in your own `config/<plugin>.yaml` and relied on getting a
    `Date` back

### Fixed

-   **a config file containing only comments no longer throws.** js-yaml 5
    rejects a document with no content, where 4 returned `undefined`. Plugins
    ship their config with every key commented out — that is how the defaults
    are documented — so upgrading would have crashed the build of any site
    that copied one of those files verbatim. Such a file is now treated as an
    absent config and yields `{}`, as before. The same applies to an empty or
    whitespace-only file. Genuinely malformed YAML still throws

## [1.5.0] - 2026-07-24

### Added

-   **`resolveViewsDir(cwd?)`** and **`resolveAssetsDir(cwd?)`** — return the
    project's presentation directories the same way the generator does
    (`core.js`): an explicit `folders.<key>` in `config/app.yaml` wins;
    otherwise `theme/views` / `theme/assets` when a local `theme/` folder
    exists; otherwise the deprecated root `views/` / `assets/`

-   **`publishAsset({ sourceFile, targetPath, force?, expectedPackageName? })`**
    — publishes a single support file (e.g. a plugin's client script) into the
    resolved assets folder, theme-aware, with the same skip-if-exists rule as
    `publishTemplates`. Plugins that ship a runtime asset alongside their
    templates (`plugin-search`, `plugin-contact-form`) should copy it through
    here instead of a hand-rolled root `assets/` copy

### Changed

-   **`publishTemplates` / `publishAllTemplates` now publish theme-aware.** The
    destination is `resolveViewsDir()/vendor/<plugin>` rather than a hardcoded
    root `views/vendor/<plugin>`. On a themed site (a local `theme/` folder, so
    the build renders from `theme/views`) templates now land in
    `theme/views/vendor/…`, where the generator's layered resolver actually
    looks — publishing to root `views/vendor/` left the includes silently
    resolving to nothing. Sites with no `theme/` folder are unchanged, so this
    is additive rather than breaking


## [1.4.0] - 2026-07-22

### Added

-   **`slugify(text)`** — turns a user-authored string into a URL-safe slug,
    for anything that becomes a path segment, an HTML `id`, or a URL fragment.
    `ß` → `ss`, NFKD with combining marks dropped, lowercase, runs of
    non-alphanumerics collapsed to a single `-`, leading and trailing hyphens
    trimmed. Idempotent; returns `''` when nothing usable remains

    It lives here because two plugins had already written it independently and
    only one got it right. The naive rule, `[^\w]+` → `-`, is ASCII-only:
    `Über uns` becomes `-ber-uns` and `Straße` becomes `stra-e`. A leading
    hyphen is legal in an HTML `id` but is **not a valid CSS identifier**, so
    `#-ber-uns` matches nothing in a stylesheet and `querySelector` throws on
    it. That shipped in `plugin-one-page` until its v3.0.0

    Purely additive — no existing export changed. `plugin-tags`' `slugifyTag`
    and `plugin-one-page`'s internal helper both delegate here as of
    `plugin-tags` 3.2.1 and `plugin-one-page` 3.0.1, and both keep producing
    byte-identical output; their test suites are reproduced here to prove it

## [1.3.1] - 2026-07-21

### Fixed

-   corrected the "Example Plugin Structure" snippet in the README, which
    taught the plugin contract wrongly in three ways: it used the signature
    `getAppData(app)` instead of `getAppData(data)`, returned a bare object
    instead of spreading `...data.app` (which silently discards every other
    plugin's `app` data sitewide), and resolved config against `__dirname`,
    which is undefined in ESM and points at the package rather than the
    user's site
-   documented that `getConfig` returns `{}` for a missing or empty file and
    never throws, so plugins must supply a JS fallback for every key
-   corrected `validateNeraProject`'s description: a `package.json` is
    required unconditionally; the shape check is an alternative to the *name*
    check, not to having a `package.json`
-   documented that `publishAllTemplates` returns `true` when `sourceDir`
    contains no `.pug` files, so a misconfigured publish script exits `0`
    having copied nothing

### Added

-   `## 🧩 Compatibility`, `## 🧪 Development` and `## 🤝 Contributing`
    sections; the Node requirement was previously stated nowhere

### Changed

-   License heading uses the fleet-standard `## 📦 License`


## [1.3.0] - 2026-07-21

### Changed

-   raised minimum Node from 18 to 20; Node 18 reached end-of-life on
    2025-04-30 and the dev toolchain requires Node 20+


## [1.2.0] - 2026-07-19

### Fixed

-   `publishAllTemplates` now publishes templates in subdirectories.
    Plugins whose views use `partials/` or `helper/` previously shipped
    top-level templates that could not compile
-   `publishTemplates` no longer reports success when a source template
    is missing. Sources are now all verified before anything is copied,
    so a failure cannot leave a partially published destination

### Added

-   `force` option on `publishTemplates` and `publishAllTemplates` to
    re-publish over an existing `views/vendor/<plugin>/` directory. The
    default remains skip-if-exists, so local edits are never discarded
    unless explicitly requested
-   `validateNeraProject` now also accepts any directory containing both
    `config/app.yaml` and `pages/`, so projects not named `nera*` work.
    The existing package-name check is retained as an alternative


## [1.1.0] - 2025-07-19

### Added

-   `publishAllTemplates` for publishing every `.pug` file in a plugin's
    views directory without listing them individually


## [1.0.5] - 2025-07-14

## [1.0.4] - 2025-07-13

## [1.0.3] - 2025-07-11

## [1.0.2] - 2025-07-11

## [1.0.1] - 2025-07-11

## [1.0.0] - 2025-07-11

Releases up to and including 1.0.5 pre-date this changelog. Dates are
taken from the npm registry; per-release contents were not recorded at
the time and have not been reconstructed here.
