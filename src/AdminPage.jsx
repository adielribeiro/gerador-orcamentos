import { useEffect, useState } from "react";
import {
  Alert,
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Toolbar,
  Typography
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { api } from "./services/api";

export default function AdminPage({ token, user, onLogout }) {
  const [usuarios, setUsuarios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  const [novoUsuario, setNovoUsuario] = useState({
    email: "",
    password: "",
    role: "user"
  });

  const [novasSenhas, setNovasSenhas] = useState({});

  async function carregarUsuarios() {
    try {
      setCarregando(true);
      setErro("");
      const data = await api.adminListUsers(token);
      setUsuarios(Array.isArray(data) ? data : []);
    } catch (error) {
      setErro(error.message || "Não foi possível carregar os usuários.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarUsuarios();
  }, []);

  function mostrarMensagem(texto) {
    setMensagem(texto);
    setTimeout(() => setMensagem(""), 3000);
  }

  async function criarUsuario(e) {
    e.preventDefault();

    try {
      await api.adminCreateUser(token, novoUsuario);
      setNovoUsuario({
        email: "",
        password: "",
        role: "user"
      });
      mostrarMensagem("Usuário criado com sucesso.");
      await carregarUsuarios();
    } catch (error) {
      setErro(error.message || "Não foi possível criar o usuário.");
    }
  }

  async function alterarSenha(userId) {
    const password = novasSenhas[userId] || "";

    try {
      await api.adminChangePassword(token, userId, password);
      setNovasSenhas((anterior) => ({
        ...anterior,
        [userId]: ""
      }));
      mostrarMensagem("Senha alterada com sucesso.");
    } catch (error) {
      setErro(error.message || "Não foi possível alterar a senha.");
    }
  }

  async function alternarStatus(item) {
    try {
      await api.adminChangeStatus(token, item.id, !item.isActive);
      mostrarMensagem("Status atualizado com sucesso.");
      await carregarUsuarios();
    } catch (error) {
      setErro(error.message || "Não foi possível atualizar o status.");
    }
  }

  return (
    <Box sx={{ minHeight: "100vh", background: "#f5f7fb" }}>
      <AppBar position="fixed" color="inherit" elevation={0}>
        <Toolbar sx={{ borderBottom: "1px solid #e5e7eb", gap: 1 }}>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Administração de usuários
          </Typography>

          <Button component={RouterLink} to="/" variant="outlined">
            Voltar
          </Button>

          <Button variant="outlined" onClick={onLogout}>
            Sair
          </Button>
        </Toolbar>
      </AppBar>

      <Box sx={{ pt: 10, px: 2, pb: 4, maxWidth: 1200, mx: "auto" }}>
        <Stack spacing={2}>
          <Card>
            <CardContent>
              <Stack spacing={1}>
                <Typography variant="h5" fontWeight={700}>
                  Área administrativa
                </Typography>
                <Typography color="text.secondary">
                  Usuário logado: {user?.email}
                </Typography>
              </Stack>
            </CardContent>
          </Card>

          {mensagem ? <Alert severity="success">{mensagem}</Alert> : null}
          {erro ? <Alert severity="error">{erro}</Alert> : null}

          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h6">Cadastrar novo usuário</Typography>

                <form onSubmit={criarUsuario}>
                  <Stack spacing={2}>
                    <TextField
                      label="E-mail"
                      value={novoUsuario.email}
                      onChange={(e) =>
                        setNovoUsuario((anterior) => ({
                          ...anterior,
                          email: e.target.value
                        }))
                      }
                      required
                    />

                    <TextField
                      label="Senha inicial"
                      type="password"
                      value={novoUsuario.password}
                      onChange={(e) =>
                        setNovoUsuario((anterior) => ({
                          ...anterior,
                          password: e.target.value
                        }))
                      }
                      required
                    />

                    <FormControl fullWidth size="small">
                      <InputLabel>Perfil</InputLabel>
                      <Select
                        label="Perfil"
                        value={novoUsuario.role}
                        onChange={(e) =>
                          setNovoUsuario((anterior) => ({
                            ...anterior,
                            role: e.target.value
                          }))
                        }
                      >
                        <MenuItem value="user">Usuário</MenuItem>
                        <MenuItem value="admin">Administrador</MenuItem>
                      </Select>
                    </FormControl>

                    <Button type="submit" variant="contained">
                      Cadastrar usuário
                    </Button>
                  </Stack>
                </form>
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h6">Usuários cadastrados</Typography>

                {carregando ? (
                  <Typography color="text.secondary">Carregando usuários...</Typography>
                ) : usuarios.length === 0 ? (
                  <Typography color="text.secondary">
                    Nenhum usuário encontrado.
                  </Typography>
                ) : (
                  usuarios.map((item) => (
                    <Paper key={item.id} variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                      <Stack spacing={2}>
                        <Stack
                          direction={{ xs: "column", md: "row" }}
                          spacing={1}
                          justifyContent="space-between"
                          alignItems={{ xs: "flex-start", md: "center" }}
                        >
                          <Box>
                            <Typography variant="h6">{item.email}</Typography>
                            <Typography variant="body2" color="text.secondary">
                              Perfil: {item.role === "admin" ? "Administrador" : "Usuário"}
                            </Typography>
                          </Box>

                          <Stack direction="row" spacing={1}>
                            <Chip
                              label={item.role === "admin" ? "Administrador" : "Usuário"}
                              color={item.role === "admin" ? "primary" : "default"}
                            />
                            <Chip
                              label={item.isActive ? "Ativo" : "Inativo"}
                              color={item.isActive ? "success" : "default"}
                            />
                          </Stack>
                        </Stack>

                        <Stack
                          direction={{ xs: "column", md: "row" }}
                          spacing={1.5}
                          alignItems={{ xs: "stretch", md: "center" }}
                        >
                          <TextField
                            label="Nova senha"
                            type="password"
                            value={novasSenhas[item.id] || ""}
                            onChange={(e) =>
                              setNovasSenhas((anterior) => ({
                                ...anterior,
                                [item.id]: e.target.value
                              }))
                            }
                          />

                          <Button
                            variant="outlined"
                            onClick={() => alterarSenha(item.id)}
                          >
                            Alterar senha
                          </Button>

                          <Button
                            variant="outlined"
                            color={item.isActive ? "warning" : "success"}
                            onClick={() => alternarStatus(item)}
                          >
                            {item.isActive ? "Desativar" : "Ativar"}
                          </Button>
                        </Stack>
                      </Stack>
                    </Paper>
                  ))
                )}
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Box>
    </Box>
  );
}