# node-template-hbs

Пример шаблонов на Vue SFC и клиентской статики (стили, htmx); собираются Vite-плагином vitempl из [packages/vitempl](../../packages/vitempl/README.md) в шаблоны Handlebars. Рендерит их [node-app](../node-app/README.md). Устройство примера, шаблонов и сборки — в [документации vitempl](../../packages/vitempl/docs/example.md).

## Скрипты

- `npm run build` — проверка типов и сборка в `dist/`
- `npm run dev` — сборка с пересборкой при изменении исходников (dev-режим)
- `npm run lint` — проверка шаблонов линтером
