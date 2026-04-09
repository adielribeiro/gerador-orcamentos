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
import { Link as RouterLink } from "react-router-dom";
import AddIcon from "@mui/icons-material/Add";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
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
  return (Array.isArray(lista) ? lista : []).reduce((acc, item) => {
    const quantidade = paraNumero(item?.quantidade);
    const valorUnitario = paraNumero(item?.valorUnitario);
    return acc + quantidade * valorUnitario;
  }, 0);
}

function arredondar(valor) {
  return Number((valor || 0).toFixed(2));
}

function normalizarParametros(parametros) {
  return {
    nomeEmpresa: parametros?.nomeEmpresa || DEFAULT_PARAMS.nomeEmpresa,
    percentualMaoDeObra: paraNumero(
      parametros?.percentualMaoDeObra ?? DEFAULT_PARAMS.percentualMaoDeObra
    ),
    percentualPecas: paraNumero(
      parametros?.percentualPecas ?? DEFAULT_PARAMS.percentualPecas
    ),
    validadeOrcamentoDias: paraNumero(
      parametros?.validadeOrcamentoDias ?? DEFAULT_PARAMS.validadeOrcamentoDias
    ),
    observacoesPadrao:
      parametros?.observacoesPadrao || DEFAULT_PARAMS.observacoesPadrao
  };
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

function normalizarListaItens(lista) {
  if (!Array.isArray(lista)) return [];

  return lista.map((item) => ({
    descricao: item?.descricao || "",
    quantidade: item?.quantidade ?? 1,
    valorUnitario: item?.valorUnitario ?? ""
  }));
}

function normalizarQuoteHistorico(item, parametrosPadrao = DEFAULT_PARAMS) {
  const quote = item && typeof item === "object" ? item : {};

  const pecas = normalizarListaItens(quote?.itens?.pecas ?? quote?.pecas ?? []);
  const insumos = normalizarListaItens(quote?.itens?.insumos ?? quote?.insumos ?? []);

  const percentualMaoDeObra = paraNumero(
    quote?.parametrosAplicados?.percentualMaoDeObra ??
      parametrosPadrao.percentualMaoDeObra
  );

  const percentualPecas = paraNumero(
    quote?.parametrosAplicados?.percentualPecas ?? parametrosPadrao.percentualPecas
  );

  const validadeOrcamentoDias = paraNumero(
    quote?.parametrosAplicados?.validadeOrcamentoDias ??
      parametrosPadrao.validadeOrcamentoDias
  );

  const subtotalPecas = paraNumero(
    quote?.totais?.subtotalPecas ?? totalItens(pecas)
  );

  const subtotalInsumos = paraNumero(
    quote?.totais?.subtotalInsumos ?? totalItens(insumos)
  );

  const maoDeObraBase = paraNumero(
    quote?.totais?.maoDeObraBase ?? quote?.valorMaoDeObra ?? 0
  );

  const maoDeObraFinal = paraNumero(
    quote?.totais?.maoDeObraFinal ??
      maoDeObraBase * (1 + percentualMaoDeObra / 100)
  );

  const pecasFinal = paraNumero(
    quote?.totais?.pecasFinal ??
      subtotalPecas * (1 + percentualPecas / 100)
  );

  const totalFinal = paraNumero(
    quote?.totais?.totalFinal ??
      maoDeObraFinal + pecasFinal + subtotalInsumos
  );

  return {
    ...quote,
    id: quote?.id,
    empresa: quote?.empresa || parametrosPadrao.nomeEmpresa || "Minha Empresa",
    cliente: quote?.cliente || quote?.client || "Sem nome",
    descricaoServico: quote?.descricaoServico || "",
    observacoes: quote?.observacoes || "",
    dataCriacao: quote?.dataCriacao || quote?.created_at || new Date().toISOString(),
    itens: {
      pecas,
      insumos
    },
    parametrosAplicados: {
      percentualMaoDeObra,
      percentualPecas,
      validadeOrcamentoDias
    },
    totais: {
      maoDeObraBase: arredondar(maoDeObraBase),
      subtotalPecas: arredondar(subtotalPecas),
      subtotalInsumos: arredondar(subtotalInsumos),
      maoDeObraFinal: arredondar(maoDeObraFinal),
      pecasFinal: arredondar(pecasFinal),
      totalFinal: arredondar(totalFinal)
    }
  };
}

function normalizarParaCompartilhamento(registro, parametrosAtuais, totaisAtuais) {
  const ehHistorico = !!registro?.itens;

  if (ehHistorico) {
    const normalizado = normalizarQuoteHistorico(registro, parametrosAtuais);

    return {
      empresa: normalizado.empresa || parametrosAtuais.nomeEmpresa || "Minha Empresa",
      cliente: normalizado.cliente || "Sem nome",
      descricaoServico: normalizado.descricaoServico || "",
      observacoes: normalizado.observacoes || "",
      dataCriacao: normalizado.dataCriacao || new Date().toISOString(),
      pecas: normalizado.itens?.pecas || [],
      insumos: normalizado.itens?.insumos || [],
      parametrosAplicados: {
        percentualMaoDeObra: paraNumero(
          normalizado.parametrosAplicados?.percentualMaoDeObra
        ),
        percentualPecas: paraNumero(
          normalizado.parametrosAplicados?.percentualPecas
        ),
        validadeOrcamentoDias: paraNumero(
          normalizado.parametrosAplicados?.validadeOrcamentoDias
        )
      },
      totais: normalizado.totais
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
  adicionarLinhaValor("Mão de obra", moeda(dados.totais.maoDeObraFinal));
  adicionarLinhaValor("Peças", moeda(dados.totais.pecasFinal));
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
  const [parametros, setParametros] = useState(DEFAULT_PARAMS);
  const [orcamento, setOrcamento] = useState(criarOrcamentoInicial(DEFAULT_PARAMS));
  const [historico, setHistorico] = useState([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(true);
  const [carregandoConfiguracoes, setCarregandoConfiguracoes] = useState(true);
  const [salvandoConfiguracoes, setSalvandoConfiguracoes] = useState(false);
  const [mensagem, setMensagem] = useState("");

  useEffect(() => {
    async function carregarTudo() {
      try {
        setCarregandoConfiguracoes(true);
        const config = await api.getSettings(token);
        const configNormalizada = normalizarParametros(config);

        setParametros(configNormalizada);
        setOrcamento(criarOrcamentoInicial(configNormalizada));

        setCarregandoHistorico(true);
        const dados = await api.getQuotes(token);
        const listaNormalizada = (Array.isArray(dados) ? dados : []).map((item) =>
          normalizarQuoteHistorico(item, configNormalizada)
        );
        setHistorico(listaNormalizada);
      } catch {
        setHistorico([]);
      } finally {
        setCarregandoConfiguracoes(false);
        setCarregandoHistorico(false);
      }
    }

    carregarTudo();
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

  const salvarConfiguracoes = async () => {
    try {
      setSalvandoConfiguracoes(true);

      const payload = {
        nomeEmpresa: parametros.nomeEmpresa,
        percentualMaoDeObra: paraNumero(parametros.percentualMaoDeObra),
        percentualPecas: paraNumero(parametros.percentualPecas),
        validadeOrcamentoDias: paraNumero(parametros.validadeOrcamentoDias),
        observacoesPadrao: parametros.observacoesPadrao
      };

      const salvo = await api.updateSettings(token, payload);
      const configuracoesSalvas = normalizarParametros(salvo);

      setParametros(configuracoesSalvas);
      setOrcamento((anterior) => ({
        ...anterior,
        observacoes:
          !anterior.observacoes ||
          anterior.observacoes === parametros.observacoesPadrao
            ? configuracoesSalvas.observacoesPadrao
            : anterior.observacoes
      }));

      mostrarMensagem("Configurações salvas com sucesso.");
    } catch (error) {
      mostrarMensagem(error.message || "Não foi possível salvar as configurações.");
    } finally {
      setSalvandoConfiguracoes(false);
    }
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
      const salvoNormalizado = normalizarQuoteHistorico(salvo, parametros);

      setHistorico((anterior) => [salvoNormalizado, ...anterior]);
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
        <Toolbar sx={{ borderBottom: "1px solid #e5e7eb", gap: 1, flexWrap: "wrap" }}>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            {parametros.nomeEmpresa || "Gerador de Orçamentos"}
          </Typography>

          <Chip
            icon={<CalculateIcon />}
            label="Orçamentos"
            color="primary"
            variant="outlined"
          />

          {user?.role === "admin" ? (
            <Button
              component={RouterLink}
              to="/admin"
              variant="outlined"
              startIcon={<AdminPanelSettingsIcon />}
            >
              Administração
            </Button>
          ) : null}

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
                historico.map((item) => {
                  const itemNormalizado = normalizarQuoteHistorico(item, parametros);

                  return (
                    <Card key={itemNormalizado.id}>
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
                              <Typography variant="h6">
                                {itemNormalizado.cliente}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {formatarData(itemNormalizado.dataCriacao)}
                              </Typography>
                            </Box>

                            <Chip
                              color="secondary"
                              label={moeda(itemNormalizado.totais.totalFinal)}
                            />
                          </Box>

                          <Typography variant="body2">
                            <strong>Serviço:</strong>{" "}
                            {itemNormalizado.descricaoServico || "Não informado"}
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
                                {moeda(itemNormalizado.totais.maoDeObraFinal)}
                              </Typography>
                            </Paper>

                            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 3 }}>
                              <Typography variant="body2" color="text.secondary">
                                Peças final
                              </Typography>
                              <Typography fontWeight={700}>
                                {moeda(itemNormalizado.totais.pecasFinal)}
                              </Typography>
                            </Paper>

                            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 3 }}>
                              <Typography variant="body2" color="text.secondary">
                                Insumos
                              </Typography>
                              <Typography fontWeight={700}>
                                {moeda(itemNormalizado.totais.subtotalInsumos)}
                              </Typography>
                            </Paper>

                            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 3 }}>
                              <Typography variant="body2" color="text.secondary">
                                Total
                              </Typography>
                              <Typography fontWeight={700}>
                                {moeda(itemNormalizado.totais.totalFinal)}
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
                                onClick={() => baixarPdf(itemNormalizado)}
                              >
                                PDF
                              </Button>

                              <Button
                                variant="outlined"
                                startIcon={<ShareIcon />}
                                onClick={() => compartilharPdf(itemNormalizado)}
                              >
                                Compartilhar
                              </Button>

                              <Button
                                variant="outlined"
                                startIcon={<SendIcon />}
                                onClick={() => enviarWhatsApp(itemNormalizado)}
                              >
                                WhatsApp
                              </Button>

                              <Button
                                variant="outlined"
                                startIcon={<EmailIcon />}
                                onClick={() => enviarEmail(itemNormalizado)}
                              >
                                E-mail
                              </Button>
                            </Stack>

                            <Button
                              color="error"
                              variant="outlined"
                              startIcon={<DeleteOutlineIcon />}
                              onClick={() => excluirOrcamento(itemNormalizado.id)}
                            >
                              Excluir
                            </Button>
                          </Stack>
                        </Stack>
                      </CardContent>
                    </Card>
                  );
                })
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
                      subtitulo="Defina os valores usados nos cálculos para sua conta."
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
                      disabled={carregandoConfiguracoes}
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
                      disabled={carregandoConfiguracoes}
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
                      disabled={carregandoConfiguracoes}
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
                      disabled={carregandoConfiguracoes}
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
                      disabled={carregandoConfiguracoes}
                    />

                    <Button
                      variant="contained"
                      startIcon={<SaveIcon />}
                      onClick={salvarConfiguracoes}
                      disabled={carregandoConfiguracoes || salvandoConfiguracoes}
                    >
                      {salvandoConfiguracoes
                        ? "Salvando..."
                        : "Salvar configurações"}
                    </Button>
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
                      Essas configurações agora pertencem somente ao usuário logado.
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