# Guia completo para adicionar login + MySQL no projeto de orçamentos

Este guia entrega os **arquivos completos** para você criar ou substituir.

## O que esta versão faz

- login com **e-mail e senha**
- cadastro de usuário
- autenticação com token
- salvar orçamento no **MySQL**
- carregar histórico do banco
- excluir orçamento do banco
- manter geração de PDF e compartilhamento
- botão **Sair**

---

# 1) Banco de dados MySQL

Crie o banco e as tabelas com este script:

```sql
CREATE DATABASE IF NOT EXISTS orcamentos_app
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE orcamentos_app;

CREATE TABLE users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(150) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
);

CREATE TABLE quotes (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  client_name VARCHAR(150) NOT NULL,
  total_final DECIMAL(12,2) NOT NULL,
  data_json JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_quotes_user_created (user_id, created_at),
  CONSTRAINT fk_quotes_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
);
```

---

# 2) Backend da API

Crie uma pasta separada, por exemplo:

```text
orcamentos-api
```

## Instalação

```bash
npm init -y
npm install express cors dotenv mysql2 bcrypt jsonwebtoken
```

## Estrutura

```text
orcamentos-api
├─ package.json
├─ .env
└─ src
   ├─ db.js
   ├─ server.js
   ├─ middleware
   │  └─ auth.js
   └─ routes
      ├─ auth.routes.js
      └─ quotes.routes.js
```

---

## Arquivo: `package.json`

```json
{
  "name": "orcamentos-api",
  "version": "1.0.0",
  "type": "module",
  "main": "src/server.js",
  "scripts": {
    "dev": "node src/server.js",
    "start": "node src/server.js"
  },
  "dependencies": {
    "bcrypt": "^6.0.0",
    "cors": "^2.8.5",
    "dotenv": "^17.2.1",
    "express": "^5.1.0",
    "jsonwebtoken": "^9.0.2",
    "mysql2": "^3.14.3"
  }
}
```

---

## Arquivo: `.env`

```env
PORT=4000
FRONTEND_URL=http://localhost:5173

DB_HOST=localhost
DB_PORT=3306
DB_USER=seu_usuario
DB_PASSWORD=sua_senha
DB_NAME=orcamentos_app

JWT_SECRET=troque_essa_chave_por_uma_bem_forte
JWT_EXPIRES_IN=7d
```

---

## Arquivo: `src/db.js`

```js
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});
```

---

## Arquivo: `src/middleware/auth.js`

```js
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

export function authRequired(req, res, next) {
  const authHeader = req.headers.authorization || "";

  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Não autenticado." });
  }

  const token = authHeader.replace("Bearer ", "").trim();

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    req.user = {
      id: payload.sub,
      email: payload.email
    };

    next();
  } catch {
    return res.status(401).json({ message: "Token inválido ou expirado." });
  }
}
```

---

## Arquivo: `src/routes/auth.routes.js`

```js
import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { pool } from "../db.js";
import { authRequired } from "../middleware/auth.js";

dotenv.config();

const router = Router();

function isEmailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

router.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "E-mail e senha são obrigatórios." });
    }

    if (!isEmailValido(email)) {
      return res.status(400).json({ message: "E-mail inválido." });
    }

    if (String(password).length < 6) {
      return res.status(400).json({ message: "A senha deve ter pelo menos 6 caracteres." });
    }

    const [existing] = await pool.execute(
      "SELECT id FROM users WHERE email = ? LIMIT 1",
      [email]
    );

    if (existing.length > 0) {
      return res.status(409).json({ message: "Este e-mail já está cadastrado." });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await pool.execute(
      "INSERT INTO users (email, password_hash) VALUES (?, ?)",
      [email, passwordHash]
    );

    return res.status(201).json({ message: "Usuário criado com sucesso." });
  } catch {
    return res.status(500).json({ message: "Erro ao criar usuário." });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "E-mail e senha são obrigatórios." });
    }

    const [rows] = await pool.execute(
      "SELECT id, email, password_hash FROM users WHERE email = ? LIMIT 1",
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: "E-mail ou senha inválidos." });
    }

    const user = rows[0];
    const passwordOk = await bcrypt.compare(password, user.password_hash);

    if (!passwordOk) {
      return res.status(401).json({ message: "E-mail ou senha inválidos." });
    }

    const token = jwt.sign(
      {
        sub: user.id,
        email: user.email
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || "7d"
      }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email
      }
    });
  } catch {
    return res.status(500).json({ message: "Erro ao fazer login." });
  }
});

router.get("/me", authRequired, async (req, res) => {
  return res.json({
    user: {
      id: req.user.id,
      email: req.user.email
    }
  });
});

export default router;
```

---

## Arquivo: `src/routes/quotes.routes.js`

