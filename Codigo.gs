// ============================================================
//  MONITOR DE PASSAGENS COM IA — Google Apps Script
//  Fonte de dados: SerpAPI (Google Flights) — tempo real
//  Análise: Claude (Anthropic)
//  Alertas: Telegram Bot
// ============================================================

// Todas as chaves vêm do PropertiesService — NUNCA hardcode aqui.
// Para configurar: Extensões → Apps Script → Configurações do projeto
//                             → Propriedades do script → Adicionar propriedade
//
// Propriedades necessárias:
//   SERPAPI_KEY       — chave SerpAPI (64 chars hex)
//   ANTHROPIC_KEY     — chave Anthropic (sk-ant-api03-...)
//   TELEGRAM_TOKEN    — token do bot Telegram (obtido no @BotFather)
//   TELEGRAM_CHAT_ID  — chat ID do usuário (obtido no @userinfobot)

const _PROPS_GAS         = PropertiesService.getScriptProperties();
const SERPAPI_KEY_GAS     = _PROPS_GAS.getProperty('SERPAPI_KEY');
const ANTHROPIC_KEY_GAS   = _PROPS_GAS.getProperty('ANTHROPIC_KEY');
const TELEGRAM_TOKEN_GAS  = _PROPS_GAS.getProperty('TELEGRAM_TOKEN');
const TELEGRAM_CHAT_ID_GAS = _PROPS_GAS.getProperty('TELEGRAM_CHAT_ID');

// ============================================================
//  GERENCIAMENTO DE ALERTAS
// ============================================================

function getAlertas() {
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty("alertas");
  return raw ? JSON.parse(raw) : [];
}

function salvarAlertas(alertas) {
  const props = PropertiesService.getScriptProperties();
  props.setProperty("alertas", JSON.stringify(alertas));
}

function adicionarAlerta(origem, destino, dataIda, dataVolta) {
  const alertas = getAlertas();
  const id = Date.now();
  alertas.push({ id, origem, destino, dataIda, dataVolta: dataVolta || null });
  salvarAlertas(alertas);
  return id;
}

function removerAlerta(indice) {
  const alertas = getAlertas();
  if (indice < 1 || indice > alertas.length) return false;
  alertas.splice(indice - 1, 1);
  salvarAlertas(alertas);
  return true;
}

// ============================================================
//  HISTÓRICO DE PREÇOS
// ============================================================

function getHistorico(id) {
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty(`historico_${id}`);
  return raw ? JSON.parse(raw) : [];
}

function salvarHistorico(id, historico) {
  const props = PropertiesService.getScriptProperties();
  const recente = historico.slice(-30);
  props.setProperty(`historico_${id}`, JSON.stringify(recente));
}

function adicionarHistorico(id, preco) {
  const historico = getHistorico(id);
  historico.push({ preco: preco, data: new Date().toISOString() });
  salvarHistorico(id, historico);
  return historico;
}

// ============================================================
//  SERPAPI — busca preço em tempo real
// ============================================================

function buscarMelhorVoo(voo) {
  try {
    const tipo = voo.dataVolta ? "1" : "2";

    let url =
      `https://serpapi.com/search.json` +
      `?engine=google_flights` +
      `&departure_id=${voo.origem}` +
      `&arrival_id=${voo.destino}` +
      `&outbound_date=${voo.dataIda}` +
      `&currency=BRL` +
      `&hl=pt` +
      `&gl=br` +
      `&type=${tipo}` +
      `&api_key=${SERPAPI_KEY_GAS}`;

    if (voo.dataVolta) url += `&return_date=${voo.dataVolta}`;

    const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const data = JSON.parse(resp.getContentText());

    Logger.log("SerpAPI resposta: " + resp.getContentText().substring(0, 500));

    const todos = [...(data.best_flights || []), ...(data.other_flights || [])];
    if (!todos.length) {
      Logger.log("Nenhum voo encontrado: " + voo.origem + "→" + voo.destino);
      return null;
    }

    todos.sort((a, b) => a.price - b.price);
    const melhor  = todos[0];
    const vooInfo = melhor.flights[0];

    const insights     = data.price_insights || null;
    const priceHistory = insights ? insights.price_history : null;

    return {
      preco:        parseFloat(melhor.price),
      companhia:    vooInfo.airline || "—",
      numeroVoo:    vooInfo.flight_number || "—",
      partida:      vooInfo.departure_airport ? vooInfo.departure_airport.time : "—",
      chegada:      vooInfo.arrival_airport ? vooInfo.arrival_airport.time : "—",
      duracao:      melhor.total_duration || 0,
      escalas:      melhor.flights.length - 1,
      nivelPreco:   insights ? insights.price_level : null,
      faixaPreco:   insights ? insights.typical_price_range : null,
      priceHistory: priceHistory,
    };

  } catch (err) {
    Logger.log("Erro na SerpAPI: " + err.toString());
    return null;
  }
}

