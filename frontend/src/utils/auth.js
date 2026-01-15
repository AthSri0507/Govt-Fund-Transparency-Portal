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

export function userScopedKey(base) {
  const u = getUser()
  const id = u && (u.id || u.user_id || u.email) ? (u.id || u.user_id || u.email) : 'anon'
  return `${base}_${id}`
}

export function getUserScopedItem(base) {
  try { return localStorage.getItem(userScopedKey(base)) } catch (e) { return null }
}

export function setUserScopedItem(base, value) {
  try { return localStorage.setItem(userScopedKey(base), value) } catch (e) { return }
}

export function removeUserScopedItem(base) {
  try { return localStorage.removeItem(userScopedKey(base)) } catch (e) { return }
}

export function clearAll() {
  clearToken();
  localStorage.removeItem('user');
}