```js
import { Router } from "express";
import { pool } from "../db.js";
import { authRequired } from "../middleware/auth.js";

const router = Router();

router.get("/", authRequired, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `
      SELECT id, client_name, total_final, data_json, created_at
      FROM quotes
      WHERE user_id = ?
      ORDER BY created_at DESC
      `,
      [req.user.id]
    );

    const quotes = rows.map((row) => {
      const data = typeof row.data_json === "string"
        ? JSON.parse(row.data_json)
        : row.data_json;

      return {
        ...data,
        id: row.id,
        cliente: data.cliente || row.client_name,
        dataCriacao: row.created_at
      };
    });

    return res.json(quotes);
  } catch {
    return res.status(500).json({ message: "Erro ao carregar orçamentos." });
  }
});

router.post("/", authRequired, async (req, res) => {
  try {
    const quote = req.body;

    const clientName = quote?.cliente?.trim() || "Sem nome";
    const totalFinal = Number(quote?.totais?.totalFinal || 0);

    await pool.execute(
      `
      INSERT INTO quotes (user_id, client_name, total_final, data_json)
      VALUES (?, ?, ?, ?)
      `,
      [
        req.user.id,
        clientName,
        totalFinal,
        JSON.stringify(quote)
      ]
    );

    const [rows] = await pool.execute(
      `
      SELECT id, client_name, total_final, data_json, created_at
      FROM quotes
      WHERE user_id = ?
      ORDER BY id DESC
      LIMIT 1
      `,
      [req.user.id]
    );

    const row = rows[0];
    const data = typeof row.data_json === "string"
      ? JSON.parse(row.data_json)
      : row.data_json;

    return res.status(201).json({
      ...data,
      id: row.id,
      cliente: data.cliente || row.client_name,
      dataCriacao: row.created_at
    });
  } catch {
    return res.status(500).json({ message: "Erro ao salvar orçamento." });
  }
});

router.delete("/:id", authRequired, async (req, res) => {
  try {
    const id = Number(req.params.id);

    await pool.execute(
      "DELETE FROM quotes WHERE id = ? AND user_id = ?",
      [id, req.user.id]
    );

    return res.json({ message: "Orçamento removido com sucesso." });
  } catch {
    return res.status(500).json({ message: "Erro ao excluir orçamento." });
  }
});

export default router;
```

---

## Arquivo: `src/server.js`

```js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.routes.js";
import quotesRoutes from "./routes/quotes.routes.js";

dotenv.config();

const app = express();

const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:5173")
  .split(",")
  .map((item) => item.trim());

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true
  })
);

app.use(express.json({ limit: "2mb" }));

app.get("/health", (_, res) => {
  res.json({ ok: true });
});

app.use("/auth", authRoutes);
app.use("/quotes", quotesRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "Erro interno do servidor." });
});

const port = Number(process.env.PORT || 4000);

app.listen(port, () => {
  console.log(`API rodando na porta ${port}`);
});
```

---

## Rodar a API

```bash
node src/server.js
```

---

# 3) Front-end React

No seu projeto atual, instale:

```bash
npm install jspdf
```

Crie esta estrutura:

```text
src
├─ App.jsx
├─ LoginPage.jsx
├─ OrcamentosPage.jsx
└─ services
   └─ api.js
```

---

## Arquivo: `.env`

```env
VITE_API_URL=http://localhost:4000
```

---

## Arquivo: `src/services/api.js`

```js
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

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
```

---

## Arquivo: `src/LoginPage.jsx`

```jsx
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
```

---

## Arquivo: `src/App.jsx`

```jsx
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
```

---

## Arquivo: `src/OrcamentosPage.jsx`