// ============================================================
//  MONITORAMENTO DE PREÇOS (roda 4x por dia via acionador)
// ============================================================

function monitorarPassagens() {
  const alertas = getAlertas();
  if (alertas.length === 0) return;

  const props = PropertiesService.getScriptProperties();

  alertas.forEach(voo => {
    const resultado = buscarMelhorVoo(voo);
    if (!resultado) return;

    // fix: desestrutura como numeroVoo e usa esse nome consistentemente
    const { preco, companhia, numeroVoo, partida, chegada, escalas, nivelPreco, faixaPreco, priceHistory } = resultado;
    const chave         = `preco_${voo.id}`;
    const precoAnterior = parseFloat(props.getProperty(chave) || "0");
    const historico     = adicionarHistorico(voo.id, preco);

    Logger.log(`[${voo.origem}→${voo.destino}] Anterior: ${precoAnterior} | Atual: ${preco} | ${companhia}`);

    const nivelStr = traduzirNivel(nivelPreco);

    if (precoAnterior === 0) {
      props.setProperty(chave, preco.toString());
      enviarTelegram(
        `✈️ *Alerta ativado!*\n` +
        `${voo.origem} → ${voo.destino}\n` +
        `🏢 *${companhia}* · Voo ${numeroVoo}\n` +
        `🕐 ${partida} → ${chegada}${escalas > 0 ? ` (${escalas} escala)` : " · direto"}\n` +
        `📅 Ida: ${voo.dataIda}${voo.dataVolta ? " | Volta: " + voo.dataVolta : " _(somente ida)_"}\n` +
        `💰 Preço base: *R$ ${preco.toFixed(2)}*\n` +
        (nivelStr ? `📊 Nível: ${nivelStr}\n` : "") +
        (faixaPreco ? `📈 Faixa típica: R$ ${faixaPreco[0]} – R$ ${faixaPreco[1]}\n` : "") +
        `\n_Use /analisar para recomendação de compra._`
      );
      return;
    }

    props.setProperty(chave, preco.toString());

    if (preco < precoAnterior) {
      const economia = (precoAnterior - preco).toFixed(2);
      const pct      = (((precoAnterior - preco) / precoAnterior) * 100).toFixed(1);
      const mercado  = { nivelPreco, faixaPreco, priceHistory, companhia, numVoo: numeroVoo, partida, chegada, escalas };
      const analise  = analisarComIA(voo, preco, historico, mercado);

      enviarTelegram(
        `🚨 *QUEDA DE PREÇO!*\n\n` +
        `✈️ *${voo.origem} → ${voo.destino}*\n` +
        `🏢 *${companhia}* · Voo ${numeroVoo}\n` +
        `🕐 ${partida} → ${chegada}${escalas > 0 ? ` (${escalas} escala)` : " · direto"}\n` +
        `📅 Ida: ${voo.dataIda}${voo.dataVolta ? "\n🔄 Volta: " + voo.dataVolta : " _(somente ida)_"}\n\n` +
        `~~R$ ${precoAnterior.toFixed(2)}~~ → *R$ ${preco.toFixed(2)}*\n` +
        `💰 Economia de *R$ ${economia}* (${pct}% mais barato)\n` +
        (nivelStr ? `📊 Nível de preço: ${nivelStr}\n` : "") +
        (faixaPreco ? `📈 Faixa típica: R$ ${faixaPreco[0]} – R$ ${faixaPreco[1]}\n` : "") +
        `\n${analise}`
      );
    }
  });
}

