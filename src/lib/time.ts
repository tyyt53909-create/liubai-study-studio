import { isoDay } from "../../shared/domain";
import { dateLocale, type Locale } from "./i18n";
export const localDateTime = (d = new Date()) =>
  `${isoDay(d)}T${new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Hong_Kong", hour: "2-digit", minute: "2-digit", hour12: false }).format(d)}`;
export const humanDate = (d: string, locale: Locale = "zh-Hant") =>
  new Date(d).toLocaleString(dateLocale(locale), {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
export const timeText = (n: number) =>
  `${Math.floor(n / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(n % 60)
    .toString()
    .padStart(2, "0")}`;
