const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/+$/, "");

async function request(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Erro na requisição.");
  }

  return data;
}

export const api = {
  login(email, password) {
    return request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
  },

  me(token) {
    return request("/auth/me", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  },

  getQuotes(token) {
    return request("/quotes", {
      method: "GET",
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
  },

  adminListUsers(token) {
    return request("/admin/users", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  },

  adminCreateUser(token, payload) {
    return request("/admin/users", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
  },

  adminChangePassword(token, userId, password) {
    return request(`/admin/users/${userId}/password`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ password })
    });
  },

  adminChangeStatus(token, userId, isActive) {
    return request(`/admin/users/${userId}/status`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ isActive })
    });
  }
};