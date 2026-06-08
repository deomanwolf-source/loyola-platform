import DOMPurify from "dompurify";

const SAFE_URL_PATTERN =
  /^(?:(?:https?:|mailto:|tel:|\/(?!\/)|#|\.\.?\/|uploads\/|assets\/|staff\/|edutrack\/|loyola-crest\.jpg|favicon\.(?:png|jpg)|flag1\.png))/i;

const UNSAFE_CSS_PATTERN =
  /(?:@import|expression\s*\(|behavior\s*:|-moz-binding|javascript\s*:|vbscript\s*:|data\s*:|<\/?style|<\/?script)/gi;

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
      "data-title",
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
      "data-title",
      "decoding",
      "fetchpriority",
      "height",
      "href",
      "id",
      "loading",
      "loop",
      "muted",
      "playsinline",
      "poster",
      "preload",
      "rel",
      "role",
      "rowspan",
      "src",
      "style",
      "target",
      "title",
      "type",
      "width",
    ],
    ALLOWED_URI_REGEXP: SAFE_URL_PATTERN,
    FORBID_TAGS: ["iframe", "script", "style", "object", "embed", "link", "meta"],
    FORBID_ATTR: ["srcdoc"],
  });
}

DOMPurify.addHook("uponSanitizeAttribute", (_node, data) => {
  const attrName = data.attrName.toLowerCase();
  const value = String(data.attrValue || "");

  if (attrName.startsWith("on") || attrName === "srcdoc") {
    data.keepAttr = false;
    return;
  }

  if (attrName === "style") {
    data.attrValue = sanitizeCssDeclaration(value);
    return;
  }

  if (["href", "src", "poster"].includes(attrName) && !SAFE_URL_PATTERN.test(value.trim())) {
    data.keepAttr = false;
  }
});
