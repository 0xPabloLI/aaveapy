import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import enLanding from "@/locales/en/landing.json";
import enUi from "@/locales/en/ui.json";
import ptLanding from "@/locales/pt-BR/landing.json";
import frLanding from "@/locales/fr/landing.json";
import trLanding from "@/locales/tr/landing.json";

export type SupportedLocale = "en" | "pt-BR" | "fr" | "tr";

export const LOCALE_PATH_MAP: Record<Exclude<SupportedLocale, "en">, string> = {
  "pt-BR": "pt-br",
  fr: "fr",
  tr: "tr",
};

export const PATH_LOCALE_MAP: Record<string, SupportedLocale> = {
  "pt-br": "pt-BR",
  fr: "fr",
  tr: "tr",
};

export const SITE_ORIGIN = "https://aaveapy.com";

void i18n.use(initReactI18next).init({
  resources: {
    en: { landing: enLanding, ui: enUi },
    "pt-BR": { landing: ptLanding, ui: enUi },
    fr: { landing: frLanding, ui: enUi },
    tr: { landing: trLanding, ui: enUi },
  },
  lng: "en",
  fallbackLng: "en",
  defaultNS: "ui",
  ns: ["ui", "landing"],
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

export default i18n;
