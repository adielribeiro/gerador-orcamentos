const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/+$/, "");

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Erro na requisição.");
  }

  return data;
}

export const api = {
  register(email, password) {
    return request("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
  },

  login(email, password) {
    return request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
  },

  me(token) {
    return request("/auth/me", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  },

  getQuotes(token) {
    return request("/quotes", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  },

  createQuote(token, quote) {
    return request("/quotes", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(quote)
    });
  },

  deleteQuote(token, id) {
    return request(`/quotes/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  }
};