// ============================================================
//  ANÁLISE COM IA (Claude)
// ============================================================

function analisarComIA(voo, precoAtual, historico, mercado) {
  try {
    const props         = PropertiesService.getScriptProperties();
    const precoInicial  = parseFloat(props.getProperty(`preco_${voo.id}`) || precoAtual);
    const precoMinimo   = Math.min(...historico.map(h => h.preco));
    const precoMaximo   = Math.max(...historico.map(h => h.preco));
    const precoMedio    = (historico.reduce((s, h) => s + h.preco, 0) / historico.length).toFixed(2);
    const variacaoTotal = (((precoAtual - precoInicial) / precoInicial) * 100).toFixed(1);

    const hoje          = new Date();
    const dataViagem    = new Date(voo.dataIda);
    const diasRestantes = Math.ceil((dataViagem - hoje) / (1000 * 60 * 60 * 24));

    let tendencia = "estável";
    let tendenciaDetalhe = "";
    if (historico.length >= 3) {
      const ultimos = historico.slice(-5).map(h => h.preco);
      if (ultimos[ultimos.length - 1] < ultimos[0]) {
        tendencia = "queda";
        const quedaPct = (((ultimos[0] - ultimos[ultimos.length - 1]) / ultimos[0]) * 100).toFixed(1);
        tendenciaDetalhe = `caindo ${quedaPct}% nas últimas verificações`;
      } else if (ultimos[ultimos.length - 1] > ultimos[0]) {
        tendencia = "alta";
        const altaPct = (((ultimos[ultimos.length - 1] - ultimos[0]) / ultimos[0]) * 100).toFixed(1);
        tendenciaDetalhe = `subindo ${altaPct}% nas últimas verificações`;
      }
    }

    let historicoMercadoStr = "";
    if (mercado && mercado.priceHistory && mercado.priceHistory.length > 0) {
      const hist          = mercado.priceHistory;
      const precosMercado = hist.map(h => h[1]);
      const minMercado    = Math.min(...precosMercado);
      const maxMercado    = Math.max(...precosMercado);
      const mediaMercado  = (precosMercado.reduce((s, p) => s + p, 0) / precosMercado.length).toFixed(0);
      const ultimos7      = precosMercado.slice(-7);
      const tendMercado   = ultimos7[ultimos7.length - 1] > ultimos7[0] ? "alta" :
                            ultimos7[ultimos7.length - 1] < ultimos7[0] ? "queda" : "estável";

      historicoMercadoStr = `
HISTÓRICO DE MERCADO — últimos 60 dias (Google Flights):
- Preço mínimo no período: R$ ${minMercado}
- Preço máximo no período: R$ ${maxMercado}
- Preço médio no período: R$ ${mediaMercado}
- Tendência dos últimos 7 dias: ${tendMercado}
- Preço atual vs mínimo histórico: ${precoAtual <= minMercado ? "NO MÍNIMO HISTÓRICO" : `R$ ${(precoAtual - minMercado).toFixed(0)} acima do mínimo`}
- Preço atual vs média histórica: ${precoAtual < mediaMercado ? `R$ ${(mediaMercado - precoAtual).toFixed(0)} abaixo da média` : `R$ ${(precoAtual - mediaMercado).toFixed(0)} acima da média`}`;
    }

    let dadosVooStr = "";
    if (mercado && mercado.companhia) {
      dadosVooStr = `
DADOS DO VOO:
- Companhia: ${mercado.companhia}
- Número: ${mercado.numVoo || "—"}
- Horário: ${mercado.partida || "—"} → ${mercado.chegada || "—"}
- Escalas: ${mercado.escalas === 0 ? "voo direto" : mercado.escalas + " escala(s)"}`;
    }

    const mesViagem      = dataViagem.getMonth() + 1;
    const diaViagem      = dataViagem.getDate();
    const altaTemporada  = [7, 12, 1];
    const baixaTemporada = [3, 4, 5, 8, 9, 10];
    let sazonalidadeStr  = altaTemporada.includes(mesViagem)  ? "Alta temporada — preços tendem a ser altos" :
                           baixaTemporada.includes(mesViagem) ? "Baixa temporada — boa janela para comprar"  :
                           "Temporada intermediária";

    const feriados = [
      { mes: 1,  dia: 1  }, { mes: 4, dia: 21 }, { mes: 5, dia: 1  },
      { mes: 9,  dia: 7  }, { mes: 10, dia: 12 }, { mes: 11, dia: 2 },
      { mes: 11, dia: 15 },
    ];
    const feriadoProximo = feriados.find(f => f.mes === mesViagem && Math.abs(f.dia - diaViagem) <= 5);
    if (feriadoProximo) sazonalidadeStr += " — próximo de feriado";

    let contextoMercadoStr = "";
    if (mercado && mercado.faixaPreco) {
      contextoMercadoStr = `
DADOS DE MERCADO (Google Flights):
- Nível de preço: ${traduzirNivel(mercado.nivelPreco) || "não disponível"}
- Faixa típica da rota: R$ ${mercado.faixaPreco[0]} – R$ ${mercado.faixaPreco[1]}
- Posição atual: ${precoAtual < mercado.faixaPreco[0] ? "ABAIXO da faixa típica" : precoAtual > mercado.faixaPreco[1] ? "ACIMA da faixa típica" : "DENTRO da faixa típica"}`;
    }

    const prompt = `Você é um especialista em passagens aéreas no Brasil. Analise os dados abaixo e dê uma recomendação objetiva.

DADOS DO VOO MONITORADO:
- Rota: ${voo.origem} → ${voo.destino}
- Data de ida: ${voo.dataIda}
- Data de volta: ${voo.dataVolta || "somente ida"}
- Dias até a viagem: ${diasRestantes} dias
- Sazonalidade: ${sazonalidadeStr}
${dadosVooStr}

HISTÓRICO DO MONITORAMENTO:
- Preço base: R$ ${precoInicial.toFixed(2)}
- Preço atual: R$ ${precoAtual.toFixed(2)}
- Variação total: ${variacaoTotal}%
- Mínimo registrado: R$ ${precoMinimo.toFixed(2)}
- Máximo registrado: R$ ${precoMaximo.toFixed(2)}
- Média registrada: R$ ${precoMedio}
- Tendência: ${tendencia} ${tendenciaDetalhe ? `(${tendenciaDetalhe})` : ""}
- Verificações: ${historico.length}
${contextoMercadoStr}
${historicoMercadoStr}`;

    const response = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", {
      method: "post",
      contentType: "application/json",
      headers: {
        "x-api-key":         ANTHROPIC_KEY_GAS,
        "anthropic-version": "2023-06-01"
      },
      payload: JSON.stringify({
        model:      "claude-haiku-4-5-20251001",
        max_tokens: 100,
        system: "Você é um especialista em passagens aéreas. Responda SEMPRE em exatamente 2 frases curtas em português. Sem títulos, traços ou markdown.",
        messages: [{ role: "user", content: prompt }]
      }),
      muteHttpExceptions: true
    });

    const data   = JSON.parse(response.getContentText());
    const resumo = (data.content || [])
      .filter(b => b.type === "text")
      .map(b => b.text)
      .join("").trim();

    return resumo ? `🤖 *Análise:*\n${resumo}` : "";

  } catch (err) {
    Logger.log("Erro na análise IA: " + err.toString());
    return "";
  }
}

