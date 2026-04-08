import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  TextField,
  Typography
} from "@mui/material";

export default function LoginPage({ onSubmit }) {
  const [modo, setModo] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setErro("");
    setCarregando(true);

    try {
      await onSubmit({ email, password, modo });
    } catch (error) {
      setErro(error.message || "Não foi possível continuar.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        p: 2,
        background: "#f5f7fb"
      }}
    >
      <Card sx={{ width: "100%", maxWidth: 420, borderRadius: 4 }}>
        <CardContent>
          <Stack spacing={2}>
            <Box>
              <Typography variant="h5" fontWeight={700}>
                {modo === "login" ? "Entrar" : "Criar conta"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Acesse seus orçamentos com e-mail e senha.
              </Typography>
            </Box>

            {erro ? <Alert severity="error">{erro}</Alert> : null}

            <form onSubmit={handleSubmit}>
              <Stack spacing={2}>
                <TextField
                  label="E-mail"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />

                <TextField
                  label="Senha"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />

                <Button type="submit" variant="contained" disabled={carregando}>
                  {carregando
                    ? "Aguarde..."
                    : modo === "login"
                    ? "Entrar"
                    : "Criar conta"}
                </Button>
              </Stack>
            </form>

            <Button
              variant="text"
              onClick={() =>
                setModo((atual) => (atual === "login" ? "register" : "login"))
              }
            >
              {modo === "login"
                ? "Ainda não tenho conta"
                : "Já tenho conta"}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}