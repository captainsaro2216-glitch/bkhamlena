import { useEffect, useState, type ReactNode } from "react";
import { I18nContext, dictionaries, type Lang } from "@/i18n";

const STORAGE_KEY = "integer-splitter-lang";

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Lang | null;
      if (saved === "ckb" || saved === "en") return saved;
    } catch {
      // ignore
    }
    return "ckb";
  });

  useEffect(() => {
    const t = dictionaries[lang];
    document.documentElement.lang = lang === "ckb" ? "ckb" : "en";
    document.documentElement.dir = t.dir;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // ignore
    }
  }, [lang]);

  return (
    <I18nContext.Provider
      value={{ lang, setLang: setLangState, t: dictionaries[lang] }}
    >
      {children}
    </I18nContext.Provider>
  );
}
