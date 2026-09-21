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
  hyphenate,
  isBooleanAttr,
  isGloballyAllowed,
  isVoidTag,
} from "@vue/shared";
import type {
  GenerateContext,
  GenerateResult,
  TemplateEngine,
  TemplateInfo,
} from "../engine.ts";

type BabelNode = Exclude<SimpleExpressionNode["ast"], null | false | undefined>;

/**
 * Чем шаблонизатор отличается от других jinja-подобных. Общая часть —
 * блоки `{% if %}`, `{% for %}`, макросы и `{% call %}` — у них одна,
 * расходятся язык выражений и работа с необязательными значениями.
 */
export interface JinjaDialect {
  name: string;
  extension: string;
  /** Ветка «иначе если»: `elif` в Jinja, `else if` в askama */
  elseIf: string;
  /** Объявление переменной: `set` в Jinja, `let` в askama */
  assign: string;
  /** Разделитель при вызове макроса: `.` в Jinja, `::` в askama */
  namespace: string;
  /** Отрицание условия */
  not(condition: string): string;
  /** Логическое «и»: `and` в Jinja, `&&` в askama */
  and: string;
  /** Логическое «или»: `or` в Jinja, `||` в askama */
  or: string;
  /** Условие «значение есть»; в askama оно связывает значение с именем `alias` */
  some(path: string, alias: string): string;
  /** Условие «значения нет» */
  none(path: string): string;
  /** Связывает ли `some` значение с новым именем: внутри ветки путь заменяется на него */
  binds: boolean;
  /** Поддерживает ли шаблонизатор компонент, который подключает сам себя */
  recursion: boolean;
}

interface Scope {
  /** Переменные v-for и связанные значения, видимые в текущем месте */
  locals: ReadonlySet<string>;
  /** Связанные условием значения: путь к данным → имя переменной */
  aliases: ReadonlyMap<string, string>;
}

interface Condition {
  code: string;
  /** Значение, которое условие связывает с именем: видно только внутри ветки */
  binding?: { path: string; alias: string };
}

/** Директивы, которые обрабатываются на уровне элемента */
const STRUCTURAL = new Set(["if", "else-if", "else", "for"]);
/** Имя макроса, которым становится компонент */
const MACRO = "render";
/** Операторы сравнения: из выражения Vue — в выражение шаблонизатора */
const COMPARISON: Record<string, string> = {
  "===": "==",
  "==": "==",
  "!==": "!=",
  "!=": "!=",
  "<": "<",
  "<=": "<=",
  ">": ">",
  ">=": ">=",
};

/** Адаптер jinja-подобного шаблонизатора из описания его диалекта */
export function jinjaEngine(dialect: JinjaDialect): TemplateEngine {
  return {
    name: dialect.name,
    extension: dialect.extension,
    analyze: (nodes, context) =>
      generateJinjaLike(nodes, context, dialect).info,
    generate: (nodes, context) => generateJinjaLike(nodes, context, dialect),
  };
}

/**
 * Генерирует шаблон jinja-подобного шаблонизатора из шаблона Vue SFC.
 *
 * Страница и фрагмент становятся обычным шаблоном: их данные готовит сервер.
 * Остальные шаблоны становятся макросом `render`, параметры которого —
 * данные, к которым шаблон обращается; вызывающий передаёт их по именам,
 * а слот доходит до макроса через `{% call %}` и `caller()`.
 */
