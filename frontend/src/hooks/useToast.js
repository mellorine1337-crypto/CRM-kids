import { useContext } from "react";
import { ToastContext } from "../context/toast-context.js";

export const useToast = () => useContext(ToastContext);