// ============================================================
//  POLLING — verifica mensagens do Telegram (roda a cada 1 min)
// ============================================================

function verificarMensagens() {
  const props      = PropertiesService.getScriptProperties();
  const lastUpdate = parseInt(props.getProperty("last_update_id") || "0");
  const url        = `https://api.telegram.org/bot${TELEGRAM_TOKEN_GAS}/getUpdates?offset=${lastUpdate + 1}&limit=10`;

  const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  const data = JSON.parse(resp.getContentText());

  if (!data.ok || data.result.length === 0) return;

  data.result.forEach(update => {
    const msg = update.message;
    if (!msg || !msg.text) return;

    if (String(msg.chat.id) !== String(TELEGRAM_CHAT_ID_GAS)) return;

    const texto  = msg.text.trim();
    const partes = texto.split(/\s+/);
    const cmd    = partes[0].toLowerCase();

    if (cmd === "/adicionar") {
      if (partes.length < 4) {
        enviarTelegram("❌ Formato inválido.\n\nUse: `/adicionar ORIGEM DESTINO DATA_IDA DATA_VOLTA`\nOu para só ida: `/adicionar ORIGEM DESTINO DATA_IDA`\n\nExemplo: `/adicionar CGH FLN 2026-07-23 2026-07-28`");
        return;
      }
      const origem    = partes[1].toUpperCase();
      const destino   = partes[2].toUpperCase();
      const dataIda   = partes[3];
      const dataVolta = partes[4] || null;

      if (!isDataValida(dataIda) || (dataVolta && !isDataValida(dataVolta))) {
        enviarTelegram("❌ Data inválida. Use o formato *AAAA-MM-DD* (ex: 2026-07-23).");
        return;
      }

      adicionarAlerta(origem, destino, dataIda, dataVolta);
      enviarTelegram(
        `✅ *Alerta criado com sucesso!*\n\n` +
        `✈️ ${origem} → ${destino}\n` +
        `📅 Ida: ${dataIda}${dataVolta ? " | Volta: " + dataVolta : " _(somente ida)_"}\n\n` +
        `Monitoramento: *4x por dia* (07h, 12h, 18h, 23h)\n` +
        `Use /analisar para recomendação de compra.`
      );

    } else if (cmd === "/listar") {
      const alertas = getAlertas();
      if (alertas.length === 0) {
        enviarTelegram("📭 Nenhum alerta cadastrado.\n\nUse /adicionar para criar um.");
        return;
      }
      let resposta = `📋 *Alertas ativos (${alertas.length}):*\n\n`;
      alertas.forEach((a, i) => {
        const precoAtual = props.getProperty(`preco_${a.id}`);
        const precoStr   = precoAtual ? `R$ ${parseFloat(precoAtual).toFixed(2)}` : "aguardando 1ª verificação";
        resposta += `*${i + 1}.* ${a.origem} → ${a.destino}\n`;
        resposta += `   📅 Ida: ${a.dataIda}`;
        resposta += a.dataVolta ? ` | Volta: ${a.dataVolta}` : ` _(somente ida)_`;
        resposta += `\n   💰 Último preço: ${precoStr}\n\n`;
      });
      resposta += "Para remover, use /remover NÚMERO\nEx: `/remover 1`";
      enviarTelegram(resposta);

    } else if (cmd === "/analisar") {
      const alertas = getAlertas();
      if (alertas.length === 0) {
        enviarTelegram("📭 Nenhum alerta cadastrado.\n\nUse /adicionar para criar um.");
        return;
      }

      enviarTelegram("🔍 Buscando preços em tempo real e analisando, aguarde...");

      alertas.forEach(voo => {
        const resultado = buscarMelhorVoo(voo);
        if (!resultado) {
          enviarTelegram(`⚠️ ${voo.origem} → ${voo.destino}: não foi possível buscar preços agora.`);
          return;
        }

        // fix: desestrutura como numeroVoo (era resultado.voo antes)
        const { preco, companhia, numeroVoo, partida, chegada, escalas, nivelPreco, faixaPreco } = resultado;
        const historico = getHistorico(voo.id);
        const mercado   = { nivelPreco, faixaPreco };
        const analise   = analisarComIA(
          voo, preco,
          historico.length > 0 ? historico : [{ preco, data: new Date().toISOString() }],
          mercado
        );

        enviarTelegram(
          `✈️ *${voo.origem} → ${voo.destino}*\n` +
          `🏢 *${companhia}* · Voo ${numeroVoo}\n` +
          `🕐 ${partida} → ${chegada}${escalas > 0 ? ` (${escalas} escala)` : " · direto"}\n` +
          `📅 Ida: ${voo.dataIda}${voo.dataVolta ? " | Volta: " + voo.dataVolta : ""}\n` +
          `💰 Preço atual: *R$ ${preco.toFixed(2)}*\n` +
          (nivelPreco ? `📊 Nível: ${traduzirNivel(nivelPreco)}\n` : "") +
          (faixaPreco ? `📈 Faixa típica: R$ ${faixaPreco[0]} – R$ ${faixaPreco[1]}\n` : "") +
          `\n${analise}`
        );
      });

    } else if (cmd === "/remover") {
      if (partes.length < 2 || isNaN(partes[1])) {
        enviarTelegram("❌ Informe o número do alerta.\nEx: `/remover 1`\n\nUse /listar para ver os números.");
        return;
      }
      const indice  = parseInt(partes[1]);
      const alertas = getAlertas();
      if (indice < 1 || indice > alertas.length) {
        enviarTelegram(`❌ Alerta #${indice} não encontrado. Use /listar para ver os alertas ativos.`);
        return;
      }
      const removido = alertas[indice - 1];
      props.deleteProperty(`preco_${removido.id}`);
      props.deleteProperty(`historico_${removido.id}`);
      removerAlerta(indice);
      enviarTelegram(
        `🗑️ Alerta removido!\n\n` +
        `✈️ ${removido.origem} → ${removido.destino}\n` +
        `📅 Ida: ${removido.dataIda}${removido.dataVolta ? " | Volta: " + removido.dataVolta : ""}`
      );

    } else if (cmd === "/ajuda" || cmd === "/start" || cmd === "/help") {
      enviarTelegram(
        `✈️ *Monitor de Passagens com IA*\n\n` +
        `*Comandos disponíveis:*\n\n` +
        `📌 /adicionar \`ORIGEM DESTINO IDA [VOLTA]\`\n` +
        `_Cria um novo alerta de preço_\n` +
        `Ex: \`/adicionar CGH FLN 2026-07-23 2026-07-28\`\n\n` +
        `📋 /listar\n` +
        `_Exibe todos os alertas ativos com preços_\n\n` +
        `🤖 /analisar\n` +
        `_Busca preços em tempo real e analisa com IA_\n\n` +
        `🗑️ /remover \`NÚMERO\`\n` +
        `_Remove um alerta pelo número_\n\n` +
        `🔔 Monitoramento: *4x por dia* (07h, 12h, 18h, 23h)\n` +
        `📊 Dados em tempo real via Google Flights\n` +
        `🤖 Análise de IA apenas quando o preço cair`
      );

    } else {
      enviarTelegram("❓ Comando não reconhecido.\n\nDigite /ajuda para ver os comandos disponíveis.");
    }

    props.setProperty("last_update_id", update.update_id.toString());
  });
}

