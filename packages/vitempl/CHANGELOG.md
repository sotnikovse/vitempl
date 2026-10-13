## [0.1.0](https://github.com/sotnikovse/vitempl/compare/v0.0.0...v0.1.0) (2026-09-21)

First release. A Vite plugin that builds server-side rendering templates from Vue single-file components.

### Features

* Vue SFC syntax with prop type checking via vue-tsc and editor autocompletion; Vue is a build-time tool only and does not end up in the output ([fb400be](https://github.com/sotnikovse/vitempl/commit/fb400beafcef8f9fc73fd564461dfa90a8bbfa40))
* Template engine adapters: Handlebars (`vitempl/handlebars`), askama (`vitempl/askama`) and Jinja (`vitempl/jinja`); template sources stay the same when the engine changes ([fb400be](https://github.com/sotnikovse/vitempl/commit/fb400beafcef8f9fc73fd564461dfa90a8bbfa40))
* Build walks component imports from pages and fragments, so only used templates are emitted ([fb400be](https://github.com/sotnikovse/vitempl/commit/fb400beafcef8f9fc73fd564461dfa90a8bbfa40))
* Templates get links to built scripts and styles inserted; the server needs no knowledge of Vite ([fb400be](https://github.com/sotnikovse/vitempl/commit/fb400beafcef8f9fc73fd564461dfa90a8bbfa40))
* `checkSource` API that validates template syntax for an engine, used by `@vitempl/eslint-plugin` ([fb400be](https://github.com/sotnikovse/vitempl/commit/fb400beafcef8f9fc73fd564461dfa90a8bbfa40))
