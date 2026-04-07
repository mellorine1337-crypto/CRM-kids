import { useContext } from "react";
import { LanguageContext } from "../context/language-context.js";

export const useI18n = () => useContext(LanguageContext);
