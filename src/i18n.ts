import { createContext, useContext } from "react";

export type Lang = "ckb" | "en";

export type Dict = {
  dir: "rtl" | "ltr";
  title: string;
  subtitle: string;
  rows: string;
  total: string;
  rowsPlaceholder: string;
  totalPlaceholder: string;
  generate: string;
  rowsLabel: (n: number) => string;
  sumLabel: (n: number) => string;
  copy: string;
  copyAs: string;
  copyMenuAria: string;
  copyTriggerAria: string;
  newline: string;
  comma: string;
  commaSpace: string;
  space: string;
  copyFormatAria: (label: string) => string;
  history: string;
  historyKept: (n: number, max: number) => string;
  noHistory: string;
  clear: string;
  profiles: string;
  newProfile: string;
  renameProfile: string;
  deleteProfile: string;
  profilePromptCreate: string;
  profilePromptRename: string;
  confirmDeleteProfile: (name: string) => string;
  cantDeleteOnlyProfile: string;
  profileCreated: (name: string) => string;
  removeEntry: string;
  language: string;
  english: string;
  kurdishCentral: string;
  // Toasts
  toastCopied: (label: string) => string;
  toastCopyFailed: string;
  toastCopyFailedFormat: (label: string) => string;
  toastRowsInvalid: string;
  toastTotalInvalid: string;
  // Pre-check
  warnSingleRow: string;
  warnFlat: string;
  warnFlatSuggest: (total: number) => string;
  warnRepeats: (pct: number) => string;
  warnRepeatsSuggest: (total: number) => string;
  warnLowUnique: (unique: number, n: number) => string;
  warnLowUniqueSuggest: (total: number) => string;
  blockRows: string;
  blockTotal: string;
};

const en: Dict = {
  dir: "ltr",
  title: "Integer Splitter",
  subtitle: "Generate random whole numbers that sum to an exact total.",
  rows: "Number of rows",
  total: "Target total",
  rowsPlaceholder: "e.g. 10",
  totalPlaceholder: "e.g. 1000",
  generate: "Generate",
  rowsLabel: (n) => `${n} rows`,
  sumLabel: (n) => `sum ${n}`,
  copy: "Copy",
  copyAs: "Copy as…",
  copyMenuAria: "Copy format options",
  copyTriggerAria: "Open copy format menu",
  copyFormatAria: (label) => `Copy as ${label}`,
  newline: "Newline-separated",
  comma: "Comma-separated",
  commaSpace: "Comma + space",
  space: "Space-separated",
  history: "History",
  historyKept: (n, max) => `${n} of ${max} kept locally`,
  noHistory: "No generations yet in this profile.",
  clear: "Clear",
  profiles: "Profiles",
  newProfile: "+ New profile…",
  renameProfile: "Rename current…",
  deleteProfile: "Delete current",
  profilePromptCreate: "Name this profile",
  profilePromptRename: "Rename profile",
  confirmDeleteProfile: (name) => `Delete profile "${name}"?`,
  cantDeleteOnlyProfile: "Can't delete the only profile",
  profileCreated: (name) => `Profile "${name}" created`,
  removeEntry: "Remove entry",
  language: "Language",
  english: "English",
  kurdishCentral: "کوردیی ناوەندی",
  toastCopied: (label) => `Copied (${label})`,
  toastCopyFailed: "Copy failed",
  toastCopyFailedFormat: (label) => `Copy failed (${label})`,
  toastRowsInvalid: "Rows must be a positive integer",
  toastTotalInvalid: "Target total must be an integer (no decimals)",
  warnSingleRow: "Only 1 row — the single value will equal the total exactly.",
  warnFlat: "Estimated variation is ~0 — every row will be the same or differ by ±1.",
  warnFlatSuggest: (t) => `Use total ${t} for visible variety`,
  warnRepeats: (pct) =>
    `Most rows (~${pct}%) will share the same value — results will look flat.`,
  warnRepeatsSuggest: (t) => `Use total ${t} for more variety`,
  warnLowUnique: (u, n) => `Only ~${u} distinct values expected across ${n} rows.`,
  warnLowUniqueSuggest: (t) => `Use total ${t} for richer spread`,
  blockRows: "Rows must be a positive integer.",
  blockTotal: "Target total must be an integer.",
};

