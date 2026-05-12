// Кратко: экспортирует React context для авторизации без логики, чтобы им пользовались hooks и provider.
import { createContext } from "react";

export const AuthContext = createContext(null);