```jsx
import { useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import {
  AppBar,
  Alert,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Toolbar,
  Typography,
  useMediaQuery
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import CalculateIcon from "@mui/icons-material/Calculate";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EmailIcon from "@mui/icons-material/Email";
import HistoryIcon from "@mui/icons-material/History";
import HomeRepairServiceIcon from "@mui/icons-material/HomeRepairService";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import SaveIcon from "@mui/icons-material/Save";
import SendIcon from "@mui/icons-material/Send";
import SettingsIcon from "@mui/icons-material/Settings";
import ShareIcon from "@mui/icons-material/Share";
import { api } from "./services/api";

const STORAGE_PARAMS_KEY = "orcamentos_parametros";

const DEFAULT_PARAMS = {
  nomeEmpresa: "Minha Empresa",
  percentualMaoDeObra: 20,
  percentualPecas: 15,
  validadeOrcamentoDias: 7,
  observacoesPadrao: "Orçamento sujeito à aprovação e disponibilidade de estoque."
};

function novoItem() {
  return {
    descricao: "",
    quantidade: 1,
    valorUnitario: ""
  };
}

function criarOrcamentoInicial(parametros = DEFAULT_PARAMS) {
  return {
    cliente: "",
    descricaoServico: "",
    valorMaoDeObra: "",
    pecas: [novoItem()],
    insumos: [novoItem()],
    observacoes: parametros.observacoesPadrao || ""
  };
}

function paraNumero(valor) {
  if (valor === "" || valor === null || valor === undefined) return 0;
  const normalizado = String(valor).replace(",", ".");
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : 0;
}

function moeda(valor) {
  return (valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function totalItens(lista) {
  return lista.reduce((acc, item) => {
    const quantidade = paraNumero(item.quantidade);
    const valorUnitario = paraNumero(item.valorUnitario);
    return acc + quantidade * valorUnitario;
  }, 0);
}

function arredondar(valor) {
  return Number((valor || 0).toFixed(2));
}

function calcularTotais(form, parametros) {
  const maoDeObraBase = paraNumero(form.valorMaoDeObra);
  const subtotalPecas = totalItens(form.pecas);
  const subtotalInsumos = totalItens(form.insumos);

  const percentualMao = paraNumero(parametros.percentualMaoDeObra);
  const percentualPecas = paraNumero(parametros.percentualPecas);

  const maoDeObraFinal = maoDeObraBase * (1 + percentualMao / 100);
  const pecasFinal = subtotalPecas * (1 + percentualPecas / 100);
  const totalFinal = maoDeObraFinal + pecasFinal + subtotalInsumos;

  return {
    maoDeObraBase: arredondar(maoDeObraBase),
    subtotalPecas: arredondar(subtotalPecas),
    subtotalInsumos: arredondar(subtotalInsumos),
    maoDeObraFinal: arredondar(maoDeObraFinal),
    pecasFinal: arredondar(pecasFinal),
    totalFinal: arredondar(totalFinal)
  };
}

function carregarLocalStorage(chave, fallback) {
  try {
    const valor = localStorage.getItem(chave);
    return valor ? JSON.parse(valor) : fallback;
  } catch {
    return fallback;
  }
}

function formatarData(dataIso) {
  if (!dataIso) return new Date().toLocaleString("pt-BR");
  return new Date(dataIso).toLocaleString("pt-BR");
}

function limparNomeArquivo(texto) {
  return String(texto || "orcamento")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function baixarBlob(blob, nomeArquivo) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function normalizarParaCompartilhamento(registro, parametrosAtuais, totaisAtuais) {
  const ehHistorico = !!registro?.itens;

  if (ehHistorico) {
    return {
      empresa: registro.empresa || parametrosAtuais.nomeEmpresa || "Minha Empresa",
      cliente: registro.cliente || "Sem nome",
      descricaoServico: registro.descricaoServico || "",
      observacoes: registro.observacoes || "",
      dataCriacao: registro.dataCriacao || new Date().toISOString(),
      pecas: registro.itens?.pecas || [],
      insumos: registro.itens?.insumos || [],
      parametrosAplicados: {
        percentualMaoDeObra: paraNumero(
          registro.parametrosAplicados?.percentualMaoDeObra
        ),
        percentualPecas: paraNumero(registro.parametrosAplicados?.percentualPecas),
        validadeOrcamentoDias: paraNumero(
          registro.parametrosAplicados?.validadeOrcamentoDias
        )
      },
      totais: registro.totais
    };
  }

  return {
    empresa: parametrosAtuais.nomeEmpresa || "Minha Empresa",
    cliente: registro.cliente || "Sem nome",
    descricaoServico: registro.descricaoServico || "",
    observacoes: registro.observacoes || "",
    dataCriacao: new Date().toISOString(),
    pecas: registro.pecas || [],
    insumos: registro.insumos || [],
    parametrosAplicados: {
      percentualMaoDeObra: paraNumero(parametrosAtuais.percentualMaoDeObra),
      percentualPecas: paraNumero(parametrosAtuais.percentualPecas),
      validadeOrcamentoDias: paraNumero(parametrosAtuais.validadeOrcamentoDias)
    },
    totais: totaisAtuais
  };
}

function montarTextoCompartilhamento(dados) {
  return [
    `Olá! Segue o orçamento de ${dados.empresa}.`,
    `Cliente: ${dados.cliente}`,
    `Total: ${moeda(dados.totais.totalFinal)}`,
    `Data: ${formatarData(dados.dataCriacao)}`
  ].join("\n");
}

async function gerarPdfBlob(dados) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  const larguraPagina = doc.internal.pageSize.getWidth();
  const alturaPagina = doc.internal.pageSize.getHeight();
  const margem = 14;
  const larguraUtil = larguraPagina - margem * 2;
  let y = 18;

  const garantirEspaco = (alturaNecessaria = 8) => {
    if (y + alturaNecessaria > alturaPagina - 16) {
      doc.addPage();
      y = 18;
    }
  };

  const adicionarTexto = (
    texto,
    {
      x = margem,
      fontSize = 11,
      estilo = "normal",
      espacamento = 6,
      cor = [0, 0, 0]
    } = {}
  ) => {
    if (!texto && texto !== 0) return;
    doc.setFont("helvetica", estilo);
    doc.setFontSize(fontSize);
    doc.setTextColor(cor[0], cor[1], cor[2]);

    const linhas = doc.splitTextToSize(String(texto), larguraUtil - (x - margem));
    linhas.forEach((linha) => {
      garantirEspaco(espacamento);
      doc.text(linha, x, y);
      y += espacamento;
    });
  };

  const adicionarTituloSecao = (titulo) => {
    garantirEspaco(10);
    y += 2;
    doc.setDrawColor(220, 220, 220);
    doc.line(margem, y, larguraPagina - margem, y);
    y += 6;
    adicionarTexto(titulo, { fontSize: 12, estilo: "bold", espacamento: 6 });
  };

  const adicionarLinhaValor = (rotulo, valor) => {
    garantirEspaco(6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(String(rotulo), margem, y);
    doc.setFont("helvetica", "bold");
    doc.text(String(valor), larguraPagina - margem, y, { align: "right" });
    y += 6;
  };

  const adicionarListaItens = (titulo, itens) => {
    adicionarTituloSecao(titulo);

    if (!itens || itens.length === 0) {
      adicionarTexto("Nenhum item informado.", { fontSize: 10, cor: [90, 90, 90] });
      return;
    }

    itens.forEach((item, index) => {
      const quantidade = paraNumero(item.quantidade);
      const valorUnitario = paraNumero(item.valorUnitario);
      const total = quantidade * valorUnitario;

      adicionarTexto(
        `${index + 1}. ${item.descricao || "Item sem descrição"}`,
        { fontSize: 11, estilo: "bold", espacamento: 5 }
      );
      adicionarTexto(
        `Quantidade: ${quantidade} • Valor unitário: ${moeda(valorUnitario)} • Total: ${moeda(total)}`,
        { fontSize: 10, cor: [70, 70, 70], espacamento: 5 }
      );
      y += 1;
    });
  };

  adicionarTexto(dados.empresa || "Orçamento", {
    fontSize: 18,
    estilo: "bold",
    espacamento: 8
  });

  adicionarTexto(`Data: ${formatarData(dados.dataCriacao)}`, {
    fontSize: 10,
    cor: [90, 90, 90],
    espacamento: 5
  });

  adicionarTituloSecao("Dados do orçamento");
  adicionarLinhaValor("Cliente", dados.cliente || "Sem nome");

  if (dados.descricaoServico) {
    adicionarTexto(`Serviço: ${dados.descricaoServico}`, { fontSize: 10 });
  }

  adicionarLinhaValor(
    "Validade",
    `${paraNumero(dados.parametrosAplicados.validadeOrcamentoDias)} dias`
  );

  adicionarListaItens("Peças", dados.pecas);
  adicionarListaItens("Insumos", dados.insumos);

  adicionarTituloSecao("Resumo financeiro");
  adicionarLinhaValor("Mão de obra base", moeda(dados.totais.maoDeObraBase));
  adicionarLinhaValor(
    `Mão de obra com ${paraNumero(dados.parametrosAplicados.percentualMaoDeObra)}%`,
    moeda(dados.totais.maoDeObraFinal)
  );
  adicionarLinhaValor("Subtotal de peças", moeda(dados.totais.subtotalPecas));
  adicionarLinhaValor(
    `Peças com ${paraNumero(dados.parametrosAplicados.percentualPecas)}%`,
    moeda(dados.totais.pecasFinal)
  );
  adicionarLinhaValor("Insumos", moeda(dados.totais.subtotalInsumos));

  garantirEspaco(10);
  doc.setDrawColor(180, 180, 180);
  doc.line(margem, y, larguraPagina - margem, y);
  y += 7;
  adicionarLinhaValor("Total final", moeda(dados.totais.totalFinal));

  if (dados.observacoes) {
    adicionarTituloSecao("Observações");
    adicionarTexto(dados.observacoes, { fontSize: 10, cor: [60, 60, 60] });
  }

  return doc.output("blob");
}

function TituloSecao({ titulo, subtitulo }) {
  return (
    <Box>
      <Typography variant="h6">{titulo}</Typography>
      {subtitulo ? (
        <Typography variant="body2" color="text.secondary">
          {subtitulo}
        </Typography>
      ) : null}
    </Box>
  );
}

function EditorLista({ titulo, descricao, itens, onChange }) {
  const atualizarItem = (index, campo, valor) => {
    const proximaLista = itens.map((item, idx) =>
      idx === index ? { ...item, [campo]: valor } : item
    );
    onChange(proximaLista);
  };

  const adicionarItem = () => {
    onChange([...itens, novoItem()]);
  };

  const removerItem = (index) => {
    if (itens.length === 1) {
      onChange([novoItem()]);
      return;
    }
    onChange(itens.filter((_, idx) => idx !== index));
  };

  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <TituloSecao titulo={titulo} subtitulo={descricao} />

          {itens.map((item, index) => {
            const quantidade = paraNumero(item.quantidade);
            const valorUnitario = paraNumero(item.valorUnitario);
            const total = quantidade * valorUnitario;

            return (
              <Paper
                key={`${titulo}-${index}`}
                variant="outlined"
                sx={{ p: 2, borderRadius: 3 }}
              >
                <Stack spacing={1.5}>
                  <TextField
                    label="Descrição"
                    value={item.descricao}
                    onChange={(e) =>
                      atualizarItem(index, "descricao", e.target.value)
                    }
                  />

                  <Box
                    sx={{
                      display: "grid",
                      gap: 1.5,
                      gridTemplateColumns: {
                        xs: "1fr 1fr",
                        sm: "1fr 1fr auto"
                      }
                    }}
                  >
                    <TextField
                      label="Quantidade"
                      type="number"
                      value={item.quantidade}
                      onChange={(e) =>
                        atualizarItem(index, "quantidade", e.target.value)
                      }
                      inputProps={{ min: 0, step: "any" }}
                    />

                    <TextField
                      label="Valor unitário"
                      type="number"
                      value={item.valorUnitario}
                      onChange={(e) =>
                        atualizarItem(index, "valorUnitario", e.target.value)
                      }
                      inputProps={{ min: 0, step: "0.01" }}
                    />

                    <Button
                      color="error"
                      variant="outlined"
                      startIcon={<DeleteOutlineIcon />}
                      onClick={() => removerItem(index)}
                      sx={{
                        minWidth: { xs: "100%", sm: 140 }
                      }}
                    >
                      Remover
                    </Button>
                  </Box>

                  <Typography variant="body2" color="text.secondary">
                    Total do item: <strong>{moeda(total)}</strong>
                  </Typography>
                </Stack>
              </Paper>
            );
          })}

          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={adicionarItem}
          >
            Adicionar item
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}

function ResumoValores({ totais, parametros }) {
  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <TituloSecao
            titulo="Resumo do orçamento"
            subtitulo="Cálculo automático com base nas configurações definidas."
          />

          <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
            <Stack spacing={1}>
              <LinhaResumo
                label="Mão de obra base"
                valor={moeda(totais.maoDeObraBase)}
              />
              <LinhaResumo
                label={`Mão de obra com ${paraNumero(
                  parametros.percentualMaoDeObra
                )}%`}
                valor={moeda(totais.maoDeObraFinal)}
              />
              <Divider />
              <LinhaResumo
                label="Subtotal de peças"
                valor={moeda(totais.subtotalPecas)}
              />
              <LinhaResumo
                label={`Peças com ${paraNumero(
                  parametros.percentualPecas
                )}%`}
                valor={moeda(totais.pecasFinal)}
              />
              <Divider />
              <LinhaResumo
                label="Subtotal de insumos"
                valor={moeda(totais.subtotalInsumos)}
              />
              <Divider />
              <LinhaResumo
                label="Total final"
                valor={moeda(totais.totalFinal)}
                destaque
              />
            </Stack>
          </Paper>
        </Stack>
      </CardContent>
    </Card>
  );
}

function LinhaResumo({ label, valor, destaque = false }) {
  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 2
      }}
    >
      <Typography
        variant={destaque ? "subtitle1" : "body2"}
        fontWeight={destaque ? 700 : 500}
      >
        {label}
      </Typography>
      <Typography
        variant={destaque ? "subtitle1" : "body2"}
        fontWeight={destaque ? 700 : 600}
      >
        {valor}
      </Typography>
    </Box>
  );
}

function AcoesCompartilhamento({
  onBaixarPdf,
  onCompartilhar,
  onWhatsApp,
  onEmail,
  titulo = "Compartilhar orçamento"
}) {
  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <TituloSecao
            titulo={titulo}
            subtitulo="Gere o PDF e envie pelo canal desejado."
          />

          <Stack spacing={1.25}>
            <Button
              variant="contained"
              startIcon={<PictureAsPdfIcon />}
              onClick={onBaixarPdf}
            >
              Gerar PDF
            </Button>

            <Button
              variant="outlined"
              startIcon={<ShareIcon />}
              onClick={onCompartilhar}
            >
              Compartilhar arquivo
            </Button>

            <Button
              variant="outlined"
              startIcon={<SendIcon />}
              onClick={onWhatsApp}
            >
              Enviar para WhatsApp
            </Button>

            <Button
              variant="outlined"
              startIcon={<EmailIcon />}
              onClick={onEmail}
            >
              Enviar por e-mail
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function OrcamentosPage({ token, user, onLogout }) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));

  const [aba, setAba] = useState(0);
  const [parametros, setParametros] = useState(() =>
    carregarLocalStorage(STORAGE_PARAMS_KEY, DEFAULT_PARAMS)
  );
  const [orcamento, setOrcamento] = useState(() =>
    criarOrcamentoInicial(
      carregarLocalStorage(STORAGE_PARAMS_KEY, DEFAULT_PARAMS)
    )
  );
  const [historico, setHistorico] = useState([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(true);
  const [mensagem, setMensagem] = useState("");

  useEffect(() => {
    localStorage.setItem(STORAGE_PARAMS_KEY, JSON.stringify(parametros));
  }, [parametros]);

  useEffect(() => {
    async function carregarHistorico() {
      try {
        setCarregandoHistorico(true);
        const dados = await api.getQuotes(token);
        setHistorico(dados);
      } catch {
        setHistorico([]);
      } finally {
        setCarregandoHistorico(false);
      }
    }

    carregarHistorico();
  }, [token]);

  const totais = useMemo(
    () => calcularTotais(orcamento, parametros),
    [orcamento, parametros]
  );

  const mostrarMensagem = (texto) => {
    setMensagem(texto);

    setTimeout(() => {
      setMensagem("");
    }, 3500);
  };

  const atualizarCampoOrcamento = (campo, valor) => {
    setOrcamento((anterior) => ({
      ...anterior,
      [campo]: valor
    }));
  };

  const limparFormulario = () => {
    setOrcamento(criarOrcamentoInicial(parametros));
  };

  const prepararCompartilhamento = async (registro) => {
    const dados = normalizarParaCompartilhamento(registro, parametros, totais);
    const blob = await gerarPdfBlob(dados);
    const nomeArquivo = `orcamento-${limparNomeArquivo(dados.cliente)}.pdf`;
    const arquivo = new File([blob], nomeArquivo, { type: "application/pdf" });

    return {
      dados,
      blob,
      arquivo,
      nomeArquivo
    };
  };

  const baixarPdf = async (registro = orcamento) => {
    try {
      const { blob, nomeArquivo } = await prepararCompartilhamento(registro);
      baixarBlob(blob, nomeArquivo);
      mostrarMensagem("PDF gerado com sucesso.");
    } catch {
      mostrarMensagem("Não foi possível gerar o PDF.");
    }
  };

  const compartilharPdf = async (registro = orcamento) => {
    try {
      const { dados, blob, arquivo, nomeArquivo } = await prepararCompartilhamento(
        registro
      );
      const texto = montarTextoCompartilhamento(dados);

      if (
        navigator.share &&
        navigator.canShare &&
        navigator.canShare({ files: [arquivo] })
      ) {
        await navigator.share({
          title: `Orçamento - ${dados.cliente}`,
          text: texto,
          files: [arquivo]
        });
        return;
      }

      baixarBlob(blob, nomeArquivo);
      mostrarMensagem("PDF gerado. Agora anexe o arquivo no aplicativo desejado.");
    } catch {
      mostrarMensagem("Não foi possível compartilhar o arquivo.");
    }
  };

  const enviarWhatsApp = async (registro = orcamento) => {
    try {
      const { dados, blob, nomeArquivo } = await prepararCompartilhamento(registro);
      baixarBlob(blob, nomeArquivo);

      const texto = `${montarTextoCompartilhamento(
        dados
      )}\n\nO PDF foi gerado para anexar nesta conversa.`;

      window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank");
      mostrarMensagem("PDF gerado. O WhatsApp foi aberto com a mensagem pronta.");
    } catch {
      mostrarMensagem("Não foi possível preparar o envio para o WhatsApp.");
    }
  };

  const enviarEmail = async (registro = orcamento) => {
    try {
      const { dados, blob, nomeArquivo } = await prepararCompartilhamento(registro);
      baixarBlob(blob, nomeArquivo);

      const assunto = `Orçamento - ${dados.cliente}`;
      const corpo =
        `${montarTextoCompartilhamento(dados)}\n\n` +
        `Anexe o arquivo PDF gerado: ${nomeArquivo}`;

      window.location.href = `mailto:?subject=${encodeURIComponent(
        assunto
      )}&body=${encodeURIComponent(corpo)}`;

      mostrarMensagem("PDF gerado. O e-mail foi aberto com a mensagem pronta.");
    } catch {
      mostrarMensagem("Não foi possível preparar o e-mail.");
    }
  };

  const salvarOrcamento = async () => {
    try {
      const registro = {
        dataCriacao: new Date().toISOString(),
        empresa: parametros.nomeEmpresa,
        cliente: orcamento.cliente || "Sem nome",
        descricaoServico: orcamento.descricaoServico || "",
        observacoes: orcamento.observacoes || "",
        parametrosAplicados: {
          percentualMaoDeObra: paraNumero(parametros.percentualMaoDeObra),
          percentualPecas: paraNumero(parametros.percentualPecas),
          validadeOrcamentoDias: paraNumero(parametros.validadeOrcamentoDias)
        },
        itens: {
          pecas: orcamento.pecas,
          insumos: orcamento.insumos
        },
        totais
      };

      const salvo = await api.createQuote(token, registro);

      setHistorico((anterior) => [salvo, ...anterior]);
      mostrarMensagem("Orçamento salvo com sucesso.");
      setOrcamento(criarOrcamentoInicial(parametros));
      setAba(1);
    } catch (error) {
      mostrarMensagem(error.message || "Não foi possível salvar o orçamento.");
    }
  };

  const excluirOrcamento = async (id) => {
    try {
      await api.deleteQuote(token, id);
      setHistorico((anterior) => anterior.filter((item) => item.id !== id));
      mostrarMensagem("Orçamento excluído com sucesso.");
    } catch (error) {
      mostrarMensagem(error.message || "Não foi possível excluir o orçamento.");
    }
  };

  const menu = [
    { label: "Orçamento", icon: <HomeRepairServiceIcon /> },
    { label: "Histórico", icon: <HistoryIcon /> },
    { label: "Configurações", icon: <SettingsIcon /> }
  ];

  const painelNavegacao = (
    <Box sx={{ width: isDesktop ? 260 : "100%" }}>
      <Toolbar>
        <Stack spacing={0.5}>
          <Typography variant="h6">Gerador de Orçamentos</Typography>
          <Typography variant="body2" color="text.secondary">
            {user?.email || "Acompanhe seus orçamentos"}
          </Typography>
        </Stack>
      </Toolbar>

      <Divider />

      <List sx={{ p: 1 }}>
        {menu.map((item, index) => (
          <ListItemButton
            key={item.label}
            selected={aba === index}
            onClick={() => setAba(index)}
            sx={{ borderRadius: 3, mb: 0.5 }}
          >
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} />
          </ListItemButton>
        ))}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", pb: isDesktop ? 0 : 10 }}>
      <AppBar position="fixed" color="inherit" elevation={0}>
        <Toolbar sx={{ borderBottom: "1px solid #e5e7eb", gap: 1 }}>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            {parametros.nomeEmpresa || "Gerador de Orçamentos"}
          </Typography>

          <Chip
            icon={<CalculateIcon />}
            label="Orçamentos"
            color="primary"
            variant="outlined"
          />

          <Button variant="outlined" onClick={onLogout}>
            Sair
          </Button>
        </Toolbar>
      </AppBar>

      {isDesktop ? (
        <Drawer
          variant="permanent"
          PaperProps={{
            sx: {
              width: 260,
              boxSizing: "border-box",
              borderRight: "1px solid #e5e7eb"
            }
          }}
        >
          {painelNavegacao}
        </Drawer>
      ) : null}

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: "100%",
          mt: 8,
          ml: isDesktop ? "260px" : 0
        }}
      >
        <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1400, mx: "auto" }}>
          {mensagem ? <Alert sx={{ mb: 2 }}>{mensagem}</Alert> : null}

          {aba === 0 && (
            <Box
              sx={{
                display: "grid",
                gap: 2,
                gridTemplateColumns: { xs: "1fr", lg: "1.5fr 0.9fr" }
              }}
            >
              <Stack spacing={2}>
                <Card>
                  <CardContent>
                    <Stack spacing={2}>
                      <TituloSecao
                        titulo="Novo orçamento"
                        subtitulo="Preencha os valores para calcular o total."
                      />

                      <TextField
                        label="Nome do cliente"
                        value={orcamento.cliente}
                        onChange={(e) =>
                          atualizarCampoOrcamento("cliente", e.target.value)
                        }
                      />

                      <TextField
                        label="Descrição do serviço"
                        multiline
                        minRows={3}
                        value={orcamento.descricaoServico}
                        onChange={(e) =>
                          atualizarCampoOrcamento(
                            "descricaoServico",
                            e.target.value
                          )
                        }
                      />

                      <TextField
                        label="Valor da mão de obra"
                        type="number"
                        value={orcamento.valorMaoDeObra}
                        onChange={(e) =>
                          atualizarCampoOrcamento(
                            "valorMaoDeObra",
                            e.target.value
                          )
                        }
                        inputProps={{ min: 0, step: "0.01" }}
                      />
                    </Stack>
                  </CardContent>
                </Card>

                <EditorLista
                  titulo="Peças"
                  descricao="Cadastre as peças que entram no orçamento."
                  itens={orcamento.pecas}
                  onChange={(lista) =>
                    atualizarCampoOrcamento("pecas", lista)
                  }
                />

                <EditorLista
                  titulo="Insumos"
                  descricao="Cadastre os insumos utilizados no serviço."
                  itens={orcamento.insumos}
                  onChange={(lista) =>
                    atualizarCampoOrcamento("insumos", lista)
                  }
                />

                <Card>
                  <CardContent>
                    <Stack spacing={2}>
                      <TituloSecao
                        titulo="Observações"
                        subtitulo="Informações finais do orçamento."
                      />

                      <TextField
                        label="Observações"
                        multiline
                        minRows={4}
                        value={orcamento.observacoes}
                        onChange={(e) =>
                          atualizarCampoOrcamento("observacoes", e.target.value)
                        }
                      />

                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={1.5}
                      >
                        <Button
                          variant="contained"
                          startIcon={<SaveIcon />}
                          onClick={salvarOrcamento}
                        >
                          Salvar orçamento
                        </Button>

                        <Button variant="outlined" onClick={limparFormulario}>
                          Limpar formulário
                        </Button>
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
              </Stack>

              <Stack spacing={2}>
                <ResumoValores totais={totais} parametros={parametros} />

                <AcoesCompartilhamento
                  onBaixarPdf={() => baixarPdf(orcamento)}
                  onCompartilhar={() => compartilharPdf(orcamento)}
                  onWhatsApp={() => enviarWhatsApp(orcamento)}
                  onEmail={() => enviarEmail(orcamento)}
                />

                <Card>
                  <CardContent>
                    <Stack spacing={1.5}>
                      <TituloSecao
                        titulo="Configurações atuais"
                        subtitulo="Esses valores estão sendo usados no cálculo."
                      />

                      <LinhaResumo
                        label="Percentual da mão de obra"
                        valor={`${paraNumero(
                          parametros.percentualMaoDeObra
                        )}%`}
                      />
                      <LinhaResumo
                        label="Percentual das peças"
                        valor={`${paraNumero(parametros.percentualPecas)}%`}
                      />
                      <LinhaResumo
                        label="Validade do orçamento"
                        valor={`${paraNumero(
                          parametros.validadeOrcamentoDias
                        )} dias`}
                      />
                    </Stack>
                  </CardContent>
                </Card>
              </Stack>
            </Box>
          )}

          {aba === 1 && (
            <Stack spacing={2}>
              <Card>
                <CardContent>
                  <TituloSecao
                    titulo="Histórico de orçamentos"
                    subtitulo="Consulte os orçamentos já cadastrados."
                  />
                </CardContent>
              </Card>

              {carregandoHistorico ? (
                <Card>
                  <CardContent>
                    <Typography color="text.secondary">
                      Carregando histórico...
                    </Typography>
                  </CardContent>
                </Card>
              ) : historico.length === 0 ? (
                <Card>
                  <CardContent>
                    <Typography color="text.secondary">
                      Ainda não existe nenhum orçamento salvo.
                    </Typography>
                  </CardContent>
                </Card>
              ) : (
                historico.map((item) => (
                  <Card key={item.id}>
                    <CardContent>
                      <Stack spacing={1.5}>
                        <Box
                          sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            gap: 2,
                            flexWrap: "wrap"
                          }}
                        >
                          <Box>
                            <Typography variant="h6">{item.cliente}</Typography>
                            <Typography variant="body2" color="text.secondary">
                              {formatarData(item.dataCriacao)}
                            </Typography>
                          </Box>

                          <Chip
                            color="secondary"
                            label={moeda(item.totais.totalFinal)}
                          />
                        </Box>

                        <Typography variant="body2">
                          <strong>Serviço:</strong>{" "}
                          {item.descricaoServico || "Não informado"}
                        </Typography>

                        <Box
                          sx={{
                            display: "grid",
                            gap: 1,
                            gridTemplateColumns: {
                              xs: "1fr",
                              sm: "1fr 1fr"
                            }
                          }}
                        >
                          <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 3 }}>
                            <Typography variant="body2" color="text.secondary">
                              Mão de obra final
                            </Typography>
                            <Typography fontWeight={700}>
                              {moeda(item.totais.maoDeObraFinal)}
                            </Typography>
                          </Paper>

                          <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 3 }}>
                            <Typography variant="body2" color="text.secondary">
                              Peças final
                            </Typography>
                            <Typography fontWeight={700}>
                              {moeda(item.totais.pecasFinal)}
                            </Typography>
                          </Paper>

                          <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 3 }}>
                            <Typography variant="body2" color="text.secondary">
                              Insumos
                            </Typography>
                            <Typography fontWeight={700}>
                              {moeda(item.totais.subtotalInsumos)}
                            </Typography>
                          </Paper>

                          <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 3 }}>
                            <Typography variant="body2" color="text.secondary">
                              Total
                            </Typography>
                            <Typography fontWeight={700}>
                              {moeda(item.totais.totalFinal)}
                            </Typography>
                          </Paper>
                        </Box>

                        <Stack
                          direction={{ xs: "column", md: "row" }}
                          spacing={1}
                          justifyContent="space-between"
                        >
                          <Stack
                            direction={{ xs: "column", sm: "row" }}
                            spacing={1}
                            flexWrap="wrap"
                          >
                            <Button
                              variant="outlined"
                              startIcon={<PictureAsPdfIcon />}
                              onClick={() => baixarPdf(item)}
                            >
                              PDF
                            </Button>

                            <Button
                              variant="outlined"
                              startIcon={<ShareIcon />}
                              onClick={() => compartilharPdf(item)}
                            >
                              Compartilhar
                            </Button>

                            <Button
                              variant="outlined"
                              startIcon={<SendIcon />}
                              onClick={() => enviarWhatsApp(item)}
                            >
                              WhatsApp
                            </Button>

                            <Button
                              variant="outlined"
                              startIcon={<EmailIcon />}
                              onClick={() => enviarEmail(item)}
                            >
                              E-mail
                            </Button>
                          </Stack>

                          <Button
                            color="error"
                            variant="outlined"
                            startIcon={<DeleteOutlineIcon />}
                            onClick={() => excluirOrcamento(item.id)}
                          >
                            Excluir
                          </Button>
                        </Stack>
                      </Stack>
                    </CardContent>
                  </Card>
                ))
              )}
            </Stack>
          )}

          {aba === 2 && (
            <Box
              sx={{
                display: "grid",
                gap: 2,
                gridTemplateColumns: { xs: "1fr", lg: "1.1fr 0.9fr" }
              }}
            >
              <Card>
                <CardContent>
                  <Stack spacing={2}>
                    <TituloSecao
                      titulo="Configurações"
                      subtitulo="Defina os valores usados nos cálculos."
                    />

                    <TextField
                      label="Nome da empresa"
                      value={parametros.nomeEmpresa}
                      onChange={(e) =>
                        setParametros((anterior) => ({
                          ...anterior,
                          nomeEmpresa: e.target.value
                        }))
                      }
                    />

                    <TextField
                      label="Percentual da mão de obra"
                      type="number"
                      value={parametros.percentualMaoDeObra}
                      onChange={(e) =>
                        setParametros((anterior) => ({
                          ...anterior,
                          percentualMaoDeObra: e.target.value
                        }))
                      }
                      inputProps={{ min: 0, step: "0.01" }}
                    />

                    <TextField
                      label="Percentual das peças"
                      type="number"
                      value={parametros.percentualPecas}
                      onChange={(e) =>
                        setParametros((anterior) => ({
                          ...anterior,
                          percentualPecas: e.target.value
                        }))
                      }
                      inputProps={{ min: 0, step: "0.01" }}
                    />

                    <TextField
                      label="Validade padrão do orçamento (dias)"
                      type="number"
                      value={parametros.validadeOrcamentoDias}
                      onChange={(e) =>
                        setParametros((anterior) => ({
                          ...anterior,
                          validadeOrcamentoDias: e.target.value
                        }))
                      }
                      inputProps={{ min: 1, step: 1 }}
                    />

                    <TextField
                      label="Observações padrão"
                      multiline
                      minRows={4}
                      value={parametros.observacoesPadrao}
                      onChange={(e) =>
                        setParametros((anterior) => ({
                          ...anterior,
                          observacoesPadrao: e.target.value
                        }))
                      }
                    />
                  </Stack>
                </CardContent>
              </Card>

              <Card>
                <CardContent>
                  <Stack spacing={2}>
                    <TituloSecao
                      titulo="Como o valor é calculado"
                      subtitulo="Veja como os valores são considerados no orçamento."
                    />

                    <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                      <Typography variant="body2" color="text.secondary">
                        O valor final da mão de obra considera o percentual definido
                        nas configurações.
                      </Typography>
                    </Paper>

                    <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                      <Typography variant="body2" color="text.secondary">
                        O valor final das peças considera o percentual definido nas
                        configurações.
                      </Typography>
                    </Paper>

                    <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                      <Typography variant="body2" color="text.secondary">
                        O total final é a soma da mão de obra, peças e insumos.
                      </Typography>
                    </Paper>

                    <Alert severity="info">
                      Revise as configurações para manter seus orçamentos sempre
                      corretos.
                    </Alert>
                  </Stack>
                </CardContent>
              </Card>
            </Box>
          )}
        </Box>
      </Box>

      {!isDesktop ? (
        <>
          <Paper
            elevation={8}
            sx={{
              position: "fixed",
              left: 12,
              right: 12,
              bottom: 72,
              borderRadius: 4,
              p: 1.5
            }}
          >
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 2
              }}
            >
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Total atual
                </Typography>
                <Typography variant="h6" fontWeight={700}>
                  {moeda(totais.totalFinal)}
                </Typography>
              </Box>

              {aba === 0 ? (
                <Button
                  variant="contained"
                  startIcon={<SaveIcon />}
                  onClick={salvarOrcamento}
                >
                  Salvar
                </Button>
              ) : null}
            </Box>
          </Paper>

          <Paper
            elevation={10}
            sx={{
              position: "fixed",
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 1200
            }}
          >
            <BottomNavigation
              showLabels
              value={aba}
              onChange={(_, novoValor) => setAba(novoValor)}
            >
              <BottomNavigationAction
                label="Orçamento"
                icon={<HomeRepairServiceIcon />}
              />
              <BottomNavigationAction
                label="Histórico"
                icon={<HistoryIcon />}
              />
              <BottomNavigationAction
                label="Config."
                icon={<SettingsIcon />}
              />
            </BottomNavigation>
          </Paper>
        </>
      ) : null}
    </Box>
  );
}
```

