// Кратко: сокращённый доступ к AuthContext через кастомный hook.
import { useContext } from "react";
import { AuthContext } from "../context/auth-context.js";

// Хук useAuth: инкапсулирует повторно используемую логику этого модуля.
export const useAuth = () => useContext(AuthContext);
