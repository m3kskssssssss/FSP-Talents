import type { CalcTemplate, QuizTemplate } from "../../types";
import { c, other, p, scenarioQuiz } from "../util";

const FE = "frontend" as const;

// ---------------------------------------------------------------- calc

const boxWidth: CalcTemplate<{ w: number; pad: number; border: number; sizing: "content-box" | "border-box" }> = {
  id: "fe-calc-box-model",
  specialization: FE,
  kind: "calc",
  title: "Блочная модель",
  skills: ["css"],
  b: -1.8,
  a: 1.0,
  params: (rng) => ({ w: rng.pick([200, 240, 300, 320, 360]), pad: rng.pick([8, 12, 16, 24]), border: rng.int(1, 4), sizing: rng.pick(["content-box", "border-box"] as const) }),
  twin: { key: "pad", alt: (pp, rng) => ({ ...pp, pad: other(rng, [8, 12, 16, 24], pp.pad) }) },
  statement: (pp, t) => [
    p("У блока заданы ", c(`box-sizing: ${pp.sizing}`), ", ", c(`width: ${pp.w}px`), ", padding ", t.v("pad", pp.pad), "px со всех сторон и border ", t.v("border", pp.border), "px."),
    p(pp.sizing === "content-box" ? "Какова полная ширина блока на странице (px)?" : "Какова ширина области контента (px)?"),
  ],
  answer: (pp) => (pp.sizing === "content-box" ? pp.w + 2 * pp.pad + 2 * pp.border : pp.w - 2 * pp.pad - 2 * pp.border),
  answerHint: "Целое число пикселей",
};

const PARTS = [
  { s: "#main", v: [1, 0, 0] },
  { s: ".card", v: [0, 1, 0] },
  { s: ".active", v: [0, 1, 0] },
  { s: "[type=text]", v: [0, 1, 0] },
  { s: ":hover", v: [0, 1, 0] },
  { s: "ul", v: [0, 0, 1] },
  { s: "li", v: [0, 0, 1] },
  { s: "::before", v: [0, 0, 1] },
  { s: "#nav", v: [1, 0, 0] },
];
const specificity: CalcTemplate<{ parts: number[] }> = {
  id: "fe-calc-specificity",
  specialization: FE,
  kind: "calc",
  title: "Специфичность селектора",
  skills: ["css"],
  b: -0.3,
  a: 1.2,
  params: (rng) => ({ parts: rng.sample(PARTS.map((_, i) => i), rng.int(3, 5)) }),
  statement: (pp) => [p("Вычислите специфичность селектора в формате ", c("a,b,c"), " (id, классы/атрибуты/псевдоклассы, элементы/псевдоэлементы):"), { type: "code", text: pp.parts.map((i) => PARTS[i]!.s).join(" ") }],
  answer: (pp) => [0, 1, 2].map((k) => pp.parts.reduce((s, i) => s + PARTS[i]!.v[k]!, 0)).join(","),
  answerHint: "Три числа через запятую, например 0,2,1",
};

const rem: CalcTemplate<{ root: number; value: number }> = {
  id: "fe-calc-rem",
  specialization: FE,
  kind: "calc",
  title: "rem в пиксели",
  skills: ["css"],
  b: -2.1,
  a: 0.9,
  params: (rng) => ({ root: rng.pick([14, 16, 18, 20]), value: rng.pick([0.75, 1.25, 1.5, 2.5, 3]) }),
  twin: { key: "root", alt: (pp, rng) => ({ ...pp, root: other(rng, [14, 16, 18, 20], pp.root) }) },
  statement: (pp, t) => [p("У ", c("html"), " задан font-size ", t.v("root", pp.root), "px. Сколько пикселей составляет ", c(`${pp.value}rem`), "?")],
  answer: (pp) => pp.root * pp.value,
  answerHint: "Число, можно с дробной частью",
  tolerance: 0.01,
};

