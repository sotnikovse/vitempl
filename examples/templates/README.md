# templates

Шаблоны примера на Vue SFC и клиентская статика (стили, htmx). Vite-плагин [vitempl](../../packages/vitempl/README.md) собирает их в шаблоны для сервера. Исходники не зависят от шаблонизатора: он выбирается при сборке переменной `ENGINE`, а серверы примеров рендерят результат. Устройство примера — в [документации](../../docs/example.md).

| `ENGINE`                    | Результат                            | Сервер                            |
| --------------------------- | ------------------------------------ | --------------------------------- |
| `handlebars` (по умолчанию) | `dist/handlebars/{templates,public}` | [node-app](../node-app/README.md) |
| `askama`                    | `dist/askama/{templates,public}`     | —                                 |
| `jinja`                     | `dist/jinja/{templates,public}`      | —                                 |

Контракт данных между шаблонами и серверами описан в [`src/types.ts`](./src/types.ts), общие данные страниц лежат в [`../data`](../data).

## Скрипты

- `npm run build` — проверка типов и сборка в `dist/<ENGINE>/`, например `ENGINE=askama npm run build`
- `npm run dev` — сборка с пересборкой при изменении исходников (dev-режим)
- `npm run lint` — проверка шаблонов линтером для выбранного `ENGINE`
