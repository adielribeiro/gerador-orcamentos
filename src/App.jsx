import { useEffect, useState } from "react";
import { Box, CircularProgress } from "@mui/material";
import { api } from "./services/api";
import LoginPage from "./LoginPage";
import OrcamentosPage from "./OrcamentosPage";

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

  async function handleAuth({ email, password, modo }) {
    if (modo === "register") {
      await api.register(email, password);
    }

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
    return <LoginPage onSubmit={handleAuth} />;
  }

  return <OrcamentosPage token={token} user={user} onLogout={handleLogout} />;
}