const flexGrow: CalcTemplate<{ w: number; basis: number[]; grow: number[]; k: number }> = {
  id: "fe-calc-flex-grow",
  specialization: FE,
  kind: "calc",
  title: "Распределение flex-grow",
  skills: ["css"],
  b: 0.6,
  a: 1.3,
  params: (rng) => ({ w: rng.pick([600, 800, 900, 1000]), basis: [rng.pick([100, 150, 200]), rng.pick([100, 120, 200]), rng.pick([50, 100])], grow: [rng.int(0, 2), rng.int(1, 3), rng.int(1, 2)], k: rng.int(0, 2) }),
  twin: { key: "w", alt: (pp, rng) => ({ ...pp, w: other(rng, [600, 800, 900, 1000], pp.w) }) },
  statement: (pp, t) => [
    p("Flex-контейнер шириной ", t.v("w", pp.w), "px без отступов и gap содержит три элемента (box-sizing: border-box, без padding):"),
    { type: "table", head: ["Элемент", "flex-basis", "flex-grow"], rows: pp.basis.map((b, i) => [String(i + 1), `${b}px`, String(pp.grow[i])]) },
    p("Какой будет ширина элемента №", String(pp.k + 1), " (px)? Округлите до целого."),
  ],
  answer: (pp) => {
    const free = pp.w - pp.basis.reduce((s, x) => s + x, 0);
    const g = pp.grow.reduce((s, x) => s + x, 0);
    return Math.round(pp.basis[pp.k]! + (g ? (free * pp.grow[pp.k]!) / g : 0));
  },
  answerHint: "Целое число пикселей",
  tolerance: 1,
};

const gridCols: CalcTemplate<{ w: number; min: number; gap: number }> = {
  id: "fe-calc-grid-columns",
  specialization: FE,
  kind: "calc",
  title: "Колонки auto-fill",
  skills: ["css"],
  b: 0.9,
  a: 1.2,
  params: (rng) => ({ w: rng.pick([960, 1024, 1200, 1280]), min: rng.pick([180, 200, 220, 260]), gap: rng.pick([12, 16, 24]) }),
  twin: { key: "min", alt: (pp, rng) => ({ ...pp, min: other(rng, [180, 200, 220, 260], pp.min) }) },
  statement: (pp, t) => [
    p("Контейнер шириной ", t.v("w", pp.w), "px, ", c(`grid-template-columns: repeat(auto-fill, minmax(${pp.min}px, 1fr))`), " — на экране минимальная ширина ", t.v("min", pp.min), "px, ", c(`gap: ${pp.gap}px`), "."),
    p("Сколько колонок будет в сетке?"),
  ],
  answer: (pp) => Math.floor((pp.w + pp.gap) / (pp.min + pp.gap)),
  answerHint: "Целое число",
};

const cacheHits: CalcTemplate<{ maxAge: number; times: number[] }> = {
  id: "fe-calc-http-cache",
  specialization: FE,
  kind: "calc",
  title: "HTTP-кэш браузера",
  skills: ["http", "производительность"],
  b: 0.2,
  a: 1.1,
  params: (rng) => ({ maxAge: rng.pick([30, 60, 120]), times: Array.from({ length: 8 }, () => rng.int(0, 300)).sort((a, b) => a - b) }),
  twin: { key: "maxAge", alt: (pp, rng) => ({ ...pp, maxAge: other(rng, [30, 60, 120], pp.maxAge) }) },
  statement: (pp, t) => [
    p("Ответ приходит с ", c(`Cache-Control: max-age=`), t.v("maxAge", pp.maxAge), ". Ресурс запрашивается в моменты (секунды):"),
    { type: "code", text: pp.times.join(", ") },
    p("Каждый сетевой запрос обновляет кэш; запрос в момент, когда с последней загрузки прошло меньше max-age, берётся из кэша. Сколько раз браузер пойдёт в сеть?"),
  ],
  answer: (pp) => {
    let last = -Infinity;
    let n = 0;
    for (const t of pp.times) if (t - last >= pp.maxAge) [last, n] = [t, n + 1];
    return n;
  },
  answerHint: "Целое число",
};

const aspect: CalcTemplate<{ w: number; rw: number; rh: number }> = {
  id: "fe-calc-aspect-ratio",
  specialization: FE,
  kind: "calc",
  title: "Соотношение сторон",
  skills: ["css"],
  b: -1.5,
  a: 0.9,
  params: (rng) => ({ w: rng.pick([320, 480, 640, 960]), rw: rng.pick([16, 4, 3, 21]), rh: 9 }),
  twin: { key: "w", alt: (pp, rng) => ({ ...pp, w: other(rng, [320, 480, 640, 960], pp.w) }) },
  statement: (pp, t) => [p("Видео-контейнер шириной ", t.v("w", pp.w), "px имеет ", c(`aspect-ratio: ${pp.rw} / ${pp.rh}`), ". Какова его высота (px)? Округлите до целого.")],
  answer: (pp) => Math.round((pp.w * pp.rh) / pp.rw),
  answerHint: "Целое число пикселей",
  tolerance: 1,
};