---

# 4) Ordem para aplicar

## Backend
1. criar banco MySQL
2. criar pasta `orcamentos-api`
3. colar os arquivos da API
4. preencher o `.env`
5. rodar:

```bash
npm install
node src/server.js
```

---

## Front-end
1. instalar dependências:

```bash
npm install
npm install jspdf
```

2. criar `.env`
3. criar `src/services/api.js`
4. criar `src/LoginPage.jsx`
5. substituir `src/App.jsx`
6. criar `src/OrcamentosPage.jsx`
7. rodar:

```bash
npm run dev
```

---

# 5) Observações importantes

## O que já está pronto
- cadastro de usuário
- login
- validação de token
- rotas protegidas
- salvar orçamento no banco
- listar orçamento do usuário
- excluir orçamento do usuário

## O que ainda pode melhorar depois
- recuperação de senha
- salvar configurações da empresa no banco
- anexar PDF direto pelo backend no e-mail
- compartilhar com número específico no WhatsApp
- exportação de PDF com layout visual mais bonito

---

# 6) Teste rápido

## Criar usuário
- abra o front
- clique em **Ainda não tenho conta**
- cadastre e-mail e senha

## Entrar
- faça login
- crie um orçamento
- clique em **Salvar orçamento**

## Ver histórico
- abra a aba **Histórico**
- o orçamento deve aparecer mesmo depois de recarregar a página

---

# 7) Erros comuns

## CORS
Se der erro de CORS, confira:
- API rodando na porta `4000`
- front rodando na porta `5173`
- `FRONTEND_URL=http://localhost:5173` no `.env` da API

## Falha no banco
Confira:
- usuário e senha do MySQL
- nome do banco
- porta 3306
- se as tabelas foram criadas

## Login inválido
Confira:
- se o usuário foi cadastrado
- se a senha tem pelo menos 6 caracteres

---

# 8) Resumo final

Com esses arquivos:
- o usuário entra com e-mail e senha
- os orçamentos ficam salvos no MySQL
- o histórico não se perde
- cada usuário vê apenas os próprios orçamentos

