import { hyphenate } from "@vue/shared";
import { babelParse, parse, type SFCDescriptor } from "vue/compiler-sfc";
import type { TemplateDiagnostic, TemplateLocation } from "./engine.ts";

export interface ComponentImport {
  /** Путь из импорта, например `../partials/AppHeader.vue` */
  source: string;
  loc: TemplateLocation;
}

export interface Sfc {
  descriptor: SFCDescriptor;
  /** Импортированные компоненты: имя → импорт */
  components: Map<string, ComponentImport>;
  /** Ошибки разбора, неподдерживаемые блоки и код в `<script setup>` */
  errors: TemplateDiagnostic[];
}

/**
 * Разбирает SFC и проверяет, что в нём нет ничего, что требует выполнения
 * Vue: шаблоны выполняет шаблонизатор сервера.
 */
export function parseSfc(source: string): Sfc {
  const { descriptor, errors } = parse(source, {
    templateParseOptions: { whitespace: "preserve" },
  });
  if (errors.length) {
    return {
      descriptor,
      components: new Map(),
      errors: errors.map((error) => ({
        message: error.message,
        loc:
          "loc" in error && error.loc
            ? { line: error.loc.start.line, column: error.loc.start.column }
            : { line: 1, column: 1 },
      })),
    };
  }
  const script = readScript(descriptor);
  return {
    descriptor,
    components: script.components,
    errors: [...checkBlocks(descriptor), ...script.errors],
  };
}

/**
 * Импортированные компоненты по именам тегов: во Vue компонент можно
 * указать в шаблоне как `<AppHeader>` и как `<app-header>`
 */
export function componentTags(
  sfc: Sfc,
  templateName: (source: string) => string,
) {
  const tags = new Map<string, string>();
  for (const [name, { source }] of sfc.components) {
    const template = templateName(source);
    tags.set(name, template).set(hyphenate(name), template);
  }
  return tags;
}

function checkBlocks(descriptor: SFCDescriptor): TemplateDiagnostic[] {
  const errors: TemplateDiagnostic[] = [];
  const at = (loc: { start: TemplateLocation }) => ({
    line: loc.start.line,
    column: loc.start.column,
  });
  if (!descriptor.template) {
    errors.push({
      message: "нет блока <template>",
      loc: { line: 1, column: 1 },
    });
  } else if (descriptor.template.lang) {
    errors.push({
      message: `<template lang="${descriptor.template.lang}"> не поддерживается`,
      loc: at(descriptor.template.loc),
    });
  }
  if (descriptor.script) {
    errors.push({
      message: "поддерживается только <script setup>",
      loc: at(descriptor.script.loc),
    });
  }
  for (const style of descriptor.styles) {
    if (style.scoped || style.module) {
      errors.push({
        message:
          "<style scoped> и <style module> не поддерживаются: разметка не размечается классами Vue",
        loc: at(style.loc),
      });
    }
  }
  for (const block of descriptor.customBlocks) {
    errors.push({
      message: `блок <${block.type}> не поддерживается`,
      loc: at(block.loc),
    });
  }
  return errors;
}

/**
 * Читает `<script setup>`: в нём допускаются только импорты компонентов
 * и типов, объявления типов и defineProps.
 */
function readScript(descriptor: SFCDescriptor) {
  const components = new Map<string, ComponentImport>();
  const errors: TemplateDiagnostic[] = [];
  const script = descriptor.scriptSetup;
  if (!script) {
    return { components, errors };
  }

  const lineOffset = script.loc.start.line - 1;
  let program;
  try {
    program = babelParse(script.content, {
      sourceType: "module",
      plugins: ["typescript"],
    }).program;
  } catch (error) {
    const { loc } = error as { loc?: TemplateLocation };
    errors.push({
      message: (error as Error).message,
      loc: loc
        ? { line: loc.line + lineOffset, column: loc.column + 1 }
        : { line: script.loc.start.line, column: 1 },
    });
    return { components, errors };
  }

  for (const statement of program.body) {
    const loc = {
      line: (statement.loc?.start.line ?? 1) + lineOffset,
      column: (statement.loc?.start.column ?? 0) + 1,
    };
    switch (statement.type) {
      case "ImportDeclaration": {
        const isTypeOnly =
          statement.importKind === "type" ||
          (statement.specifiers.length > 0 &&
            statement.specifiers.every(
              (specifier) =>
                specifier.type === "ImportSpecifier" &&
                specifier.importKind === "type",
            ));
        if (isTypeOnly) {
          continue;
        }
        const [specifier] = statement.specifiers;
        const source = statement.source.value;
        if (
          source.endsWith(".vue") &&
          statement.specifiers.length === 1 &&
          specifier.type === "ImportDefaultSpecifier"
        ) {
          components.set(specifier.local.name, { source, loc });
          continue;
        }
        errors.push({
          message: `импорт "${source}": в <script setup> можно импортировать только компоненты (.vue) и типы`,
          loc,
        });
        continue;
      }
      case "TSInterfaceDeclaration":
      case "TSTypeAliasDeclaration":
        continue;
      case "ExpressionStatement":
        if (isDefineProps(statement.expression)) {
          continue;
        }
        break;
      case "VariableDeclaration":
        if (
          statement.declarations.length === 1 &&
          isDefineProps(statement.declarations[0].init)
        ) {
          continue;
        }
        break;
    }
    errors.push({
      message:
        "в <script setup> допускаются только импорты компонентов и типов, объявления типов и defineProps",
      loc,
    });
  }
  return { components, errors };
}

function isDefineProps(node: unknown) {
  const call = node as
    | { type: string; callee?: { type: string; name?: string } }
    | null
    | undefined;
  return (
    call?.type === "CallExpression" &&
    call.callee?.type === "Identifier" &&
    call.callee.name === "defineProps"
  );
}
