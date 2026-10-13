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

export function toTag(pkg: string, version: string): string {
  return pkg === defaultPackage ? `v${version}` : `${pkg}@${version}`;
}
