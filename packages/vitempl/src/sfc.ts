import { hyphenate } from "@vue/shared";
import { babelParse, parse, type SFCDescriptor } from "vue/compiler-sfc";
import type {
  PropType,
  TemplateDiagnostic,
  TemplateLocation,
} from "./engine.ts";

export interface ComponentImport {
  /** Путь из импорта, например `../partials/AppHeader.vue` */
  source: string;
  loc: TemplateLocation;
}

export interface Sfc {
  descriptor: SFCDescriptor;
  /** Импортированные компоненты: имя → импорт */
  components: Map<string, ComponentImport>;
  /** Типы props из `defineProps<...>()` по именам */
  propTypes: Record<string, PropType>;
  /** Ошибки разбора, неподдерживаемые блоки и код в `<script setup>` */
  errors: TemplateDiagnostic[];
}

/**
 * Разбирает SFC и проверяет, что в нём нет ничего, что требует выполнения
 * Vue: шаблоны выполняет шаблонизатор сервера. Обычный `<script>` — не код
 * шаблона, а клиентский модуль, его обрабатывает Vite.
 */
export function parseSfc(source: string): Sfc {
  const { descriptor, errors } = parse(source, {
    templateParseOptions: { whitespace: "preserve" },
  });
  if (errors.length) {
    return {
      descriptor,
      components: new Map(),
      propTypes: {},
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
    propTypes: script.propTypes,
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
  let propTypes: Record<string, PropType> = {};
  const script = descriptor.scriptSetup;
  if (!script) {
    return { components, propTypes, errors };
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
    return { components, propTypes, errors };
  }

  // объявления типов файла: на них может ссылаться defineProps<Props>()
  const declarations = new Map<string, TSNode>();
  for (const statement of program.body) {
    if (statement.type === "TSInterfaceDeclaration") {
      declarations.set(statement.id.name, statement.body);
    } else if (statement.type === "TSTypeAliasDeclaration") {
      declarations.set(statement.id.name, statement.typeAnnotation);
    }
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
          propTypes = readPropTypes(statement.expression, declarations);
          continue;
        }
        break;
      case "VariableDeclaration":
        if (
          statement.declarations.length === 1 &&
          isDefineProps(statement.declarations[0].init)
        ) {
          propTypes = readPropTypes(
            statement.declarations[0].init,
            declarations,
          );
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
  return { components, propTypes, errors };
}

type TSNode = { type: string; [key: string]: any };

const PROP_TYPES: Record<string, PropType["type"]> = {
  TSStringKeyword: "string",
  TSNumberKeyword: "number",
  TSBooleanKeyword: "boolean",
};

/** Типы props из аргумента типа `defineProps<...>()`: литерал или объявление в файле */
function readPropTypes(call: any, declarations: Map<string, TSNode>) {
  const types: Record<string, PropType> = {};
  let node: TSNode | undefined = (call.typeParameters ?? call.typeArguments)
    ?.params?.[0];
  if (node?.type === "TSTypeReference" && node.typeName.type === "Identifier") {
    node = declarations.get(node.typeName.name);
  }
  const members: TSNode[] =
    node?.type === "TSTypeLiteral" || node?.type === "TSInterfaceBody"
      ? (node.members ?? node.body)
      : [];
  for (const member of members) {
    const key = member.key;
    const name =
      key?.type === "Identifier"
        ? key.name
        : key?.type === "StringLiteral"
          ? key.value
          : undefined;
    const type = member.typeAnnotation?.typeAnnotation as TSNode | undefined;
    if (member.type !== "TSPropertySignature" || !name || !type) {
      continue;
    }
    // `string | null` — тип без пустых значений и признак, что они допустимы
    const items: TSNode[] = type.type === "TSUnionType" ? type.types : [type];
    const rest = items.filter(
      (item) =>
        item.type !== "TSNullKeyword" && item.type !== "TSUndefinedKeyword",
    );
    types[name] = {
      type: rest.length === 1 ? PROP_TYPES[rest[0].type] : undefined,
      nullable: Boolean(member.optional) || rest.length < items.length,
    };
  }
  return types;
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
