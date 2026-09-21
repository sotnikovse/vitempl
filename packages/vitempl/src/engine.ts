import type { TemplateChildNode } from "@vue/compiler-core";

/**
 * Шаблонизатор, для которого собираются шаблоны.
 *
 * Исходники шаблонов всегда пишутся на Vue SFC, а шаблоны для сервера
 * генерирует адаптер шаблонизатора. Для другого шаблонизатора
 * (Jinja, Tera и т.п.) пишется свой адаптер, исходники и ядро плагина
 * при этом не меняются.
 */
export interface TemplateEngine {
  /** Название шаблонизатора для сообщений */
  name: string;
  /** Расширение собранных шаблонов, например `.hbs` */
  extension: string;
  /**
   * Разбирает шаблон до генерации. Нужен шаблонизаторам, где вызов
   * компонента зависит от самого компонента: например, в Jinja и askama
   * компонент становится макросом, и вызывающий должен знать его параметры.
   */
  analyze?(nodes: TemplateChildNode[], context: GenerateContext): TemplateInfo;
  /** Генерирует шаблон из шаблона Vue SFC */
  generate(
    nodes: TemplateChildNode[],
    context: GenerateContext,
  ): GenerateResult;
}

export interface GenerateContext {
  /** Импортированные компоненты: имя тега (`AppHeader`, `app-header`) → имя шаблона (`partials/AppHeader`) */
  components: Map<string, string>;
  /** Имя самого шаблона: путь от папки исходников без расширения */
  name: string;
  /** Шаблон — вход сборки (страница или фрагмент): его данные готовит сервер */
  entry: boolean;
  /**
   * Результаты `analyze` по именам шаблонов. Во время `analyze` заполняется
   * и полным становится только к генерации, а у шаблонизаторов без `analyze`
   * и при проверке одного файла остаётся пустым.
   */
  templates: ReadonlyMap<string, TemplateInfo>;
}

export interface TemplateInfo {
  /** Данные, к которым обращается шаблон: props компонента, которые он использует */
  params: string[];
  /** В шаблоне есть слот */
  hasSlot: boolean;
}

export interface GenerateResult {
  code: string;
  errors: TemplateDiagnostic[];
}

export interface TemplateLocation {
  line: number;
  column: number;
}

export interface TemplateDiagnostic {
  message: string;
  loc: TemplateLocation;
}
