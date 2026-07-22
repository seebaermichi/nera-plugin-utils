# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


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
