/**
 * Данные страниц и фрагментов.
 *
 * Здесь сервер собирает всё, что уходит в шаблоны. Источник — JSON-файлы
 * из `examples/data/`, общие для всех серверов примера; в настоящем
 * приложении это были бы ответы API. Форма данных — контракт с шаблонами,
 * он описан в `templates/src/types.ts`, и функции ниже его соблюдают.
 */
import type {
  AboutPage,
  ErrorPage,
  IndexPage,
  List,
  LoginPage,
  Nav,
} from "../../templates/src/types.ts";
import aboutJson from "../../data/about.json" with { type: "json" };
import indexJson from "../../data/index.json" with { type: "json" };
import listJson from "../../data/list.json" with { type: "json" };
import navJson from "../../data/nav.json" with { type: "json" };
import userJson from "../../data/user.json" with { type: "json" };
import { paginate } from "./utils.ts";

/** Меню; пункт текущей страницы отмечается по пути запроса */
export function nav(pathname: string): Nav {
  return navJson.map((item) => ({ ...item, active: item.href === pathname }));
}

/**
 * Проверка логина. Для примера подходит только admin/admin:
 * настоящей аутентификации здесь нет.
 */
export function authenticate(login: string, password: string) {
  return login === "admin" && password === "admin";
}

export function list(page: number): List {
  return { ...listJson, ...paginate(listJson.items, page) };
}

export function indexPage(page: number, authorized: boolean): IndexPage {
  return {
    ...indexJson,
    nav: nav("/"),
    user: authorized ? userJson : undefined,
    list: authorized ? list(page) : undefined,
  };
}

export function loginPage(
  form: { login?: string; remember?: boolean } = {},
  error?: string,
): LoginPage {
  return {
    title: "Вход",
    nav: nav("/login"),
    error,
    login: form.login,
    remember: form.remember ?? false,
  };
}

export function aboutPage(): AboutPage {
  return { ...aboutJson, nav: nav("/about") };
}

export function errorPage(status: number, message: string): ErrorPage {
  return { title: "Ошибка", nav: nav(""), status, message };
}
