import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { build, createServer, type ViteDevServer } from "vite";
import vitePluginSFCE from "../src/index";

const fixtureRoot = fileURLToPath(new URL("./fixtures/mpa", import.meta.url));

async function buildFixture() {
  const result = await build({
    root: fixtureRoot,
    logLevel: "silent",
    appType: "mpa",
    plugins: [vitePluginSFCE()],
    build: {
      write: false,
      rollupOptions: {
        input: {
          main: fileURLToPath(
            new URL("./fixtures/mpa/index.html", import.meta.url),
          ),
          second: fileURLToPath(
            new URL("./fixtures/mpa/second.html", import.meta.url),
          ),
        },
      },
    },
  });

  const outputs = Array.isArray(result) ? result : [result];
  const html = new Map<string, string>();
  const code: string[] = [];

  for (const output of outputs) {
    for (const item of output.output) {
      if (item.type === "asset" && item.fileName.endsWith(".html")) {
        html.set(
          item.fileName,
          typeof item.source === "string"
            ? item.source
            : Buffer.from(item.source).toString(),
        );
      }

      if (item.type === "chunk") {
        code.push(item.code);
      }
    }
  }

  return { html, code: code.join("\n") };
}

describe("vite-plugin-sfce build", () => {
  let result: Awaited<ReturnType<typeof buildFixture>>;

  beforeAll(async () => {
    result = await buildFixture();
  });

  test("встраивает шаблоны только в те страницы, которые используют компонент", () => {
    expect(result.html.get("index.html")).toContain(
      'id="shared-badge-template"',
    );
    expect(result.html.get("index.html")).toContain('id="index-only-template"');
    expect(result.html.get("second.html")).toContain(
      'id="shared-badge-template"',
    );
    expect(result.html.get("second.html")).not.toContain(
      'id="index-only-template"',
    );
  });

  test("включает стили компонента в шаблон", () => {
    expect(result.html.get("index.html")).toContain(".badge");
    expect(result.html.get("index.html")).toContain("color: blue");
  });

  test("не оставляет вызовы инъекции в собранном коде", () => {
    expect(result.code).not.toContain("_injectTemplate(");
    expect(result.code).toContain("customElements.define");
  });
});

describe("vite-plugin-sfce dev", () => {
  let server: ViteDevServer;

  beforeAll(async () => {
    server = await createServer({
      root: fixtureRoot,
      logLevel: "silent",
      appType: "mpa",
      server: { middlewareMode: true },
      plugins: [vitePluginSFCE()],
    });
  });

  afterAll(async () => {
    await server.close();
  });

  test("отдаёт модуль с вызовом _injectTemplate", async () => {
    const result = await server.transformRequest(
      "/src/components/SharedBadge.sfce.vue",
    );

    expect(result?.code).toContain("_injectTemplate(");
    expect(result?.code).toContain("shared-badge-template");
  });

  test("добавляет рантайм-функцию в HTML", async () => {
    const html = await server.transformIndexHtml(
      "/index.html",
      "<!doctype html><html><body></body></html>",
    );

    expect(html).toContain("function _injectTemplate");
  });

  test("сообщает об ошибке при использовании <script setup>", async () => {
    await expect(
      server.transformRequest("/src/components/ScriptSetup.sfce.vue"),
    ).rejects.toThrow(/script setup/);
  });
});
