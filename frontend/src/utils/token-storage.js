// Кратко: чтение и запись access/refresh token в localStorage.
const ACCESS_TOKEN_KEY = "kids-crm.accessToken";
const REFRESH_TOKEN_KEY = "kids-crm.refreshToken";

// Функция getAccessToken: возвращает значение или подготовленные данные по входным параметрам.
export const getAccessToken = () => localStorage.getItem(ACCESS_TOKEN_KEY);
// Функция getRefreshToken: возвращает значение или подготовленные данные по входным параметрам.
export const getRefreshToken = () => localStorage.getItem(REFRESH_TOKEN_KEY);

// Служебная функция setTokens: инкапсулирует отдельный шаг логики этого модуля.
export const setTokens = (tokens) => {
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
};

// Служебная функция clearTokens: инкапсулирует отдельный шаг логики этого модуля.
export const clearTokens = () => {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
};
