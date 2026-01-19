import axios from 'axios'
import { getToken, setToken, getRefreshToken, setRefreshToken, clearToken, clearRefreshToken } from './auth'

let isRefreshing = false
let refreshQueue = []

function processQueue(error, token = null) {
  refreshQueue.forEach(prom => {
    if (error) prom.reject(error)
    else prom.resolve(token)
  })
  refreshQueue = []
}

// attach access token to requests
axios.interceptors.request.use((config) => {
  const token = getToken()
  if (token) config.headers = { ...(config.headers || {}), Authorization: `Bearer ${token}` }
  return config
}, err => Promise.reject(err))

// handle 401 responses by attempting refresh
axios.interceptors.response.use(response => response, async (error) => {
  const originalRequest = error.config
  if (!originalRequest || originalRequest._retry) return Promise.reject(error)

  // do not attempt refresh for auth endpoints (avoid recursion)
  if (originalRequest && originalRequest.url && originalRequest.url.includes && (originalRequest.url.includes('/api/auth/refresh') || originalRequest.url.includes('/api/auth/login') || originalRequest.url.includes('/api/auth/register'))) {
    return Promise.reject(error)
  }

  if (error.response && error.response.status === 401) {
    const refreshToken = getRefreshToken()
    if (!refreshToken) {
      clearToken(); clearRefreshToken();
      return Promise.reject(error)
    }

    if (isRefreshing) {
      // queue the request until refresh completes
      return new Promise((resolve, reject) => {
        refreshQueue.push({ resolve, reject })
      }).then((token) => {
        originalRequest.headers = { ...(originalRequest.headers || {}), Authorization: `Bearer ${token}` }
        return axios(originalRequest)
      })
    }

    originalRequest._retry = true
    isRefreshing = true
    try {
      const res = await axios.post('/api/auth/refresh', { refreshToken })
      const newAccess = res.data && res.data.accessToken
      const newRefresh = res.data && res.data.refreshToken
      if (newAccess) setToken(newAccess)
      if (newRefresh) setRefreshToken(newRefresh)
      processQueue(null, newAccess)
      return axios({ ...originalRequest, headers: { ...(originalRequest.headers || {}), Authorization: `Bearer ${newAccess}` } })
    } catch (e) {
      processQueue(e, null)
      clearToken(); clearRefreshToken();
      return Promise.reject(e)
    } finally {
      isRefreshing = false
    }
  }
  return Promise.reject(error)
})

export default axios
