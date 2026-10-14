/**
 * Данные шаблонов: контракт между шаблонами и сервером.
 *
 * Страницы и фрагменты принимают эти типы как props. Сервер на любом языке
 * должен отдавать данные такой же формы — в примерах она повторена
 * вручную (Node — в `node-app/src/data.ts`).
 */

export interface NavItem {
  title: string;
  href: string;
}

export type Nav = NavItem[];

export interface User {
  name: string;
}

export interface List {
  title: string;
  items: { title: string }[];
  page: number;
  prevPage: number;
  nextPage: number;
  hasPrev: boolean;
  hasNext: boolean;
}

export interface IndexPage {
  title: string;
  nav: Nav;
  /** Есть только после входа */
  user?: User;
  /** Есть только после входа */
  list?: List;
}

export interface AboutPage {
  title: string;
  description: string;
  nav: Nav;
}

export interface LoginPage {
  title: string;
  nav: Nav;
  /** Сообщение об ошибке входа */
  error?: string;
}

export interface ErrorPage {
  title: string;
  nav: Nav;
  status: number;
  message: string;
}
