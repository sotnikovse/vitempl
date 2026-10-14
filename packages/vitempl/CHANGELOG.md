## <small>[0.1.3](https://github.com/sotnikovse/vitempl/compare/v0.1.2...v0.1.3) (2026-10-14)</small>
### Bug Fixes

* **vitempl:** hide template engine tags from Vite while it parses a page ([#20](https://github.com/sotnikovse/vitempl/issues/20)) ([c6d2860](https://github.com/sotnikovse/vitempl/commit/c6d28603efc844c7e98af7955ec2f3fd9457a848))
* **vitempl:** typed None for null props in askama ([#19](https://github.com/sotnikovse/vitempl/issues/19)) ([73da2f5](https://github.com/sotnikovse/vitempl/commit/73da2f5a92200b7ab645860bfdacfbec2e93b4af))

## <small>[0.1.2](https://github.com/sotnikovse/vitempl/compare/v0.1.1...v0.1.2) (2026-10-13)</small>
### Features

* **vitempl:** client scripts in SFC via a plain <script> block ([#13](https://github.com/sotnikovse/vitempl/issues/13)) ([a3ce7cf](https://github.com/sotnikovse/vitempl/commit/a3ce7cf1b5cb1ab462509534116680f30d7c3b37))
* **vitempl:** conditional attribute from a ternary with undefined or null ([#12](https://github.com/sotnikovse/vitempl/issues/12)) ([22f225d](https://github.com/sotnikovse/vitempl/commit/22f225d07b10e1371d79f842bd5e5a7db7cc22f0))

### Bug Fixes

* **vitempl:** compile null and undefined in component props ([#11](https://github.com/sotnikovse/vitempl/issues/11)) ([847ed3c](https://github.com/sotnikovse/vitempl/commit/847ed3c43ea644314b380c961babb325021fbca6))
* **vitempl:** put space before conditional boolean attribute outside the tag ([#10](https://github.com/sotnikovse/vitempl/issues/10)) ([a94569a](https://github.com/sotnikovse/vitempl/commit/a94569aea7f803a3e031034a011ef85432f71561))

### Documentation

* use absolute links to the docs in package READMEs ([#14](https://github.com/sotnikovse/vitempl/issues/14)) ([de3178c](https://github.com/sotnikovse/vitempl/commit/de3178c3c04c109d293f82cb97904fb9ce426719))

### Miscellaneous Chores

* deps upgrade ([de9c31b](https://github.com/sotnikovse/vitempl/commit/de9c31b13949a0305d8f9f316b44e1c831e76b5f))

## <small>[0.1.1](https://github.com/sotnikovse/vitempl/compare/v0.1.0...v0.1.1) (2026-10-13)</small>
### Miscellaneous Chores

* init changelogs ([b5aee06](https://github.com/sotnikovse/vitempl/commit/b5aee06d15f4b5bc60c5c6867a0b864dba9b34b2))
* vitempl release fix ([8640fa6](https://github.com/sotnikovse/vitempl/commit/8640fa686b7daf5331374aabd9248a8081878de7))

## [0.1.0](https://github.com/sotnikovse/vitempl/compare/v0.0.0...v0.1.0) (2026-09-21)

First release. A Vite plugin that builds server-side rendering templates from Vue single-file components.

### Features

* Vue SFC syntax with prop type checking via vue-tsc and editor autocompletion; Vue is a build-time tool only and does not end up in the output ([fb400be](https://github.com/sotnikovse/vitempl/commit/fb400beafcef8f9fc73fd564461dfa90a8bbfa40))
* Template engine adapters: Handlebars (`vitempl/handlebars`), askama (`vitempl/askama`) and Jinja (`vitempl/jinja`); template sources stay the same when the engine changes ([fb400be](https://github.com/sotnikovse/vitempl/commit/fb400beafcef8f9fc73fd564461dfa90a8bbfa40))
* Build walks component imports from pages and fragments, so only used templates are emitted ([fb400be](https://github.com/sotnikovse/vitempl/commit/fb400beafcef8f9fc73fd564461dfa90a8bbfa40))
* Templates get links to built scripts and styles inserted; the server needs no knowledge of Vite ([fb400be](https://github.com/sotnikovse/vitempl/commit/fb400beafcef8f9fc73fd564461dfa90a8bbfa40))
* `checkSource` API that validates template syntax for an engine, used by `@vitempl/eslint-plugin` ([fb400be](https://github.com/sotnikovse/vitempl/commit/fb400beafcef8f9fc73fd564461dfa90a8bbfa40))
