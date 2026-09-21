/**
 * Типы данных шаблонов.
 *
 * Выводятся из функций, которые собирают данные (`data.ts`), поэтому типы
 * и данные не могут разойтись. Шаблоны импортируют их через алиас
 * `@server/types`, см. `paths` в `node-template-hbs/tsconfig.app.json`.
 */
import type {
  aboutPage,
  errorPage,
  indexPage,
  list,
  loginPage,
  nav,
} from "./data.ts";

export type Nav = typeof nav;
export type List = ReturnType<typeof list>;
export type IndexPage = ReturnType<typeof indexPage>;
export type AboutPage = ReturnType<typeof aboutPage>;
export type ErrorPage = ReturnType<typeof errorPage>;
export type LoginPage = ReturnType<typeof loginPage>;