const contrast: CalcTemplate<{ a: number; b: number }> = {
  id: "fe-calc-contrast",
  specialization: FE,
  kind: "calc",
  title: "Контраст по WCAG",
  skills: ["доступность"],
  b: 1.8,
  a: 1.2,
  params: (rng) => ({ a: rng.pick([0, 34, 51, 68, 85]), b: rng.pick([170, 204, 221, 238, 255]) }),
  twin: { key: "a", alt: (pp, rng) => ({ ...pp, a: other(rng, [0, 34, 51, 68, 85], pp.a) }) },
  statement: (pp, t) => [
    p("Текст цвета rgb(", t.v("a", pp.a), ", ", t.v("a", pp.a), ", ", t.v("a", pp.a), ") на фоне rgb(", String(pp.b), ", ", String(pp.b), ", ", String(pp.b), "). Вычислите коэффициент контраста по WCAG 2: относительная яркость L = 0.2126R + 0.7152G + 0.0722B, где канал c/255 линеаризуется: c ≤ 0.04045 → c/12.92, иначе ((c+0.055)/1.055)^2.4; контраст = (L1 + 0.05) / (L2 + 0.05)."),
    p("Округлите до двух знаков после запятой."),
  ],
  answer: (pp) => {
    const lin = (v: number) => {
      const x = v / 255;
      return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    };
    const la = lin(pp.a);
    const lb = lin(pp.b);
    return Math.round(((Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)) * 100) / 100;
  },
  answerHint: "Число с двумя знаками, например 4.54",
  tolerance: 0.011,
};

// ---------------------------------------------------------------- quiz

const eventLoop = scenarioQuiz({
  id: "fe-quiz-event-loop",
  specialization: FE,
  title: "Event loop",
  skills: ["javascript", "асинхронность"],
  b: 0.7,
  a: 1.2,
  question: "Что выведет код в консоль?",
  scenarios: [
    { s: "console.log(1); setTimeout(() => console.log(2)); Promise.resolve().then(() => console.log(3)); console.log(4);", a: "1 4 3 2" },
    { s: "setTimeout(() => console.log(1)); queueMicrotask(() => console.log(2)); console.log(3);", a: "3 2 1" },
    { s: "Promise.resolve().then(() => console.log(1)).then(() => console.log(2)); Promise.resolve().then(() => console.log(3));", a: "1 3 2" },
    { s: "(async () => { console.log(1); await null; console.log(2); })(); console.log(3);", a: "1 3 2" },
    { s: "setTimeout(() => console.log(1), 0); console.log(2); Promise.reject().catch(() => console.log(3));", a: "2 3 1" },
  ],
});

const hooks = scenarioQuiz({
  id: "fe-quiz-react-hooks",
  specialization: FE,
  title: "Хуки React",
  skills: ["react"],
  b: 0.1,
  a: 1.1,
  question: "Какое решение правильное для ситуации в React-компоненте?",
  scenarios: [
    { s: "Эффект подписывается на событие окна и должен отписаться при размонтировании", a: "Вернуть функцию очистки из useEffect" },
    { s: "Дорогое вычисление списка по фильтру выполняется на каждый рендер", a: "Обернуть вычисление в useMemo с зависимостями" },
    { s: "Нужно хранить id таймера между рендерами без перерисовки при изменении", a: "Хранить в useRef" },
    { s: "Эффект использует проп userId, но массив зависимостей пустой — данные не обновляются", a: "Добавить userId в массив зависимостей" },
    { s: "Колбэк передаётся в мемоизированный дочерний компонент и вызывает лишние ререндеры", a: "Обернуть колбэк в useCallback" },
  ],
});

