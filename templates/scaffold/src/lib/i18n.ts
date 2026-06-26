import { useLocale } from "@numueg/theme-sdk";

/**
 * Locale-aware string picker for the theme's own chrome (nav, buttons, empty
 * states, etc.) so the store reads correctly in both English (LTR) and Arabic
 * (RTL). Merchant-authored content comes from settings; this only covers the
 * fixed UI strings the theme ships.
 *
 *   const t = useT();
 *   t("Add to cart", "أضف إلى السلة")
 */
export function useT(): (en: string, ar: string) => string {
  const locale = useLocale();
  const isAr =
    typeof locale === "string" && locale.toLowerCase().startsWith("ar");
  return (en, ar) => (isAr ? ar : en);
}
