import {
  ElementTypes,
  NodeTypes,
  type DirectiveNode,
  type ElementNode,
  type ExpressionNode,
  type SimpleExpressionNode,
  type SourceLocation,
  type TemplateChildNode,
} from "@vue/compiler-core";
import {
  camelize,
  escapeHtml,
  isBooleanAttr,
  isGloballyAllowed,
  isVoidTag,
} from "@vue/shared";
import type {
  GenerateContext,
  GenerateResult,
  TemplateEngine,
} from "../engine.ts";

type BabelNode = Exclude<SimpleExpressionNode["ast"], null | false | undefined>;

interface Scope {
  /** Переменные v-for, видимые в текущем месте */
  locals: ReadonlySet<string>;
  /**
   * Сколько смен контекста Handlebars (`{{#each}}`, содержимое слота)
   * отделяют текущее место от данных компонента
   */
  depth: number;
}

interface Condition {
  helper: "if" | "unless";
  path: string;
}

/** Директивы, которые обрабатываются на уровне элемента */
const STRUCTURAL = new Set(["if", "else-if", "else", "for"]);

/** Handlebars: компоненты становятся partials, слот по умолчанию — partial-блоком */
export function handlebars(): TemplateEngine {
  return {
    name: "handlebars",
    extension: ".hbs",
    generate: generateHandlebars,
  };
}

/**
 * Генерирует шаблон Handlebars из шаблона Vue SFC.
 *
 * Поддерживается подмножество Vue, которое однозначно переводится
 * в Handlebars: пути к данным, v-if/v-else-if/v-else, v-for по массивам,
 * атрибуты, компоненты (partials) и слот по умолчанию (partial-блок).
 * Всё остальное — ошибка компиляции.
 */