const a11y = scenarioQuiz({
  id: "fe-quiz-a11y",
  specialization: FE,
  title: "Доступность интерфейса",
  skills: ["доступность", "html"],
  b: -0.8,
  a: 1.0,
  question: "Как правильно поступить с точки зрения доступности?",
  scenarios: [
    { s: "Кликабельный div открывает модальное окно", a: "Использовать <button type=\"button\">" },
    { s: "Поле ввода без видимой подписи, только placeholder", a: "Добавить <label for> или aria-label" },
    { s: "Иконка-картинка несёт смысл «Удалить»", a: "Дать alt или aria-label «Удалить»" },
    { s: "Ошибка формы показывается только красной рамкой", a: "Добавить текст ошибки, связанный через aria-describedby" },
    { s: "Модальное окно открыто, но фокус остаётся на странице под ним", a: "Перенести фокус в модалку и удерживать его внутри" },
  ],
});

const webSecurity = scenarioQuiz({
  id: "fe-quiz-web-security",
  specialization: FE,
  title: "Безопасность веба",
  skills: ["безопасность", "http"],
  b: 1.2,
  a: 1.1,
  question: "Какая угроза или механизм описан?",
  scenarios: [
    { s: "Пользовательский комментарий вставляется в DOM через innerHTML, и в нём срабатывает <img onerror>", a: "XSS" },
    { s: "Сторонний сайт отправляет форму на ваш домен от имени залогиненного пользователя с его cookie", a: "CSRF" },
    { s: "Браузер блокирует ответ fetch к API на другом домене без заголовка Access-Control-Allow-Origin", a: "CORS" },
    { s: "Ваш сайт показывают в невидимом iframe, чтобы пользователь нажал на скрытую кнопку", a: "Clickjacking" },
    { s: "Cookie с флагом SameSite=Lax не отправляется при POST-запросе с чужого сайта", a: "Защита от CSRF средствами браузера" },
  ],
});

const vitals = scenarioQuiz({
  id: "fe-quiz-web-vitals",
  specialization: FE,
  title: "Метрики производительности",
  skills: ["производительность"],
  b: 1.6,
  a: 1.0,
  question: "Какая метрика Core Web Vitals в первую очередь ухудшится?",
  scenarios: [
    { s: "Баннер подгружается позже и сдвигает уже видимый текст вниз", a: "CLS" },
    { s: "Главное изображение первого экрана грузится 4 секунды", a: "LCP" },
    { s: "После клика по кнопке интерфейс 600 мс не реагирует из-за долгой задачи в главном потоке", a: "INP" },
    { s: "Шрифт без font-display блокирует отрисовку крупного заголовка первого экрана", a: "LCP" },
  ],
});

const positioning = scenarioQuiz({
  id: "fe-quiz-css-position",
  specialization: FE,
  title: "Позиционирование в CSS",
  skills: ["css"],
  b: -1.3,
  a: 0.9,
  question: "Какое значение position подходит?",
  scenarios: [
    { s: "Шапка таблицы должна прилипать к верху при прокрутке своего контейнера", a: "sticky" },
    { s: "Бейдж в правом верхнем углу карточки, карточка — position: relative", a: "absolute" },
    { s: "Кнопка «Наверх» всегда в правом нижнем углу окна", a: "fixed" },
    { s: "Сдвинуть элемент на 4px вниз, не влияя на соседей", a: "relative" },
  ],
});

const rendering = scenarioQuiz({
  id: "fe-quiz-rendering",
  specialization: FE,
  title: "Стратегии рендеринга",
  skills: ["react", "архитектура"],
  b: 2.1,
  a: 1.0,
  question: "Какая стратегия рендеринга подходит лучше всего?",
  scenarios: [
    { s: "Документация, которая меняется раз в неделю, и важна скорость первой загрузки", a: "Статическая генерация (SSG)" },
    { s: "Страница товара: цена и наличие меняются каждые несколько минут, нужна индексация", a: "ISR / SSR с кэшированием" },
    { s: "Личный кабинет за авторизацией с интерактивными графиками, SEO не нужно", a: "Клиентский рендеринг (CSR)" },
    { s: "Лента, где часть страницы быстрая, а виджет рекомендаций — медленный", a: "Потоковый SSR с Suspense" },
  ],
});

export const frontendCalc = [boxWidth, specificity, rem, flexGrow, gridCols, cacheHits, aspect, contrast] as CalcTemplate[];
export const frontendQuiz = [eventLoop, hooks, a11y, webSecurity, vitals, positioning, rendering] as QuizTemplate[];
