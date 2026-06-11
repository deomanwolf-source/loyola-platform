import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const HEADING_REPLACEMENTS: Record<string, string> = {
  "campus facilities and student services": "School Facilities and Student Services",
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const LOWERCASE_TITLE_WORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "but",
  "by",
  "for",
  "from",
  "in",
  "nor",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
]);

function capitalizeWord(word: string) {
  if (!word) return word;
  if (/^[A-Z0-9/&]+$/.test(word)) return word;
  if (/[a-z][A-Z]/.test(word) || /[A-Z]\./.test(word)) return word;

  return word
    .split("-")
    .map((part) => {
      if (!part) return part;
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join("-");
}

export function formatDisplayHeading(value?: string) {
  const trimmed = (value || "").trim().replace(/\s+/g, " ");
  if (!trimmed) return "";

  const withoutDot = trimmed.replace(/[.]+$/g, "");
  const replacement = HEADING_REPLACEMENTS[withoutDot.toLowerCase()];
  if (replacement) return replacement;

  const words = withoutDot.split(" ");
  return words
    .map((word, index) => {
      const baseWord = word.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "").toLowerCase();
      if (index > 0 && index < words.length - 1 && LOWERCASE_TITLE_WORDS.has(baseWord)) {
        return word.toLowerCase();
      }
      return capitalizeWord(word);
    })
    .join(" ");
}

export function normalizeHeadingHtml(html?: string) {
  if (!html) return "";

  const withReplacements = Object.entries(HEADING_REPLACEMENTS).reduce(
    (nextHtml, [source, replacement]) =>
      nextHtml.replace(new RegExp(escapeRegExp(source), "gi"), replacement),
    html,
  );

  return withReplacements.replace(
    /(<h[1-6]\b[^>]*>)([^<]*)(<\/h[1-6]>)/gi,
    (_match, open: string, text: string, close: string) =>
      `${open}${formatDisplayHeading(text)}${close}`,
  );
}