function generateHandlebars(
  nodes: TemplateChildNode[],
  { components }: GenerateContext,
): GenerateResult {
  const errors: GenerateResult["errors"] = [];

  const error = (message: string, loc: SourceLocation) => {
    errors.push({
      message,
      loc: { line: loc.start.line, column: loc.start.column },
    });
    return "";
  };

  function children(nodes: TemplateChildNode[], scope: Scope): string {
    let out = "";
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (node.type !== NodeTypes.ELEMENT) {
        out += child(node, scope);
        continue;
      }
      const vIf = findDirective(node, "if");
      if (!vIf) {
        const vElse =
          findDirective(node, "else-if") ?? findDirective(node, "else");
        out += vElse
          ? error("v-else без v-if", vElse.loc)
          : element(node, scope);
        continue;
      }
      // v-if/v-else-if/v-else — соседние элементы, между ними только пробелы и комментарии
      const chain = [{ node, directive: vIf }];
      for (let j = i + 1; j < nodes.length; j++) {
        const next = nodes[j];
        if (isBlank(next)) {
          continue;
        }
        const directive =
          next.type === NodeTypes.ELEMENT
            ? (findDirective(next, "else-if") ?? findDirective(next, "else"))
            : undefined;
        if (next.type !== NodeTypes.ELEMENT || !directive) {
          break;
        }
        chain.push({ node: next, directive });
        i = j;
        if (directive.name === "else") {
          break;
        }
      }
      out += ifChain(chain, scope);
    }
    return out;
  }

  function child(node: TemplateChildNode, scope: Scope): string {
    switch (node.type) {
      case NodeTypes.TEXT:
        return escapeMustache(node.loc.source);
      case NodeTypes.COMMENT:
        return "";
      case NodeTypes.INTERPOLATION: {
        const path = toPath(node.content, scope, node.loc);
        return path ? `{{${path}}}` : "";
      }
      default:
        return error("неподдерживаемый узел шаблона", node.loc);
    }
  }

  function ifChain(
    chain: { node: ElementNode; directive: DirectiveNode }[],
    scope: Scope,
  ): string {
    let helper = "if";
    let out = "";
    chain.forEach(({ node, directive }, index) => {
      const body = element(node, scope);
      if (directive.name === "else") {
        out += `{{else}}${body}`;
        return;
      }
      const condition = toCondition(directive.exp, scope, directive.loc);
      if (!condition) {
        return;
      }
      if (index === 0) {
        helper = condition.helper;
        out += `{{#${condition.helper} ${condition.path}}}${body}`;
      } else {
        out += `{{else ${condition.helper} ${condition.path}}}${body}`;
      }
    });
    return `${out}{{/${helper}}}`;
  }

  function element(node: ElementNode, scope: Scope): string {
    const vFor = findDirective(node, "for");
    return vFor ? forLoop(node, vFor, scope) : elementBody(node, scope);
  }

  function forLoop(node: ElementNode, directive: DirectiveNode, scope: Scope) {
    const result = directive.forParseResult;
    if (!result) {
      return error("не удалось разобрать v-for", directive.loc);
    }
    if (result.index) {
      return error(
        "v-for с тремя переменными (обход объекта) не поддерживается",
        directive.loc,
      );
    }
    const params: string[] = [];
    for (const param of [result.value, result.key]) {
      if (!param) {
        continue;
      }
      if (!isIdentifier(param)) {
        return error(
          "в v-for поддерживаются только простые имена переменных",
          directive.loc,
        );
      }
      params.push(param.content);
    }
    const source = toPath(result.source, scope, directive.loc);
    if (!source) {
      return "";
    }
    const inner: Scope = {
      ...scope,
      locals: new Set([...scope.locals, ...params]),
      depth: scope.depth + 1,
    };
    const blockParams = params.length ? ` as |${params.join(" ")}|` : "";
    return `{{#each ${source}${blockParams}}}${elementBody(node, inner)}{{/each}}`;
  }

  function elementBody(node: ElementNode, scope: Scope): string {
    switch (node.tagType) {
      case ElementTypes.ELEMENT: {
        const open = `<${node.tag}${attributes(node, scope)}>`;
        return isVoidTag(node.tag)
          ? open
          : `${open}${children(node.children, scope)}</${node.tag}>`;
      }
      case ElementTypes.TEMPLATE:
        checkDirectives(node);
        return children(node.children, scope);
      case ElementTypes.COMPONENT:
        return component(node, scope);
      case ElementTypes.SLOT:
        return slot(node);
    }
  }

  function checkDirectives(node: ElementNode) {
    for (const prop of node.props) {
      if (prop.type === NodeTypes.DIRECTIVE && !STRUCTURAL.has(prop.name)) {
        error(`директива v-${prop.name} здесь не поддерживается`, prop.loc);
      }
    }
  }

  function attributes(node: ElementNode, scope: Scope): string {
    const staticClass = node.props.find(
      (prop) => prop.type === NodeTypes.ATTRIBUTE && prop.name === "class",
    );
    const hasBoundClass = node.props.some(
      (prop) => prop.type === NodeTypes.DIRECTIVE && bindName(prop) === "class",
    );
    let out = "";
    for (const prop of node.props) {
      if (prop.type === NodeTypes.ATTRIBUTE) {
        if (prop !== staticClass || !hasBoundClass) {
          out += ` ${escapeMustache(prop.loc.source)}`;
        }
        continue;
      }
      if (STRUCTURAL.has(prop.name)) {
        continue;
      }
      const name = bindArgument(prop);
      if (!name || name === "key") {
        continue;
      }
      if (name === "class") {
        const value = classValue(prop, scope);
        const base =
          staticClass?.type === NodeTypes.ATTRIBUTE && staticClass.value
            ? `${escapeHtml(staticClass.value.content)} `
            : "";
        out += ` class="${base}${value}"`;
        continue;
      }
      if (name === "style") {
        error(":style не поддерживается", prop.loc);
        continue;
      }
      out += boundAttribute(name, prop, scope);
    }
    return out;
  }

  /** Имя атрибута из v-bind, для остальных директив — ошибка */
  function bindArgument(directive: DirectiveNode): string | undefined {
    if (directive.name !== "bind") {
      error(`директива v-${directive.name} не поддерживается`, directive.loc);
      return;
    }
    const name = bindName(directive);
    if (!name) {
      error(
        "v-bind без имени атрибута и с вычисляемым именем не поддерживается",
        directive.loc,
      );
      return;
    }
    if (directive.modifiers.length) {
      error("модификаторы v-bind не поддерживаются", directive.loc);
      return;
    }
    return name;
  }

  function classValue(directive: DirectiveNode, scope: Scope): string {
    const exp = directive.exp as SimpleExpressionNode | undefined;
    const ast = exp?.ast;
    if (ast && ast.type === "ObjectExpression") {
      const parts: string[] = [];
      for (const property of ast.properties) {
        const key =
          property.type === "ObjectProperty" && !property.computed
            ? property.key.type === "Identifier"
              ? property.key.name
              : property.key.type === "StringLiteral"
                ? property.key.value
                : undefined
            : undefined;
        const condition =
          key && property.type === "ObjectProperty"
            ? toConditionNode(property.value, scope)
            : undefined;
        if (!key || !condition) {
          error(
            ":class поддерживает объект вида { имя: путь } или { имя: !путь }",
            directive.loc,
          );
          continue;
        }
        parts.push(
          `{{#${condition.helper} ${condition.path}}}${escapeHtml(key)}{{/${condition.helper}}}`,
        );
      }
      return parts.join(" ");
    }
    if (ast && ast.type === "StringLiteral") {
      return escapeHtml(ast.value);
    }
    const path = toPath(exp, scope, directive.loc);
    return path ? `{{${path}}}` : "";
  }

  function boundAttribute(
    name: string,
    directive: DirectiveNode,
    scope: Scope,
  ): string {
    const exp = sameNameShorthand(directive, name);
    const ast = exp.ast;
    if (isBooleanAttr(name)) {
      if (ast && ast.type === "BooleanLiteral") {
        return ast.value ? ` ${name}` : "";
      }
      const condition = toCondition(exp, scope, directive.loc);
      return condition
        ? `{{#${condition.helper} ${condition.path}}} ${name}{{/${condition.helper}}}`
        : "";
    }
    if (
      ast &&
      (ast.type === "StringLiteral" ||
        ast.type === "NumericLiteral" ||
        ast.type === "BooleanLiteral")
    ) {
      return ` ${name}="${escapeMustache(escapeHtml(String(ast.value)))}"`;
    }
    if (ast && ast.type === "TemplateLiteral") {
      let value = "";
      ast.quasis.forEach((quasi, index) => {
        value += escapeMustache(escapeHtml(quasi.value.cooked ?? ""));
        const expression = ast.expressions[index];
        if (expression) {
          const path = toPathNode(expression, scope, directive.loc);
          value += path ? `{{${path}}}` : "";
        }
      });
      return ` ${name}="${value}"`;
    }
    const path = toPath(exp, scope, directive.loc);
    return path ? ` ${name}="{{${path}}}"` : "";
  }

  function component(node: ElementNode, scope: Scope): string {
    const name = components.get(node.tag);
    if (!name) {
      return error(
        `компонент <${node.tag}> не импортирован в <script setup>`,
        node.loc,
      );
    }
    const hash: string[] = [];
    for (const prop of node.props) {
      if (prop.type === NodeTypes.ATTRIBUTE) {
        const key = camelize(prop.name);
        hash.push(
          `${key}=${prop.value ? toStringLiteral(prop.value.content) : "true"}`,
        );
        continue;
      }
      if (STRUCTURAL.has(prop.name)) {
        continue;
      }
      const argument = bindArgument(prop);
      if (!argument || argument === "key") {
        continue;
      }
      const key = camelize(argument);
      const value = toHashValue(sameNameShorthand(prop, key), scope, prop.loc);
      if (value) {
        hash.push(`${key}=${value}`);
      }
    }

    // контекст null: компонент видит только переданные props, как во Vue
    const call = [name, "null", ...hash].join(" ");
    const content = node.children.filter((child) => !isBlank(child));
    for (const child of content) {
      if (
        child.type === NodeTypes.ELEMENT &&
        child.tagType === ElementTypes.TEMPLATE &&
        findDirective(child, "slot")
      ) {
        error("именованные слоты не поддерживаются", child.loc);
      }
    }

    // содержимое слота выполняется внутри компонента, в его контексте,
    // поэтому к данным вызывающего шаблона оно обращается на уровень выше
    const body = children(content.length ? node.children : [], {
      ...scope,
      depth: scope.depth + 1,
    });
    // пустой блок сбрасывает @partial-block, унаследованный от внешнего компонента
    return `{{#> ${call}}}${body}{{/${name}}}`;
  }

  function slot(node: ElementNode): string {
    const isDefault = node.props.every(
      (prop) =>
        prop.type === NodeTypes.ATTRIBUTE &&
        prop.name === "name" &&
        prop.value?.content === "default",
    );
    if (!isDefault) {
      return error(
        "поддерживается только слот по умолчанию без параметров",
        node.loc,
      );
    }
    if (node.children.some((child) => !isBlank(child))) {
      return error("запасное содержимое слота не поддерживается", node.loc);
    }
    return "{{#if @partial-block}}{{> @partial-block}}{{/if}}";
  }

  function toCondition(
    exp: ExpressionNode | undefined,
    scope: Scope,
    loc: SourceLocation,
  ): Condition | undefined {
    const ast = (exp as SimpleExpressionNode | undefined)?.ast;
    if (ast) {
      const condition = toConditionNode(ast, scope);
      if (!condition) {
        error(
          `условие «${exp?.loc.source}» не поддерживается: допустимы путь к данным или его отрицание (!путь)`,
          loc,
        );
      }
      return condition;
    }
    const path = toPath(exp, scope, loc);
    return path ? { helper: "if", path } : undefined;
  }

  function toConditionNode(
    node: BabelNode,
    scope: Scope,
  ): Condition | undefined {
    if (node.type === "UnaryExpression" && node.operator === "!") {
      const path = pathOf(node.argument, scope);
      return path ? { helper: "unless", path } : undefined;
    }
    const path = pathOf(node, scope);
    return path ? { helper: "if", path } : undefined;
  }

  function toHashValue(
    exp: SimpleExpressionNode,
    scope: Scope,
    loc: SourceLocation,
  ): string | undefined {
    const ast = exp.ast;
    if (ast && ast.type === "StringLiteral") {
      return toStringLiteral(ast.value);
    }
    if (
      ast &&
      (ast.type === "NumericLiteral" || ast.type === "BooleanLiteral")
    ) {
      return String(ast.value);
    }
    if (ast && ast.type === "NullLiteral") {
      return "null";
    }
    return toPath(exp, scope, loc);
  }

  function toPath(
    exp: ExpressionNode | undefined,
    scope: Scope,
    loc: SourceLocation,
  ): string | undefined {
    if (!exp || exp.type !== NodeTypes.SIMPLE_EXPRESSION) {
      error("не удалось разобрать выражение", loc);
      return;
    }
    if (exp.ast === null) {
      return root([exp.content.trim()], scope, loc);
    }
    if (exp.ast === false || exp.ast === undefined) {
      error(`не удалось разобрать выражение «${exp.content}»`, loc);
      return;
    }
    return toPathNode(exp.ast, scope, loc, exp.content);
  }

  function toPathNode(
    node: BabelNode,
    scope: Scope,
    loc: SourceLocation,
    source?: string,
  ): string | undefined {
    const segments = segmentsOf(node);
    if (!segments) {
      error(
        `выражение${source ? ` «${source}»` : ""} не поддерживается: допустимы только пути к данным (a.b.c)`,
        loc,
      );
      return;
    }
    return root(segments, scope, loc);
  }

  /** Путь Handlebars для выражения вида a.b.c, иначе undefined без ошибки */
  function pathOf(node: BabelNode, scope: Scope): string | undefined {
    const segments = segmentsOf(node);
    return segments && root(segments, scope);
  }

  function root(
    segments: string[],
    scope: Scope,
    loc?: SourceLocation,
  ): string | undefined {
    const [head] = segments;
    if (head.startsWith("$") || isGloballyAllowed(head)) {
      if (loc) {
        error(
          `"${head}" не поддерживается: допустимы только данные шаблона`,
          loc,
        );
      }
      return;
    }
    if (scope.locals.has(head)) {
      return segments.join(".");
    }
    return "../".repeat(scope.depth) + segments.join(".");
  }

  const code = children(nodes, { locals: new Set(), depth: 0 });
  return { code, errors };
}

