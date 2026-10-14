import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

export const defaultPackage = "vitempl";
export const releasePackages = [
  "vitempl",
  "vite-plugin-sfce",
  "@vitempl/eslint-plugin",
] as const;

const SCOPE = "@vitempl/";

export function getPkgDir(pkg: string): string {
  return `packages/${pkg.startsWith(SCOPE) ? pkg.slice(SCOPE.length) : pkg}`;
}

/** Падает, если с тега текущей версии пакета в его папке не было коммитов */
export function assertHasChanges(pkg: string): void {
  const dir = getPkgDir(pkg);
  const { version } = JSON.parse(readFileSync(`${dir}/package.json`, "utf-8"));
  const tag = toTag(pkg, version);
  try {
    execFileSync("git", [
      "rev-parse",
      "--verify",
      "--quiet",
      `refs/tags/${tag}`,
    ]);
  } catch {
    return; // тега нет — первый релиз
  }
  const log = execFileSync(
    "git",
    ["log", `${tag}..HEAD`, "--oneline", "--", dir],
    { encoding: "utf-8" },
  ).trim();
  if (!log) {
    throw new Error(`${pkg}: нет изменений с ${tag}, выпускать релиз не нужно`);
  }
}

export function toTag(pkg: string, version: string): string {
  return pkg === defaultPackage ? `v${version}` : `${pkg}@${version}`;
}
