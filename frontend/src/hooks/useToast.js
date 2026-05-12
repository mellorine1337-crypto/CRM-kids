// Кратко: сокращённый доступ к toast-контексту.
import { useContext } from "react";
import { ToastContext } from "../context/toast-context.js";

// Хук useToast: инкапсулирует повторно используемую логику этого модуля.
export const useToast = () => useContext(ToastContext);
