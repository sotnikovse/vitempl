import { createReadStream } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Handlebars from "handlebars";
import {
  aboutPage,
  authenticate,
  errorPage,
  indexPage,
  list,
  loginPage,
} from "./data.ts";

/** Кука сессии. Для примера она без подписи и проверок, только признак входа */
const SESSION_COOKIE = "session";
/** Ограничение на размер формы */
const MAX_BODY_SIZE = 4096;

const HOSTNAME = "127.0.0.1";
const PORT = Number(process.env.PORT) || 8080;
const DIST_DIR = fileURLToPath(
  new URL("../../node-template-hbs/dist", import.meta.url),
);
const PUBLIC_DIR = path.join(DIST_DIR, "public");
const TEMPLATES_DIR = path.join(DIST_DIR, "templates");

const mimeTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
};

const templates = new Map<string, Handlebars.TemplateDelegate>();

/**
 * Читает собранные шаблоны. Имя шаблона — путь от `dist/templates`
 * без расширения: `pages/index`, `partials/AppHeader`.
 */
async function loadTemplates() {
  const entries = await readdir(TEMPLATES_DIR, {
    recursive: true,
    withFileTypes: true,
  });
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".hbs")) {
      continue;
    }
    const file = path.join(entry.parentPath, entry.name);
    const name = path
      .relative(TEMPLATES_DIR, file)
      .split(path.sep)
      .join("/")
      .slice(0, -".hbs".length);
    const source = await readFile(file, "utf-8");
    Handlebars.registerPartial(name, source);
    templates.set(name, Handlebars.compile(source));
  }
}

function render(
  res: ServerResponse,
  status: number,
  name: string,
  data: unknown,
) {
  const template = templates.get(name);
  if (!template) {
    throw new Error(`Шаблон "${name}" не найден`);
  }
  res.writeHead(status, { "Content-Type": "text/html; charset=utf-8" });
  res.end(template(data));
}

/** Отдаёт файл из `dist/public`, если он там есть */
async function sendStatic(res: ServerResponse, pathname: string) {
  const file = path.resolve(PUBLIC_DIR, `.${pathname}`);
  if (!file.startsWith(`${PUBLIC_DIR}${path.sep}`)) {
    return false;
  }
  const stats = await stat(file).catch(() => undefined);
  if (!stats?.isFile()) {
    return false;
  }
  res.writeHead(200, {
    "Content-Type":
      mimeTypes[path.extname(file).toLowerCase()] ?? "application/octet-stream",
    "Content-Length": stats.size,
  });
  createReadStream(file).pipe(res);
  return true;
}

function redirect(res: ServerResponse, location: string, cookie?: string) {
  res.writeHead(
    303,
    cookie
      ? { Location: location, "Set-Cookie": cookie }
      : { Location: location },
  );
  res.end();
}

function getCookie(req: IncomingMessage, name: string) {
  return req.headers.cookie
    ?.split(";")
    .map((part) => part.trim().split("="))
    .find(([key]) => key === name)?.[1];
}

/** Читает данные формы (`application/x-www-form-urlencoded`) */
async function readForm(req: IncomingMessage) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > MAX_BODY_SIZE) {
      throw new Error("Слишком большое тело запроса");
    }
  }
  return new URLSearchParams(body);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${HOSTNAME}`);
  const page = Number(url.searchParams.get("page")) || 1;
  const authorized = getCookie(req, SESSION_COOKIE) !== undefined;
  try {
    switch (`${req.method} ${url.pathname}`) {
      case "GET /":
        render(res, 200, "pages/index", indexPage(page, authorized));
        return;
      case "GET /about":
        render(res, 200, "pages/about", aboutPage());
        return;
      case "GET /login":
        if (authorized) {
          redirect(res, "/");
          return;
        }
        render(res, 200, "pages/login", loginPage());
        return;
      case "POST /login": {
        const form = await readForm(req);
        if (
          !authenticate(form.get("login") ?? "", form.get("password") ?? "")
        ) {
          render(
            res,
            401,
            "pages/login",
            loginPage("Неверный логин или пароль"),
          );
          return;
        }
        redirect(
          res,
          "/",
          `${SESSION_COOKIE}=admin; Path=/; HttpOnly; SameSite=Lax`,
        );
        return;
      }
      case "POST /logout":
        redirect(
          res,
          "/",
          `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`,
        );
        return;
      case "GET /fragments/items-list":
        if (!authorized) {
          render(res, 403, "pages/error", errorPage(403, "Нужно войти"));
          return;
        }
        render(res, 200, "fragments/items-list", { list: list(page) });
        return;
      default:
        if (req.method !== "GET") {
          render(
            res,
            405,
            "pages/error",
            errorPage(405, "Метод не поддерживается"),
          );
        } else if (!(await sendStatic(res, url.pathname))) {
          render(
            res,
            404,
            "pages/error",
            errorPage(404, "Страница не найдена"),
          );
        }
    }
  } catch (error) {
    console.error("[server]: ошибка запроса", error);
    render(res, 500, "pages/error", errorPage(500, "Внутренняя ошибка"));
  }
});

await loadTemplates();
server.listen(PORT, HOSTNAME, () => {
  console.log(`[server]: Сервер запущен на http://${HOSTNAME}:${PORT}`);
});
