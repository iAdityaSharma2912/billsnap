import axios from 'axios'

// FastAPI backend always runs on localhost:8000 — no internet required.
export const api = axios.create({
  baseURL: 'http://localhost:8000',
  timeout: 15000,
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error?.response?.data?.detail || error?.message || 'Something went wrong'
    return Promise.reject(new Error(message))
  }
)
