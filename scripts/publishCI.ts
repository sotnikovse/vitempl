import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { getPublishTag } from "@vitejs/release-scripts";
import { getPkgDir, releasePackages, toTag } from "./releaseUtils.ts";

// `publish` из @vitejs/release-scripts не умеет scoped-теги (`@scope/name@1.0.0`),
// поэтому пакет определяется по тегу через toTag.
const tag = process.argv[2];
if (!tag) throw new Error("No tag specified");

const pkgName = releasePackages.find((pkg) => {
  const { version } = JSON.parse(
    readFileSync(`${getPkgDir(pkg)}/package.json`, "utf-8"),
  );
  return toTag(pkg, version) === tag;
});
if (!pkgName) {
  throw new Error(`Tag "${tag}" does not match any package version`);
}

const { version } = JSON.parse(
  readFileSync(`${getPkgDir(pkgName)}/package.json`, "utf-8"),
);
const npmTag = getPublishTag(version);

execFileSync(
  "npm",
  [
    "publish",
    `--workspace=${pkgName}`,
    "--access",
    "public",
    ...(npmTag ? ["--tag", npmTag] : []),
  ],
  { stdio: "inherit" },
);
