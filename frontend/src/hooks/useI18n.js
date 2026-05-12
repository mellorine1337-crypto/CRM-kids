// Кратко: сокращённый доступ к локализации через кастомный hook.
import { useContext } from "react";
import { LanguageContext } from "../context/language-context.js";

// Хук useI18n: инкапсулирует повторно используемую логику этого модуля.
export const useI18n = () => useContext(LanguageContext);
