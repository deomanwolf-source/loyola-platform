const assert = require("node:assert/strict");
const {
  sanitizeSiteDbSecurity,
  sanitizeVisualCss,
  sanitizeVisualHtml,
  scanVisualContent,
} = require("../backend/lib/sanitize-visual-content");

function assertClean(value, token) {
  assert.equal(
    String(value).toLowerCase().includes(token.toLowerCase()),
    false,
    `Expected sanitized output to remove ${token}`,
  );
}

const dirtySiteDb = {
  pages: {
    home: {
      visualHtml: `
        <section class="hero" data-block-id="1" style="color:#08286f;background-image:url('/uploads/hero.jpg')">
          <h1>Safe heading</h1>
          <img src="/uploads/photo.jpg" alt="Photo" onerror="alert(1)">
          <a href="javascript:alert(1)" onclick="alert(2)">Bad link</a>
          <a href="https://example.com" target="_blank">Safe link</a>
          <script>alert(3)</script>
          </style><script>alert(4)</script>
        </section>
      `,
      visualCss: `
        .hero { color: #08286f; background-image: url("/uploads/hero.jpg"); }
        @import url("https://evil.test/x.css");
        .bad { behavior: url(x); width: expression(alert(1)); background: url(javascript:alert(1)); }
        </style><script>alert(1)</script>
      `,
    },
  },
};

const cleanSiteDb = sanitizeSiteDbSecurity(dirtySiteDb);
const cleanHtml = cleanSiteDb.pages.home.visualHtml;
const cleanCss = cleanSiteDb.pages.home.visualCss;

assert.match(cleanHtml, /Safe heading/);
assert.match(cleanHtml, /class="hero"/);
assert.match(cleanHtml, /data-block-id="1"/);
assert.match(cleanHtml, /href="https:\/\/example\.com"/);
assert.match(cleanHtml, /rel="noopener noreferrer"/);
assert.match(cleanCss, /color:\s*#08286f/);
assert.match(cleanCss, /url\("\/uploads\/hero\.jpg"\)/);

for (const token of [
  "<script",
  "onerror",
  "onclick",
  "javascript:",
  "@import",
  "behavior",
  "expression",
  "</style",
]) {
  assertClean(cleanHtml, token);
  assertClean(cleanCss, token);
}

assert.deepEqual(scanVisualContent(cleanSiteDb), []);

const safeHtml = sanitizeVisualHtml(
  '<video controls muted playsinline poster="/uploads/poster.jpg"><source src="/uploads/video.mp4" type="video/mp4"></video>',
);
assert.match(safeHtml, /<video/);
assert.match(safeHtml, /controls/);
assert.match(safeHtml, /poster="\/uploads\/poster\.jpg"/);
assert.match(safeHtml, /<source/);

const safeCss = sanitizeVisualCss('.card { border-radius: 8px; background: url("/assets/bg.jpg"); }');
assert.match(safeCss, /border-radius:\s*8px/);
assert.match(safeCss, /url\("\/assets\/bg\.jpg"\)/);

console.log("Security smoke tests passed.");
