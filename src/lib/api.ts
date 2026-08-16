export const getAuthHeader = () => {
  const token = localStorage.getItem('sabay_jwt_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

export const apiFetch = async (url: string, options: any = {}) => {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
    ...getAuthHeader(),
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  const response = await fetch(url, { ...options, headers, signal: controller.signal });
  clearTimeout(timeoutId);
  if (response.status === 401 || response.status === 403) {
    // 如果 token 失效，清除並可能需要重新驗證 PIN
    localStorage.removeItem('sabay_jwt_token');
  }
  return response;
};