function segmentsOf(node: BabelNode): string[] | undefined {
  switch (node.type) {
    case "Identifier":
      return [node.name];
    case "MemberExpression":
    case "OptionalMemberExpression": {
      const object = segmentsOf(node.object as BabelNode);
      if (!object) {
        return;
      }
      if (!node.computed && node.property.type === "Identifier") {
        return [...object, node.property.name];
      }
      if (node.computed && node.property.type === "NumericLiteral") {
        return [...object, `[${node.property.value}]`];
      }
      return;
    }
  }
}

function findDirective(node: ElementNode, name: string) {
  return node.props.find(
    (prop): prop is DirectiveNode =>
      prop.type === NodeTypes.DIRECTIVE && prop.name === name,
  );
}

function bindName(directive: DirectiveNode): string | undefined {
  const arg = directive.arg;
  return arg?.type === NodeTypes.SIMPLE_EXPRESSION && arg.isStatic
    ? arg.content
    : undefined;
}

/** `:title` без значения — сокращение для `:title="title"` */
function sameNameShorthand(
  directive: DirectiveNode,
  name: string,
): SimpleExpressionNode {
  const exp = directive.exp as SimpleExpressionNode | undefined;
  return (
    exp ?? {
      type: NodeTypes.SIMPLE_EXPRESSION,
      content: camelize(name),
      isStatic: false,
      constType: 0,
      ast: null,
      loc: directive.loc,
    }
  );
}

function isIdentifier(exp: ExpressionNode): exp is SimpleExpressionNode {
  return (
    exp.type === NodeTypes.SIMPLE_EXPRESSION &&
    /^[A-Za-z_$][\w$]*$/.test(exp.content.trim())
  );
}

function isBlank(node: TemplateChildNode) {
  return (
    node.type === NodeTypes.COMMENT ||
    (node.type === NodeTypes.TEXT && !node.content.trim())
  );
}

/** Экранирует `{{` в статическом тексте, чтобы Handlebars вывел его как есть */
function escapeMustache(text: string) {
  return text.replaceAll("{{", "\\{{");
}

function toStringLiteral(value: string) {
  return `"${value.replaceAll('"', '\\"')}"`;
}
