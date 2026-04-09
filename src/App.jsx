import { useEffect, useState } from "react";
import { Box, CircularProgress } from "@mui/material";
import { Navigate, Route, Routes } from "react-router-dom";
import { api } from "./services/api";
import LoginPage from "./LoginPage";
import OrcamentosPage from "./OrcamentosPage";
import AdminPage from "./AdminPage";

const TOKEN_KEY = "orcamentos_token";

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || "");
  const [user, setUser] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function validarToken() {
      if (!token) {
        setUser(null);
        setCarregando(false);
        return;
      }

      try {
        const data = await api.me(token);
        setUser(data.user);
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        setToken("");
        setUser(null);
      } finally {
        setCarregando(false);
      }
    }

    validarToken();
  }, [token]);

  async function handleLogin({ email, password }) {
    const data = await api.login(email, password);
    localStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
    setUser(data.user);
  }

  function handleLogout() {
    localStorage.removeItem(TOKEN_KEY);
    setToken("");
    setUser(null);
  }

  if (carregando) {
    return (
      <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    return <LoginPage onSubmit={handleLogin} />;
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          <OrcamentosPage
            token={token}
            user={user}
            onLogout={handleLogout}
          />
        }
      />

      <Route
        path="/admin"
        element={
          user.role === "admin" ? (
            <AdminPage token={token} user={user} onLogout={handleLogout} />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}