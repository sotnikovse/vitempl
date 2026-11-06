//! Пример SSR-сервера на axum + askama для шаблонов из `examples/templates`.
//!
//! Шаблоны собирает vitempl (`ENGINE=askama`) в `templates/dist/askama/templates`,
//! askama компилирует их в бинарник, а статику сервер раздаёт из
//! `templates/dist/askama/public`. Маршруты и поведение те же, что у `node-app`.
#![allow(non_snake_case)]

mod data;

use std::net::SocketAddr;
use std::path::PathBuf;

use askama::Template;
use axum::{
    Form, Router,
    extract::Query,
    http::{HeaderMap, HeaderValue, StatusCode, header},
    response::{Html, IntoResponse, Redirect, Response},
    routing::{get, post},
};
use data::{List, NavItem, User};
use serde::Deserialize;
use tower_http::services::ServeDir;

/// Кука сессии. Для примера она без подписи и проверок, только признак входа
const SESSION_COOKIE: &str = "session";
/// Срок жизни куки с галочкой «Запомнить меня», секунды
const REMEMBER_MAX_AGE: u32 = 60 * 60 * 24 * 30;

#[derive(Template)]
#[template(path = "pages/index.html")]
struct IndexPage {
    title: String,
    nav: Vec<NavItem>,
    /// Есть только после входа
    user: Option<User>,
    /// Есть только после входа
    list: Option<List>,
}

#[derive(Template)]
#[template(path = "pages/about.html")]
struct AboutPage {
    title: String,
    description: String,
    nav: Vec<NavItem>,
}

#[derive(Template)]
#[template(path = "pages/login.html")]
struct LoginPage {
    title: String,
    nav: Vec<NavItem>,
    /// Сообщение об ошибке входа
    error: Option<String>,
    /// Введённый логин: после ошибки форма заполняется заново
    login: Option<String>,
    /// Отмечена ли галочка «Запомнить меня»
    remember: bool,
}

#[derive(Template)]
#[template(path = "pages/error.html")]
struct ErrorPage {
    title: String,
    nav: Vec<NavItem>,
    status: u16,
    message: String,
}

#[derive(Template)]
#[template(path = "fragments/items-list.html")]
struct ItemsListFragment {
    list: List,
}

#[derive(Deserialize)]
struct PageQuery {
    page: Option<usize>,
}

#[derive(Deserialize)]
struct LoginForm {
    login: String,
    password: String,
    /// Галочка передаётся полем только когда отмечена
    remember: Option<String>,
}

fn render<T: Template>(status: StatusCode, template: T) -> Response {
    match template.render() {
        Ok(html) => (status, Html(html)).into_response(),
        Err(error) => {
            eprintln!("[server]: ошибка шаблона: {error}");
            error_page(StatusCode::INTERNAL_SERVER_ERROR, "Внутренняя ошибка")
        }
    }
}

fn error_page(status: StatusCode, message: &str) -> Response {
    let page = ErrorPage {
        title: "Ошибка".into(),
        nav: data::nav(""),
        status: status.as_u16(),
        message: message.into(),
    };
    // ошибка самой страницы ошибки отдаётся без шаблона
    match page.render() {
        Ok(html) => (status, Html(html)).into_response(),
        Err(_) => (status, message.to_string()).into_response(),
    }
}

fn is_authorized(headers: &HeaderMap) -> bool {
    headers
        .get(header::COOKIE)
        .and_then(|value| value.to_str().ok())
        .is_some_and(|cookies| {
            cookies
                .split(';')
                .filter_map(|part| part.trim().split_once('='))
                .any(|(key, _)| key == SESSION_COOKIE)
        })
}

fn redirect_with_cookie(location: &str, cookie: String) -> Response {
    let mut response = Redirect::to(location).into_response();
    response
        .headers_mut()
        .insert(header::SET_COOKIE, HeaderValue::from_str(&cookie).unwrap());
    response
}

async fn index(headers: HeaderMap, Query(query): Query<PageQuery>) -> Response {
    let authorized = is_authorized(&headers);
    render(
        StatusCode::OK,
        IndexPage {
            title: data::index_title(),
            nav: data::nav("/"),
            user: authorized.then(data::user),
            list: authorized.then(|| data::list(query.page.unwrap_or(1))),
        },
    )
}

async fn about() -> Response {
    let (title, description) = data::about();
    render(
        StatusCode::OK,
        AboutPage {
            title,
            description,
            nav: data::nav("/about"),
        },
    )
}

fn login_page(login: Option<String>, remember: bool, error: Option<String>) -> LoginPage {
    LoginPage {
        title: "Вход".into(),
        nav: data::nav("/login"),
        error,
        login,
        remember,
    }
}

async fn login_form(headers: HeaderMap) -> Response {
    if is_authorized(&headers) {
        return Redirect::to("/").into_response();
    }
    render(StatusCode::OK, login_page(None, false, None))
}

async fn login(Form(form): Form<LoginForm>) -> Response {
    let remember = form.remember.is_some();
    if !data::authenticate(&form.login, &form.password) {
        return render(
            StatusCode::UNAUTHORIZED,
            login_page(
                Some(form.login),
                remember,
                Some("Неверный логин или пароль".into()),
            ),
        );
    }
    // «Запомнить меня» — кука живёт месяц, иначе до закрытия браузера
    let max_age = if remember {
        format!("; Max-Age={REMEMBER_MAX_AGE}")
    } else {
        String::new()
    };
    redirect_with_cookie(
        "/",
        format!("{SESSION_COOKIE}=admin; Path=/; HttpOnly; SameSite=Lax{max_age}"),
    )
}

async fn logout() -> Response {
    redirect_with_cookie(
        "/",
        format!("{SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax"),
    )
}

async fn items_list(headers: HeaderMap, Query(query): Query<PageQuery>) -> Response {
    if !is_authorized(&headers) {
        return error_page(StatusCode::FORBIDDEN, "Нужно войти");
    }
    render(
        StatusCode::OK,
        ItemsListFragment {
            list: data::list(query.page.unwrap_or(1)),
        },
    )
}

async fn not_found() -> Response {
    error_page(StatusCode::NOT_FOUND, "Страница не найдена")
}

async fn method_not_allowed() -> Response {
    error_page(StatusCode::METHOD_NOT_ALLOWED, "Метод не поддерживается")
}

#[tokio::main]
async fn main() {
    let public = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../templates/dist/askama/public");
    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|port| port.parse().ok())
        .unwrap_or(8080);

    let app = Router::new()
        .route("/", get(index))
        .route("/about", get(about))
        .route("/login", get(login_form).post(login))
        .route("/logout", post(logout))
        .route("/fragments/items-list", get(items_list))
        .fallback_service(ServeDir::new(public).not_found_service(get(not_found)))
        .method_not_allowed_fallback(method_not_allowed);

    let address = SocketAddr::from(([127, 0, 0, 1], port));
    let listener = tokio::net::TcpListener::bind(address).await.unwrap();
    println!("[server]: Сервер запущен на http://{address}");
    axum::serve(listener, app).await.unwrap();
}
