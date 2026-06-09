const sanitizeHtml = require("sanitize-html");

const SAFE_URL_PATTERN =
  /^(?:(?:https?:|mailto:|tel:|\/(?!\/)|#|\.\.?\/|uploads\/|assets\/|staff\/|edutrack\/|loyola-crest\.jpg|favicon\.(?:png|jpg)|flag1\.png))/i;
const SAFE_IFRAME_SRC_PATTERN =
  /^https:\/\/(?:calendar\.google\.com\/calendar\/embed\b|www\.google\.com\/maps\b)/i;

const UNSAFE_HTML_PATTERN =
  /<\s*script|<\s*object|<\s*embed|<\s*link|<\s*meta|\son[a-z]+\s*=|javascript\s*:|vbscript\s*:|srcdoc\s*=|<\/\s*style/i;

const UNSAFE_CSS_PATTERN =
  /(?:@import|expression\s*\(|behavior\s*:|-moz-binding|javascript\s*:|vbscript\s*:|data\s*:|<\/?style|<\/?script)/gi;

function sanitizeCssDeclaration(value) {
  const withoutUnsafeTokens = String(value || "").replace(UNSAFE_CSS_PATTERN, "");
  return withoutUnsafeTokens.replace(/url\(([^)]*)\)/gi, (match, rawUrl) => {
    const cleanUrl = String(rawUrl || "").trim().replace(/^['"]|['"]$/g, "");
    return SAFE_URL_PATTERN.test(cleanUrl) ? `url("${cleanUrl.replace(/"/g, "%22")}")` : "";
  });
}

function sanitizeVisualCss(css) {
  return sanitizeCssDeclaration(css || "").slice(0, 250000);
}

function isSafeUrl(value) {
  const text = String(value || "").trim();
  return !text || SAFE_URL_PATTERN.test(text);
}

function sanitizeAttributes(attribs = {}, tagName = "") {
  const next = {};

  for (const [name, rawValue] of Object.entries(attribs)) {
    const attrName = String(name || "").toLowerCase();
    const value = String(rawValue || "");

    if (attrName.startsWith("on") || attrName === "srcdoc") continue;
    if (tagName === "iframe") {
      if (attrName === "src" && !SAFE_IFRAME_SRC_PATTERN.test(value.trim())) continue;
      if (["allow", "allowfullscreen"].includes(attrName)) continue;
    }
    if (attrName === "style") {
      const cleanStyle = sanitizeCssDeclaration(value);
      if (cleanStyle.trim()) next[attrName] = cleanStyle;
      continue;
    }
    if (["href", "src", "poster"].includes(attrName) && !isSafeUrl(value)) continue;
    if (attrName === "target" && value === "_blank") {
      next[attrName] = value;
      next.rel = "noopener noreferrer";
      continue;
    }

    next[attrName] = value;
  }

  return next;
}

function sanitizeVisualHtml(html) {
  if (!html) return "";

  return sanitizeHtml(String(html), {
    allowedTags: [
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
    allowedAttributes: {
      "*": [
        "alt",
        "aria-hidden",
        "aria-label",
        "aria-current",
        "aria-expanded",
        "aria-controls",
        "autoplay",
        "class",
        "colspan",
        "controls",
        "data-*",
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
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: {},
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
    enforceHtmlBoundary: true,
    parseStyleAttributes: false,
    transformTags: {
      "*": (tagName, attribs) => ({ tagName, attribs: sanitizeAttributes(attribs, tagName) }),
    },
  });
}

function sanitizeSiteDbSecurity(siteDb) {
  const nextDb = JSON.parse(JSON.stringify(siteDb || {}));
  const pages = nextDb.pages && typeof nextDb.pages === "object" ? nextDb.pages : {};

  for (const page of Object.values(pages)) {
    if (!page || typeof page !== "object") continue;
    if (typeof page.visualHtml === "string") {
      page.visualHtml = sanitizeVisualHtml(page.visualHtml);
    }
    if (typeof page.visualCss === "string") {
      page.visualCss = sanitizeVisualCss(page.visualCss);
    }
    if (typeof page.visualBaseCss === "string") {
      page.visualBaseCss = sanitizeVisualCss(page.visualBaseCss);
    }
  }

  return nextDb;
}

function scanVisualContent(siteDb) {
  const pages = siteDb?.pages && typeof siteDb.pages === "object" ? siteDb.pages : {};
  const issues = [];

  for (const [slug, page] of Object.entries(pages)) {
    if (!page || typeof page !== "object") continue;
    const html = typeof page.visualHtml === "string" ? page.visualHtml : "";
    const css = typeof page.visualCss === "string" ? page.visualCss : "";
    const baseCss = typeof page.visualBaseCss === "string" ? page.visualBaseCss : "";

    const htmlWithoutSafeIframes = html.replace(
      /<iframe\b[^>]*\bsrc=["']https:\/\/(?:calendar\.google\.com\/calendar\/embed\b|www\.google\.com\/maps\b)[^"']*["'][^>]*>\s*<\/iframe>/gi,
      "",
    );

    if (htmlWithoutSafeIframes && UNSAFE_HTML_PATTERN.test(htmlWithoutSafeIframes)) {
      issues.push({ slug, field: "visualHtml", issue: "Potential executable HTML or unsafe URL" });
    }
    if (/<iframe\b/i.test(htmlWithoutSafeIframes)) {
      issues.push({ slug, field: "visualHtml", issue: "Unsafe iframe source" });
    }
    if (css && UNSAFE_CSS_PATTERN.test(css)) {
      issues.push({ slug, field: "visualCss", issue: "Potential unsafe CSS token" });
    }
    if (baseCss && UNSAFE_CSS_PATTERN.test(baseCss)) {
      issues.push({ slug, field: "visualBaseCss", issue: "Potential unsafe CSS token" });
    }
  }

  return issues;
}

module.exports = {
  sanitizeSiteDbSecurity,
  sanitizeVisualCss,
  sanitizeVisualHtml,
  scanVisualContent,
};
