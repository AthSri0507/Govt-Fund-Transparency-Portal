export function getToken() {
  return localStorage.getItem('accessToken');
}

export function setToken(token) {
  if (!token) return;
  localStorage.setItem('accessToken', token);
}

export function clearToken() {
  localStorage.removeItem('accessToken');
}

export function setUser(user) {
  if (!user) return;
  localStorage.setItem('user', JSON.stringify(user));
}

export function getUser() {
  try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch (e) { return null; }
}

export function clearAll() {
  clearToken();
  localStorage.removeItem('user');
}
