# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


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
