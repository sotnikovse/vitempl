/**
 * Данные страниц и фрагментов.
 *
 * Здесь сервер собирает всё, что уходит в шаблоны. Источник — JSON-файлы
 * из `data/`, в настоящем приложении это были бы ответы API. Типы шаблонов
 * выводятся из этих функций, см. `types.ts`.
 */
import aboutJson from "../data/about.json" with { type: "json" };
import indexJson from "../data/index.json" with { type: "json" };
import listJson from "../data/list.json" with { type: "json" };
import navJson from "../data/nav.json" with { type: "json" };
import userJson from "../data/user.json" with { type: "json" };
import { paginate } from "./utils.ts";

/** Меню, одинаковое для всех страниц */
export const nav = navJson;

/**
 * Проверка логина. Для примера подходит только admin/admin:
 * настоящей аутентификации здесь нет.
 */
export function authenticate(login: string, password: string) {
  return login === "admin" && password === "admin";
}

export function list(page: number) {
  return { ...listJson, ...paginate(listJson.items, page) };
}

export function indexPage(page: number, authorized: boolean) {
  return {
    ...indexJson,
    nav,
    user: authorized ? userJson : undefined,
    list: authorized ? list(page) : undefined,
  };
}

export function loginPage(error?: string) {
  return { title: "Вход", nav, error };
}

export function aboutPage() {
  return { ...aboutJson, nav };
}

export function errorPage(status: number, message: string) {
  return { title: "Ошибка", nav, status, message };
}
