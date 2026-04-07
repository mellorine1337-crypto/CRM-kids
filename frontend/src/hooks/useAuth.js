import { useContext } from "react";
import { AuthContext } from "../context/auth-context.js";

export const useAuth = () => useContext(AuthContext);