const ckb: Dict = {
  dir: "rtl",
  title: "دابەشکەری ژمارە تەواوەکان",
  subtitle: "ژمارەی تەواوی هەڕەمەکی دروست بکە کە کۆیان بە تەواوی یەکسان بێت لەگەڵ کۆتای دیاریکراو.",
  rows: "ژمارەی ڕیزەکان",
  total: "کۆی ئامانج",
  rowsPlaceholder: "بۆ نموونە ١٠",
  totalPlaceholder: "بۆ نموونە ١٠٠٠",
  generate: "دروستکردن",
  rowsLabel: (n) => `${n} ڕیز`,
  sumLabel: (n) => `کۆ ${n}`,
  copy: "کۆپی",
  copyAs: "کۆپی بکە وەک…",
  copyMenuAria: "بژاردەکانی شێوازی کۆپی",
  copyTriggerAria: "کردنەوەی لیستی شێوازی کۆپی",
  copyFormatAria: (label) => `کۆپی بکە وەک ${label}`,
  newline: "بە دێڕی نوێ جیاکراوە",
  comma: "بە کۆما جیاکراوە",
  commaSpace: "کۆما و بۆشایی",
  space: "بە بۆشایی جیاکراوە",
  history: "مێژوو",
  historyKept: (n, max) => `${n} لە ${max} بە شێوەی ناوخۆیی پاشەکەوتکراوە`,
  noHistory: "هێشتا هیچ دروستکردنێک نییە لەم پرۆفایلەدا.",
  clear: "سڕینەوە",
  profiles: "پرۆفایلەکان",
  newProfile: "+ پرۆفایلی نوێ…",
  renameProfile: "ناوگۆڕینی ئێستا…",
  deleteProfile: "سڕینەوەی ئێستا",
  profilePromptCreate: "ناوێک بۆ ئەم پرۆفایلە دابنێ",
  profilePromptRename: "ناوگۆڕینی پرۆفایل",
  confirmDeleteProfile: (name) => `پرۆفایلی «${name}» بسڕیتەوە؟`,
  cantDeleteOnlyProfile: "ناتوانیت تاکە پرۆفایل بسڕیتەوە",
  profileCreated: (name) => `پرۆفایلی «${name}» دروستکرا`,
  removeEntry: "سڕینەوەی تۆمار",
  language: "زمان",
  english: "English",
  kurdishCentral: "کوردیی ناوەندی",
  toastCopied: (label) => `کۆپی کرا (${label})`,
  toastCopyFailed: "کۆپیکردن سەرکەوتوو نەبوو",
  toastRowsInvalid: "ڕیزەکان دەبێت ژمارەیەکی تەواوی پۆزەتیڤ بن",
  toastTotalInvalid: "کۆی ئامانج دەبێت ژمارەی تەواو بێت (بێ کەسرە)",
  warnSingleRow: "تەنها ١ ڕیز — بەهای تاکە ڕیز بە تەواوی یەکسان دەبێت لەگەڵ کۆ.",
  warnFlat: "گۆڕانکاری خەمڵێنراو نزیکەی ٠ە — هەموو ڕیزەکان وەک یەک یان جیاوازی ±١ دەبن.",
  warnFlatSuggest: (t) => `کۆی ${t} بەکاربێنە بۆ جۆراوجۆریی بەرچاو`,
  warnRepeats: (pct) =>
    `زۆربەی ڕیزەکان (~${pct}%) هەمان بەها دەبن — ئەنجامەکان وا دەردەکەون پانن.`,
  warnRepeatsSuggest: (t) => `کۆی ${t} بەکاربێنە بۆ جۆراوجۆریی زیاتر`,
  warnLowUnique: (u, n) => `تەنها نزیکەی ${u} بەهای جیاواز چاوەڕوان دەکرێت لە ${n} ڕیزدا.`,
  warnLowUniqueSuggest: (t) => `کۆی ${t} بەکاربێنە بۆ بڵاوبوونەوەی دەوڵەمەندتر`,
  blockRows: "ڕیزەکان دەبێت ژمارەیەکی تەواوی پۆزەتیڤ بن.",
  blockTotal: "کۆی ئامانج دەبێت ژمارەی تەواو بێت.",
};

export const dictionaries: Record<Lang, Dict> = { ckb, en };

export const I18nContext = createContext<{
  lang: Lang;
  setLang: (l: Lang) => void;
  t: Dict;
}>({
  lang: "ckb",
  setLang: () => {},
  t: ckb,
});

export const useI18n = () => useContext(I18nContext);
