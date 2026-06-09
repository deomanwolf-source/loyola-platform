import DOMPurify from "dompurify";

const SAFE_URL_PATTERN =
  /^(?:(?:https?:|mailto:|tel:|\/(?!\/)|#|\.\.?\/|uploads\/|assets\/|staff\/|edutrack\/|loyola-crest\.jpg|favicon\.(?:png|jpg)|flag1\.png))/i;
const SAFE_IFRAME_SRC_PATTERN =
  /^https:\/\/(?:calendar\.google\.com\/calendar\/embed\b|www\.google\.com\/maps\b)/i;

const UNSAFE_CSS_PATTERN =
  /(?:@import|expression\s*\(|behavior\s*:|-moz-binding|javascript\s*:|vbscript\s*:|data\s*:|<\/?style|<\/?script)/gi;

const VISUAL_BUILDER_TRANSIENT_CLASSES = new Set([
  "reveal-on-scroll",
  "is-revealed",
  "reveal-stagger",
  "stagger-children",
  "stagger-fast",
  "animate-fade-in-up",
  "animate-fade-in",
  "animate-scale-in",
  "animate-grow-in",
  "animate-blur-in",
  "animate-slide-in-right",
]);

export const VISUAL_BUILDER_CANVAS_STATIC_CSS = `
  .reveal-on-scroll,
  .reveal-on-scroll.is-revealed,
  .reveal-stagger,
  .reveal-stagger > *,
  .stagger-children > *,
  .stagger-fast > *,
  .animate-fade-in-up,
  .animate-fade-in,
  .animate-scale-in,
  .animate-grow-in,
  .animate-blur-in,
  .animate-slide-in-right {
    opacity: 1 !important;
    visibility: visible !important;
    transform: none !important;
    filter: none !important;
    animation: none !important;
    transition: none !important;
  }
`;

export const VISUAL_BUILDER_STATIC_CSS = `
  .visual-page .reveal-on-scroll,
  .visual-page .reveal-on-scroll.is-revealed,
  .visual-page .reveal-stagger,
  .visual-page .reveal-stagger > *,
  .visual-page .stagger-children > *,
  .visual-page .stagger-fast > *,
  .visual-page .animate-fade-in-up,
  .visual-page .animate-fade-in,
  .visual-page .animate-scale-in,
  .visual-page .animate-grow-in,
  .visual-page .animate-blur-in,
  .visual-page .animate-slide-in-right {
    opacity: 1 !important;
    visibility: visible !important;
    transform: none !important;
    filter: none !important;
    animation: none !important;
    transition: none !important;
  }
`;

function sanitizeCssDeclaration(value: string) {
  const withoutUnsafeTokens = String(value || "").replace(UNSAFE_CSS_PATTERN, "");
  return withoutUnsafeTokens.replace(/url\(([^)]*)\)/gi, (match, rawUrl) => {
    const cleanUrl = String(rawUrl || "").trim().replace(/^['"]|['"]$/g, "");
    return SAFE_URL_PATTERN.test(cleanUrl) ? `url("${cleanUrl.replace(/"/g, "%22")}")` : "";
  });
}

export function sanitizeVisualCss(css?: string) {
  return sanitizeCssDeclaration(css || "").slice(0, 250000);
}

export function normalizeVisualBuilderHtml(html?: string) {
  if (!html || typeof document === "undefined") return html || "";

  const template = document.createElement("template");
  template.innerHTML = html;

  template.content.querySelectorAll<HTMLElement>("*").forEach((element) => {
    element.removeAttribute("data-website-editor-enabled");
    element.removeAttribute("data-website-section-active");

    const classValue = element.getAttribute("class");
    if (!classValue) return;

    const classNames = classValue
      .split(/\s+/)
      .map((className) => className.trim())
      .filter(Boolean)
      .filter(
        (className) =>
          !VISUAL_BUILDER_TRANSIENT_CLASSES.has(className) &&
          !className.startsWith("animation-delay-"),
      );

    if (classNames.length > 0) {
      element.setAttribute("class", classNames.join(" "));
    } else {
      element.removeAttribute("class");
    }
  });

  return template.innerHTML;
}

export function sanitizeVisualHtml(html?: string) {
  if (!html || typeof window === "undefined") return "";

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "a",
      "article",
      "aside",
      "b",
      "blockquote",
      "br",
      "button",
      "caption",
      "cite",
      "code",
      "col",
      "colgroup",
      "dd",
      "details",
      "div",
      "dl",
      "dt",
      "em",
      "figcaption",
      "figure",
      "footer",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "header",
      "hr",
      "i",
      "img",
      "li",
      "main",
      "nav",
      "ol",
      "p",
      "picture",
      "pre",
      "section",
      "small",
      "source",
      "span",
      "strong",
      "sub",
      "summary",
      "sup",
      "table",
      "tbody",
      "td",
      "tfoot",
      "th",
      "thead",
      "tr",
      "u",
      "ul",
      "video",
      "iframe",
    ],
    ADD_ATTR: [
      "class",
      "id",
      "style",
      "target",
      "loading",
      "playsinline",
      "controls",
      "data-cover",
      "data-gjs-type",
      "data-section-id",
      "data-title",
      "data-website-section",
      "frameborder",
      "referrerpolicy",
      "scrolling",
    ],
    ALLOWED_ATTR: [
      "alt",
      "aria-label",
      "aria-hidden",
      "aria-current",
      "aria-expanded",
      "aria-controls",
      "autoplay",
      "class",
      "colspan",
      "controls",
      "data-cover",
      "data-gjs-type",
      "data-section-id",
      "data-title",
      "data-website-section",
      "decoding",
      "fetchpriority",
      "frameborder",
      "height",
      "href",
      "id",
      "loading",
      "loop",
      "muted",
      "playsinline",
      "poster",
      "preload",
      "referrerpolicy",
      "rel",
      "role",
      "rowspan",
      "scrolling",
      "src",
      "style",
      "target",
      "title",
      "type",
      "width",
    ],
    ALLOWED_URI_REGEXP: SAFE_URL_PATTERN,
    FORBID_TAGS: ["script", "style", "object", "embed", "link", "meta"],
    FORBID_ATTR: ["srcdoc"],
  });
}

DOMPurify.addHook("uponSanitizeAttribute", (node, data) => {
  const attrName = data.attrName.toLowerCase();
  const value = String(data.attrValue || "");
  const tagName = node instanceof Element ? node.tagName.toLowerCase() : "";

  if (attrName.startsWith("on") || attrName === "srcdoc") {
    data.keepAttr = false;
    return;
  }

  if (tagName === "iframe") {
    if (attrName === "src" && !SAFE_IFRAME_SRC_PATTERN.test(value.trim())) {
      data.keepAttr = false;
      return;
    }

    if (["allow", "allowfullscreen"].includes(attrName)) {
      data.keepAttr = false;
      return;
    }
  }

  if (attrName === "style") {
    data.attrValue = sanitizeCssDeclaration(value);
    return;
  }

  if (["href", "src", "poster"].includes(attrName) && !SAFE_URL_PATTERN.test(value.trim())) {
    data.keepAttr = false;
  }
});
