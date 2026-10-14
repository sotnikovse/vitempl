# axum-app

Пример SSR-сервера на Rust (axum + askama) для шаблонов из [templates](../templates/README.md). Те же маршруты и поведение, что у [node-app](../node-app/README.md): страницы, вход по куке, фрагмент списка для htmx, раздача статики.

Шаблоны собирает vitempl для askama в `templates/dist/askama/templates`, а askama **компилирует их в бинарник**: путь задан в [`askama.toml`](./askama.toml), статику сервер раздаёт из `templates/dist/askama/public`. Поэтому шаблоны нужно собрать до `cargo build`, и при их изменении пересобрать сервер.

## Как устроено

- Каждая страница и фрагмент — структура с `#[derive(Template)]` в [`src/main.rs`](./src/main.rs). Поля структуры — данные шаблона, и askama при компиляции проверяет, что шаблон обращается только к существующим полям. Структуры в [`src/data.rs`](./src/data.rs) повторяют контракт из [`templates/src/types.ts`](../templates/src/types.ts) вручную.
- Необязательные данные и значения, допускающие `null`, — `Option`: `user?: User` в TypeScript — `Option<User>` в Rust. Если страница передаёт такое значение в prop, который допускает `null` (`login?: string` в `FormField` как `value?: string | null`), в Rust оба должны быть `Option`; литералы vitempl оборачивает в `Some(...)` сам. Условие `v-if="user != null"` превращается в `{% if let Some(user) = user %}`, поэтому в шаблонах для всех серверов проверка пишется как `!= null`.
- Поля `prevPage` и `hasPrev` остаются в camelCase, как в TypeScript: шаблон обращается к ним по этим именам, askama их не переименовывает (поэтому `#![allow(non_snake_case)]`).
- Данные берутся из общих JSON-файлов [`examples/data`](../data), они подключаются в бинарник через `include_str!`.

## Скрипты

Из корня репозитория:

- `ENGINE=askama npm run build -w example-templates` — сборка шаблонов для askama
- `cargo run --manifest-path examples/axum-app/Cargo.toml` — запуск сервера на http://127.0.0.1:8080 (порт меняется переменной `PORT`)
- `cargo build --manifest-path examples/axum-app/Cargo.toml` — только сборка

Нужен установленный Rust (edition 2024).
