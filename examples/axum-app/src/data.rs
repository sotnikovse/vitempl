//! Данные страниц и фрагментов.
//!
//! Источник — общие JSON-файлы из `examples/data`, в настоящем приложении
//! это были бы ответы API. Структуры повторяют контракт шаблонов из
//! `templates/src/types.ts`: askama проверяет при компиляции, что шаблон
//! обращается только к существующим полям. Поля с именами из TypeScript
//! (`prevPage`, `hasPrev`) остаются в camelCase: шаблон обращается к ним
//! именно так.
#![allow(non_snake_case)]

use std::sync::LazyLock;

use serde::Deserialize;

#[derive(Clone, Deserialize)]
pub struct Item {
    pub title: String,
}

pub struct NavItem {
    pub title: String,
    pub href: String,
    /// Пункт текущей страницы
    pub active: bool,
}

#[derive(Clone, Deserialize)]
pub struct User {
    pub name: String,
}

pub struct List {
    pub title: String,
    pub items: Vec<Item>,
    pub page: usize,
    pub prevPage: usize,
    pub nextPage: usize,
    pub hasPrev: bool,
    pub hasNext: bool,
}

#[derive(Deserialize)]
struct NavJson {
    title: String,
    href: String,
}

#[derive(Deserialize)]
struct TitleJson {
    title: String,
}

#[derive(Deserialize)]
struct AboutJson {
    title: String,
    description: String,
}

#[derive(Deserialize)]
struct ListJson {
    title: String,
    items: Vec<Item>,
}

fn parse<T: for<'de> Deserialize<'de>>(json: &str) -> T {
    serde_json::from_str(json).expect("некорректный JSON в examples/data")
}

static NAV: LazyLock<Vec<NavJson>> = LazyLock::new(|| parse(include_str!("../../data/nav.json")));
static INDEX: LazyLock<TitleJson> = LazyLock::new(|| parse(include_str!("../../data/index.json")));
static ABOUT: LazyLock<AboutJson> = LazyLock::new(|| parse(include_str!("../../data/about.json")));
static LIST: LazyLock<ListJson> = LazyLock::new(|| parse(include_str!("../../data/list.json")));
static USER: LazyLock<User> = LazyLock::new(|| parse(include_str!("../../data/user.json")));

/// Размер страницы списка
const PAGE_SIZE: usize = 5;

/// Проверка логина. Для примера подходит только admin/admin:
/// настоящей аутентификации здесь нет.
pub fn authenticate(login: &str, password: &str) -> bool {
    login == "admin" && password == "admin"
}

/// Меню; пункт текущей страницы отмечается по пути запроса
pub fn nav(pathname: &str) -> Vec<NavItem> {
    NAV.iter()
        .map(|item| NavItem {
            title: item.title.clone(),
            href: item.href.clone(),
            active: item.href == pathname,
        })
        .collect()
}

pub fn list(page: usize) -> List {
    let pages = LIST.items.len().div_ceil(PAGE_SIZE).max(1);
    let current = page.clamp(1, pages);
    let start = (current - 1) * PAGE_SIZE;
    List {
        title: LIST.title.clone(),
        items: LIST
            .items
            .iter()
            .skip(start)
            .take(PAGE_SIZE)
            .cloned()
            .collect(),
        page: current,
        prevPage: current.saturating_sub(1).max(1),
        nextPage: (current + 1).min(pages),
        hasPrev: current > 1,
        hasNext: current < pages,
    }
}

pub fn index_title() -> String {
    INDEX.title.clone()
}

pub fn about() -> (String, String) {
    (ABOUT.title.clone(), ABOUT.description.clone())
}

pub fn user() -> User {
    USER.clone()
}
