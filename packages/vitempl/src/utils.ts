import path from "node:path";

/** Проверяет, что файл лежит внутри папки и не совпадает с ней */
export function isInside(dir: string, file: string) {
  const relative = path.relative(dir, file);
  return (
    relative !== "" &&
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}
