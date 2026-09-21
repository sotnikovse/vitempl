# Vitempl

Vite-плагин: собирает шаблоны для серверного рендеринга (Handlebars, askama, Jinja) из компонентов Vue (SFC). Документация — в [docs](../../docs/index.md).

- Синтаксис Vue SFC, проверка типов props через vue-tsc и автодополнение в редакторе. Vue используется только при сборке и не попадает в результат.
- Сервер получает шаблоны со вставленными ссылками на собранные скрипты и стили и ничего не знает о Vite — достаточно рендерить шаблоны и раздавать статику.
- Шаблоны генерирует адаптер шаблонизатора. Есть адаптеры Handlebars, askama и Jinja, и при смене шаблонизатора исходники шаблонов не меняются.
- Сборка обходит импорты компонентов от страниц и фрагментов, и в результат попадают только используемые шаблоны.

## Части проекта

- `packages/` — пакеты vitempl, готовятся к переносу в отдельный репозиторий: Vite-плагин [vitempl](./packages/vitempl/README.md) и плагин ESLint [@vitempl/eslint-plugin](./packages/eslint-plugin/README.md)
- `examples/` — пример сборки шаблонов и сервера к ним, переедет вместе с vitempl: шаблоны [node-template-hbs](./examples/node-template-hbs/README.md) и сервер [node-app](./examples/node-app/README.md)
- `docs/` — [docs](./docs/index.md)

## Скрипты

- `npm run build` — сборка во всех workspace-ах, при наличии
- `npm run test` — запуск тестов во всех workspace-ах, где они есть
- `npm run typecheck` — проверка типов во всех workspace-ах, где она настроена
- `npm run docs:dev` — запуск документации в режиме разработки
- `npm run docs:build` — сборка документации
- `npm run docs:preview` — предпросмотр собранной документации
- `npm run example:build` — сборка шаблонов примера (`examples/node-template-hbs`)
- `npm run example:start` — запуск сервера примера (`examples/node-app`)

## Примеры

Пример шаблонов и сервера к ним:

```sh
npm run example:build
npm run example:start
```

## Лицензия

MIT
