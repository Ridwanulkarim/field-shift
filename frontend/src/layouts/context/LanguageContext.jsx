import { createContext, useContext, useEffect, useMemo, useState } from "react";

const LanguageContext = createContext({ language: "en", setLanguage: () => {} });

const PAGE = {
  en: {
    title: "Field Shift | Climate-aware crop rotation",
    description: "Field Shift helps farmers explore climate-aware crop rotation decisions.",
  },
  bn: {
    title: "ফিল্ড শিফট | জলবায়ু-সচেতন শস্য পর্যায়",
    description: "ফিল্ড শিফট কৃষকদের জলবায়ু-সচেতন শস্য পর্যায়ের সিদ্ধান্ত অনুসন্ধানে সহায়তা করে।",
  },
};

const readStored = () => {
  try {
    return localStorage.getItem("language") === "bn" ? "bn" : "en";
  } catch {
    return "en";
  }
};

export const LanguageProvider = ({ children }) => {
  const [language, setLanguageState] = useState(readStored);

  const setLanguage = (lang) => {
    const next = lang === "bn" ? "bn" : "en";
    setLanguageState(next);
    try {
      localStorage.setItem("language", next);
    } catch {
      /* storage blocked: the choice still applies for this visit */
    }
  };

  // The browser tab title, the page description and the document language follow the switch too.
  useEffect(() => {
    document.documentElement.lang = language;
    document.title = PAGE[language].title;
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute("content", PAGE[language].description);
  }, [language]);

  const value = useMemo(() => ({ language, setLanguage }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = () => useContext(LanguageContext);