// ============================================================
//  TELEGRAM — envio de mensagem
// ============================================================

function enviarTelegram(mensagem) {
  UrlFetchApp.fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN_GAS}/sendMessage`, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({
      chat_id:    TELEGRAM_CHAT_ID_GAS,
      text:       mensagem,
      parse_mode: "Markdown"
    }),
    muteHttpExceptions: true
  });
}

// ============================================================
//  UTILITÁRIOS
// ============================================================

function isDataValida(str) {
  return /^\d{4}-\d{2}-\d{2}$/.test(str) && !isNaN(Date.parse(str));
}

function traduzirNivel(nivel) {
  const map = {
    "low":     "🟢 Baixo — ótimo momento para comprar",
    "typical": "🟡 Típico — preço dentro do normal",
    "high":    "🔴 Alto — acima do habitual",
  };
  return map[nivel] || null;
}

function resetarUpdates() {
  PropertiesService.getScriptProperties().deleteProperty("last_update_id");
}

function testeMonitorar() {
  const alertas = getAlertas();
  alertas.forEach(voo => {
    const resultado = buscarMelhorVoo(voo);
    if (!resultado) { Logger.log("Sem resultado para " + voo.origem); return; }
    const historico = getHistorico(voo.id);
    const mercado = {
      nivelPreco:   resultado.nivelPreco,
      faixaPreco:   resultado.faixaPreco,
      priceHistory: resultado.priceHistory,
      companhia:    resultado.companhia,
      numVoo:       resultado.numeroVoo,
      partida:      resultado.partida,
      chegada:      resultado.chegada,
      escalas:      resultado.escalas,
    };
    const analise = analisarComIA(voo, resultado.preco, historico, mercado);
    Logger.log("Análise: " + analise);
  });
}