export function generateJinjaLike(
  nodes: TemplateChildNode[],
  context: GenerateContext,
  dialect: JinjaDialect,
): GenerateResult & { info: TemplateInfo } {
  const { components, templates, entry } = context;
  const errors: GenerateResult["errors"] = [];
  /** Данные, к которым обращается шаблон */
  const params = new Set<string>();
  /** Подключённые компоненты: имя шаблона → имя, под которым он импортирован */
  const imports = new Map<string, string>();
  let hasSlot = false;

  const error = (message: string, loc: SourceLocation) => {
    errors.push({
      message,
      loc: { line: loc.start.line, column: loc.start.column },
    });
    return "";
  };

  /** Имя, под которым компонент импортируется: `partials/AppHeader` → `partials_app_header` */
  function importName(template: string): string {
    const existing = imports.get(template);
    if (existing) {
      return existing;
    }
    const base = template
      .split("/")
      .map((segment) => hyphenate(segment).replaceAll(/[^\w]+/g, "_"))
      .join("_");
    let alias = base;
    for (let i = 2; [...imports.values()].includes(alias); i++) {
      alias = `${base}_${i}`;
    }
    imports.set(template, alias);
    return alias;
  }

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
        return escapeDelimiters(node.loc.source);
      case NodeTypes.COMMENT:
        return "";
      case NodeTypes.INTERPOLATION: {
        const path = toPath(node.content, scope, node.loc);
        return path ? `{{ ${path} }}` : "";
      }
      default:
        return error("неподдерживаемый узел шаблона", node.loc);
    }
  }

  function ifChain(
    chain: { node: ElementNode; directive: DirectiveNode }[],
    scope: Scope,
  ): string {
    let out = "";
    chain.forEach(({ node, directive }, index) => {
      if (directive.name === "else") {
        out += `{% else %}${element(node, scope)}`;
        return;
      }
      const condition = toCondition(directive.exp, scope, directive.loc);
      if (!condition) {
        return;
      }
      const keyword = index === 0 ? "if" : dialect.elseIf;
      out += `{% ${keyword} ${condition.code} %}${element(node, bind(scope, condition))}`;
    });
    return `${out}{% endif %}`;
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
    if (!result.value || !isIdentifier(result.value)) {
      return error(
        "в v-for поддерживаются только простые имена переменных",
        directive.loc,
      );
    }
    const item = result.value.content;
    const locals = new Set([...scope.locals, item]);
    // вторая переменная v-for по массиву — индекс элемента
    let index: string | undefined;
    if (result.key) {
      if (!isIdentifier(result.key)) {
        return error(
          "в v-for поддерживаются только простые имена переменных",
          directive.loc,
        );
      }
      index = result.key.content;
      locals.add(index);
    }
    const source = toPath(result.source, scope, directive.loc);
    if (!source) {
      return "";
    }
    const inner: Scope = { locals, aliases: scope.aliases };
    const counter = index
      ? `{% ${dialect.assign} ${index} = loop.index0 %}`
      : "";
    return `{% for ${item} in ${source} %}${counter}${elementBody(node, inner)}{% endfor %}`;
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
          out += ` ${escapeDelimiters(prop.loc.source)}`;
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
            ? toConditionNode(property.value as BabelNode, scope)
            : undefined;
        if (!key || !condition) {
          error(
            ":class поддерживает объект вида { имя: условие }",
            directive.loc,
          );
          continue;
        }
        parts.push(`{% if ${condition.code} %}${escapeHtml(key)}{% endif %}`);
      }
      return parts.join(" ");
    }
    if (ast && ast.type === "StringLiteral") {
      return escapeHtml(ast.value);
    }
    const path = toPath(exp, scope, directive.loc);
    return path ? `{{ ${path} }}` : "";
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
      return condition ? `{% if ${condition.code} %} ${name}{% endif %}` : "";
    }
    if (
      ast &&
      (ast.type === "StringLiteral" ||
        ast.type === "NumericLiteral" ||
        ast.type === "BooleanLiteral")
    ) {
      return ` ${name}="${escapeDelimiters(escapeHtml(String(ast.value)))}"`;
    }
    if (ast && ast.type === "TemplateLiteral") {
      let value = "";
      ast.quasis.forEach((quasi, index) => {
        value += escapeDelimiters(escapeHtml(quasi.value.cooked ?? ""));
        const expression = ast.expressions[index];
        if (expression) {
          const path = toPathNode(
            expression as BabelNode,
            scope,
            directive.loc,
          );
          value += path ? `{{ ${path} }}` : "";
        }
      });
      return ` ${name}="${value}"`;
    }
    const path = toPath(exp, scope, directive.loc);
    return path ? ` ${name}="{{ ${path} }}"` : "";
  }

  function component(node: ElementNode, scope: Scope): string {
    const template = components.get(node.tag);
    if (!template) {
      return error(
        `компонент <${node.tag}> не импортирован в <script setup>`,
        node.loc,
      );
    }
    // компонент, который подключает сам себя, вызывает свой же макрос
    const self = template === context.name;
    if (self && !dialect.recursion) {
      return error(
        `${dialect.name} не поддерживает компонент, который подключает сам себя`,
        node.loc,
      );
    }

    // props по именам: их порядок задаёт объявление макроса, а не вызов
    const props = new Map<string, string>();
    for (const prop of node.props) {
      if (prop.type === NodeTypes.ATTRIBUTE) {
        props.set(
          camelize(prop.name),
          prop.value ? toStringLiteral(prop.value.content) : "true",
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
      const value = toValue(sameNameShorthand(prop, key), scope, prop.loc);
      if (value) {
        props.set(key, value);
      }
    }

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
    // содержимое слота остаётся в контексте вызывающего шаблона
    const body = children(content, scope);

    const info = templates.get(template);
    // компонент получает только то, что использует: лишние props шаблонизатор не примет
    const names = info ? info.params : [...props.keys()];
    const args: string[] = [];
    for (const param of names) {
      const value = props.get(param);
      if (value === undefined) {
        error(
          `компонент <${node.tag}> обращается к данным "${param}", но они не переданы`,
          node.loc,
        );
        continue;
      }
      args.push(`${param}=${value}`);
    }

    const call = self
      ? `${MACRO}(${args.join(", ")})`
      : `${importName(template)}${dialect.namespace}${MACRO}(${args.join(", ")})`;
    if (info ? info.hasSlot : body !== "") {
      return `{% call ${call} %}${body}{% endcall %}`;
    }
    if (body !== "") {
      error(`в шаблоне компонента <${node.tag}> нет слота`, node.loc);
    }
    return `{{ ${call} }}`;
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
    if (entry) {
      return error(
        "слот поддерживается только в компоненте: страницу и фрагмент сервер рендерит целиком",
        node.loc,
      );
    }
    hasSlot = true;
    return "{{ caller() }}";
  }

  /** Область видимости внутри ветки условия: связанное значение видно как переменная */
  function bind(scope: Scope, condition: Condition): Scope {
    if (!condition.binding) {
      return scope;
    }
    const { path, alias } = condition.binding;
    return {
      locals: new Set([...scope.locals, alias]),
      aliases: new Map([...scope.aliases, [path, alias]]),
    };
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
          `условие «${exp?.loc.source}» не поддерживается: допустимы путь к данным, его отрицание, сравнение с литералом и проверка на null`,
          loc,
        );
      }
      return condition;
    }
    const path = toPath(exp, scope, loc);
    return path ? { code: path } : undefined;
  }

  function toConditionNode(
    node: BabelNode,
    scope: Scope,
  ): Condition | undefined {
    if (node.type === "UnaryExpression" && node.operator === "!") {
      const path = pathOf(node.argument as BabelNode, scope);
      return path ? { code: dialect.not(path) } : undefined;
    }
    if (node.type === "LogicalExpression") {
      const left = toConditionNode(node.left as BabelNode, scope);
      const right = toConditionNode(node.right as BabelNode, scope);
      if (!left || !right || left.binding || right.binding) {
        return;
      }
      const operator =
        node.operator === "&&"
          ? dialect.and
          : node.operator === "||"
            ? dialect.or
            : undefined;
      return operator
        ? { code: `(${left.code}) ${operator} (${right.code})` }
        : undefined;
    }
    if (node.type === "BinaryExpression") {
      const path = pathOf(node.left as BabelNode, scope);
      if (path && isNullish(node.right as BabelNode)) {
        const alias = aliasFor(path, scope);
        if (node.operator === "!==" || node.operator === "!=") {
          return dialect.binds
            ? { code: dialect.some(path, alias), binding: { path, alias } }
            : { code: dialect.some(path, alias) };
        }
        if (node.operator === "===" || node.operator === "==") {
          return { code: dialect.none(path) };
        }
        return;
      }
      const operator = COMPARISON[node.operator];
      const left = path ?? literalOf(node.left as BabelNode);
      const right =
        pathOf(node.right as BabelNode, scope) ??
        literalOf(node.right as BabelNode);
      return operator && left && right
        ? { code: `${left} ${operator} ${right}` }
        : undefined;
    }
    const path = pathOf(node, scope);
    return path ? { code: path } : undefined;
  }

  /** Имя переменной для связанного значения: последний сегмент пути */
  function aliasFor(path: string, scope: Scope): string {
    const base = path.split(".").pop()!.replaceAll(/[^\w]/g, "") || "value";
    let alias = base;
    for (let i = 2; scope.locals.has(alias); i++) {
      alias = `${base}_${i}`;
    }
    return alias;
  }

  /** Значение props компонента: литерал или путь к данным */
  function toValue(
    exp: SimpleExpressionNode,
    scope: Scope,
    loc: SourceLocation,
  ): string | undefined {
    const literal = exp.ast ? literalOf(exp.ast) : undefined;
    return literal ?? toPath(exp, scope, loc);
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
      return resolve([exp.content.trim()], scope, loc);
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
    return resolve(segments, scope, loc);
  }

  /** Путь к данным для выражения вида a.b.c, иначе undefined без ошибки */
  function pathOf(node: BabelNode, scope: Scope): string | undefined {
    const segments = segmentsOf(node);
    return segments && resolve(segments, scope);
  }

  function resolve(
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
    // значение, связанное условием, заменяет свой путь: page.user → user
    for (let i = segments.length; i > 0; i--) {
      const alias = scope.aliases.get(joinPath(segments.slice(0, i)));
      if (alias) {
        return joinPath([alias, ...segments.slice(i)]);
      }
    }
    if (!scope.locals.has(head)) {
      params.add(head);
    }
    return joinPath(segments);
  }

  const code = children(nodes, { locals: new Set(), aliases: new Map() });
  const info: TemplateInfo = { params: [...params].sort(), hasSlot };
  const header = [...imports]
    .map(
      ([template, alias]) =>
        `{% import "${template}${dialect.extension}" as ${alias} %}`,
    )
    .join("");
  const body = entry
    ? code
    : `{% macro ${MACRO}(${info.params.join(", ")}) %}${code}{% endmacro %}`;
  return { code: header + body, errors, info };
}

function joinPath(segments: string[]) {
  return segments.reduce(
    (out, segment) =>
      segment.startsWith("[")
        ? out + segment
        : out
          ? `${out}.${segment}`
          : segment,
    "",
  );
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

/** Литерал шаблонизатора для литерала Vue */
function literalOf(node: BabelNode): string | undefined {
  switch (node.type) {
    case "StringLiteral":
      return toStringLiteral(node.value);
    case "NumericLiteral":
      return String(node.value);
    case "BooleanLiteral":
      return String(node.value);
  }
}

function isNullish(node: BabelNode) {
  return (
    node.type === "NullLiteral" ||
    (node.type === "Identifier" && node.name === "undefined")
  );
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

/** Экранирует разделители шаблонизатора в статическом тексте */
function escapeDelimiters(text: string) {
  return text.replaceAll(/\{[{%#]/g, (match) => `{{ "${match}" }}`);
}

function toStringLiteral(value: string) {
  return `"${value.replaceAll('"', '\\"')}"`;
}
