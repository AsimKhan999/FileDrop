import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.response.use(
  (response) => {
    // Unwrap the { success, data } envelope
    if (response.data && response.data.success !== undefined) {
      response.data = response.data.data;
    }
    return response;
  },
  (error) => {
    const message =
      error.response?.data?.error?.message || "An unexpected error occurred";
    return Promise.reject(new Error(message));
  }
);

export default api;
