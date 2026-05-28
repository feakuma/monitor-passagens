// ============================================================
//  MultiUser.gs — Monitor de Passagens Multiusuário
//  Fase 14: Fallback SerpAPI→Apify, push nativo, IA por usuário
// ============================================================

const UPSTASH_URL_MU   = 'https://smooth-werewolf-110654.upstash.io';
const WORKER_URL_MU    = 'https://passagens-proxy.felipe-akuma.workers.dev';

// Todas as chaves vêm do PropertiesService — NUNCA hardcode aqui.
// Para configurar: Extensões → Apps Script → Configurações do projeto → Propriedades do script
const _PROPS            = PropertiesService.getScriptProperties();
const UPSTASH_TOKEN_MU  = _PROPS.getProperty('UPSTASH_TOKEN');
const ADMIN_SECRET_MU   = _PROPS.getProperty('ADMIN_SECRET');
const RESEND_KEY_MU     = _PROPS.getProperty('RESEND_KEY');
const SERPAPI_KEY_MU    = _PROPS.getProperty('SERPAPI_KEY');
const APIFY_KEY_MU      = _PROPS.getProperty('APIFY_KEY');
const TELEGRAM_TOKEN_MU = _PROPS.getProperty('TELEGRAM_TOKEN');   // token do bot (@userinfobot)
const ANTHROPIC_KEY_MU  = _PROPS.getProperty('ANTHROPIC_KEY');    // chave sistema (fallback quando usuário não tem token próprio)

// ============================================================
//  REDIS HELPERS
// ============================================================

/** Executa um comando Redis via REST (path encoding). Retorna data.result bruto. */
function redisCmdMU() {
  var args = Array.prototype.slice.call(arguments);
  var path = args.map(encodeURIComponent).join('/');
  var resp = UrlFetchApp.fetch(UPSTASH_URL_MU + '/' + path, {
    headers: { Authorization: 'Bearer ' + UPSTASH_TOKEN_MU },
    muteHttpExceptions: true
  });
  return JSON.parse(resp.getContentText()).result;
}

/** Executa múltiplos comandos em uma única requisição HTTP (pipeline). */
function redisPipelineMU(commands) {
  UrlFetchApp.fetch(UPSTASH_URL_MU + '/pipeline', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + UPSTASH_TOKEN_MU, 'Content-Type': 'application/json' },
    payload: JSON.stringify(commands),
    muteHttpExceptions: true
  });
}

function redisGetMU(key) {
  var raw = redisCmdMU('GET', key);
  return raw ? JSON.parse(raw) : null;
}

function redisSetMU(key, value) {
  redisCmdMU('SET', key, JSON.stringify(value));
}

function redisSetExMU(key, value, ttl) {
  redisCmdMU('SET', key, JSON.stringify(value), 'EX', String(ttl));
}

// ============================================================
//  AUDIT LOG
// ============================================================

function auditLogMU(email, tipo, detalhe) {
  try {
    var data  = new Date().toISOString().slice(0, 10);
    var key   = 'audit:' + email + ':' + data;
    var entry = JSON.stringify({ ts: new Date().toISOString(), tipo: tipo, detalhe: detalhe || '' });
    UrlFetchApp.fetch(UPSTASH_URL_MU + '/pipeline', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + UPSTASH_TOKEN_MU, 'Content-Type': 'application/json' },
      payload: JSON.stringify([
        ['RPUSH', key, entry],
        ['LTRIM', key, '-200', '-1'],
        ['EXPIRE', key, '7776000']
      ]),
      muteHttpExceptions: true
    });
  } catch (err) {
    Logger.log('Erro auditLog: ' + err.toString());
  }
}

// ============================================================
//  BUSCAR TODOS OS USUÁRIOS ATIVOS
// ============================================================

function getUsuariosAtivos() {
  // Usa idx:usuarios (SET) para evitar KEYS scan O(N).
  // Fallback automático na primeira execução: popula o índice a partir de KEYS
  // e nunca mais faz scan depois.
  var emails = redisCmdMU('SMEMBERS', 'idx:usuarios') || [];

  if (!emails.length) {
    // Migração única: popula o índice
    var chaves = redisCmdMU('KEYS', 'usuario:*') || [];
    emails = chaves.map(function(k) { return k.replace('usuario:', ''); });
    if (emails.length) {
      var pipeline = emails.map(function(e) { return ['SADD', 'idx:usuarios', e]; });
      redisPipelineMU(pipeline);
      Logger.log('idx:usuarios populado com ' + emails.length + ' email(s) via migração.');
    }
  }

  var usuarios = [];
  emails.forEach(function(email) {
    var usuario = redisGetMU('usuario:' + email);
    if (usuario && usuario.ativo) usuarios.push(usuario);
  });
  return usuarios;
}

// ============================================================
//  HISTÓRICO E PREÇO POR USUÁRIO
// ============================================================

function getHistoricoMU(email, alertaId) {
  return redisGetMU(`historico:${email}:${alertaId}`) || [];
}

function adicionarHistoricoMU(email, alertaId, preco) {
  const historico = getHistoricoMU(email, alertaId);
  historico.push({ preco, data: new Date().toISOString() });
  const recente = historico.slice(-30);
  redisSetMU(`historico:${email}:${alertaId}`, recente);
  return recente;
}

function getPrecoMU(email, alertaId) {
  return redisGetMU(`preco:${email}:${alertaId}`) || 0;
}

function setPrecoMU(email, alertaId, preco) {
  redisSetMU(`preco:${email}:${alertaId}`, preco);
}

// ============================================================
//  BUSCAR VOO — SerpAPI com fallback para Apify
// ============================================================

function buscarMelhorVooMU(voo) {
  // Tenta SerpAPI primeiro
  try {
    const resultado = buscarViaSerpAPI(voo);
    if (resultado) return resultado;
  } catch (err) {
    Logger.log(`SerpAPI falhou (${err.toString()}) — tentando Apify...`);
  }

  // Fallback: Apify
  if (APIFY_KEY_MU) {
    try {
      const resultado = buscarViaApify(voo);
      if (resultado) return resultado;
    } catch (err) {
      Logger.log(`Apify também falhou: ${err.toString()}`);
    }
  }

  return null;
}

function buscarViaSerpAPI(voo) {
  const tipo = voo.dataVolta ? '1' : '2';
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
    `&api_key=${SERPAPI_KEY_MU}`;

  if (voo.dataVolta) url += `&return_date=${voo.dataVolta}`;

  const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });

  if (resp.getResponseCode() === 429) {
    throw new Error('429 — limite SerpAPI atingido');
  }

  const data = JSON.parse(resp.getContentText());

  if (data.error) {
    throw new Error('SerpAPI error: ' + data.error);
  }

  const todos = [...(data.best_flights || []), ...(data.other_flights || [])];
  if (!todos.length) return null;

  todos.sort((a, b) => a.price - b.price);
  const melhor   = todos[0];
  const vooInfo  = melhor.flights[0];
  const insights = data.price_insights || null;

  return {
    preco:        parseFloat(melhor.price),
    companhia:    vooInfo.airline || '—',
    numeroVoo:    vooInfo.flight_number || '—',
    partida:      vooInfo.departure_airport ? vooInfo.departure_airport.time : '—',
    chegada:      vooInfo.arrival_airport ? vooInfo.arrival_airport.time : '—',
    escalas:      melhor.flights.length - 1,
    nivelPreco:   insights ? insights.price_level : null,
    faixaPreco:   insights ? insights.typical_price_range : null,
    priceHistory: insights ? insights.price_history : null,
    fonte:        'serpapi',
  };
}

function buscarViaApify(voo) {
  const payload = {
    origin:        voo.origem,
    destination:   voo.destino,
    departureDate: voo.dataIda,
    returnDate:    voo.dataVolta || null,
    tripType:      voo.dataVolta ? 'round_trip' : 'one_way',
    currency:      'BRL',
    language:      'pt',
    maxResults:    5,
  };

  const resp = UrlFetchApp.fetch(
    'https://api.apify.com/v2/acts/johnvc~google-flights-data-scraper-flight-and-price-search/run-sync-get-dataset-items?token=' + APIFY_KEY_MU,
    {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    }
  );

  if (resp.getResponseCode() !== 200 && resp.getResponseCode() !== 201) {
    throw new Error('Apify HTTP ' + resp.getResponseCode());
  }

  const items = JSON.parse(resp.getContentText());
  if (!items || !items.length) return null;

  items.sort((a, b) => (a.price || 999999) - (b.price || 999999));
  const melhor = items[0];

  return {
    preco:        parseFloat(melhor.price || 0),
    companhia:    melhor.airline || '—',
    numeroVoo:    melhor.flightNumber || '—',
    partida:      melhor.departureTime || '—',
    chegada:      melhor.arrivalTime || '—',
    escalas:      melhor.stops || 0,
    nivelPreco:   null,
    faixaPreco:   null,
    priceHistory: null,
    fonte:        'apify',
  };
}

// ============================================================
//  ANÁLISE COM IA — usa token do usuário se disponível
// ============================================================

function analisarComIAMU(usuario, voo, precoAtual, historico, mercado) {
  try {
    const apiKey   = usuario.tokenIA || ANTHROPIC_KEY_MU;
    const provider = usuario.providerIA || 'anthropic';

    const precoInicial  = parseFloat(getPrecoMU(usuario.email, voo.id) || precoAtual);
    const precoMinimo   = Math.min(...historico.map(h => h.preco));
    const precoMaximo   = Math.max(...historico.map(h => h.preco));
    const precoMedio    = (historico.reduce((s, h) => s + h.preco, 0) / historico.length).toFixed(2);
    const variacaoTotal = (((precoAtual - precoInicial) / precoInicial) * 100).toFixed(1);

    const hoje          = new Date();
    const diasRestantes = Math.ceil((new Date(voo.dataIda) - hoje) / (1000 * 60 * 60 * 24));

    const altaTemporada  = [7, 12, 1];
    const baixaTemporada = [3, 4, 5, 8, 9, 10];
    const mesViagem      = new Date(voo.dataIda).getMonth() + 1;
    const sazonalidade   = altaTemporada.includes(mesViagem)  ? 'Alta temporada' :
                           baixaTemporada.includes(mesViagem) ? 'Baixa temporada' : 'Temporada intermediária';

    let contextoMercado = '';
    if (mercado && mercado.faixaPreco) {
      contextoMercado = `Faixa típica: R$ ${mercado.faixaPreco[0]}–${mercado.faixaPreco[1]} | Nível: ${traduzirNivel(mercado.nivelPreco) || '—'}`;
    }

    const DEFAULT_PROMPT =
      `Analise este voo como especialista em tarifas aéreas.\n` +
      `Rota: ${voo.origem} → ${voo.destino}\n` +
      `Ida: ${voo.dataIda}${voo.dataVolta ? ' | Volta: ' + voo.dataVolta : ''}\n` +
      `Preço atual: R$ ${precoAtual.toFixed(2)}\n` +
      `Variação desde início: ${variacaoTotal}%\n` +
      `Mín/Máx/Médio monitorado: R$ ${precoMinimo.toFixed(0)} / ${precoMaximo.toFixed(0)} / ${precoMedio}\n` +
      `Dias até a viagem: ${diasRestantes}\n` +
      `Sazonalidade: ${sazonalidade}\n` +
      (contextoMercado ? `Mercado: ${contextoMercado}\n` : '') +
      `\nResponda em EXATAMENTE 2 frases curtas em português:\n` +
      `1. Veredicto: "COMPRE AGORA", "AGUARDE" ou "PREÇO ESTÁVEL"\n` +
      `2. Justificativa em até 20 palavras.`;

    const prompt = usuario.promptIA
      ? usuario.promptIA
          .replace('{origem}',          voo.origem)
          .replace('{destino}',         voo.destino)
          .replace('{dataIda}',         voo.dataIda)
          .replace('{dataVoltaStr}',    voo.dataVolta ? '\nVolta: ' + voo.dataVolta : '')
          .replace('{precoAtual}',      precoAtual.toFixed(2))
          .replace('{variacao}',        variacaoTotal)
          .replace('{historicoPontos}', historico.slice(-5).map(h => 'R$' + h.preco.toFixed(0)).join(', '))
      : DEFAULT_PROMPT;

    let resposta = '';

    if (provider === 'anthropic') {
      const resp = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
        method: 'post',
        contentType: 'application/json',
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        payload: JSON.stringify({
          model:      'claude-haiku-4-5-20251001',
          max_tokens: 100,
          system:     'Você é especialista em passagens aéreas. Responda em exatamente 2 frases curtas. Sem markdown.',
          messages:   [{ role: 'user', content: prompt }],
        }),
        muteHttpExceptions: true,
      });
      const data = JSON.parse(resp.getContentText());
      resposta = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();

    } else if (provider === 'openai') {
      const resp = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', {
        method: 'post',
        contentType: 'application/json',
        headers: { 'Authorization': `Bearer ${apiKey}` },
        payload: JSON.stringify({
          model:      'gpt-4o-mini',
          max_tokens: 100,
          messages:   [{ role: 'user', content: prompt }],
        }),
        muteHttpExceptions: true,
      });
      const data = JSON.parse(resp.getContentText());
      resposta = data.choices?.[0]?.message?.content?.trim() || '';

    } else if (provider === 'google') {
      const resp = UrlFetchApp.fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'post',
          contentType: 'application/json',
          payload: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
          muteHttpExceptions: true,
        }
      );
      const data = JSON.parse(resp.getContentText());
      resposta = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    }

    return resposta ? `🤖 *Análise:*\n${resposta}` : '';
  } catch (err) {
    Logger.log(`Erro IA para ${usuario.email}: ${err.toString()}`);
    return '';
  }
}

// ============================================================
//  TELEGRAM — envia para chatId específico
// ============================================================

function enviarTelegramMU(chatId, mensagem) {
  try {
    const resp = UrlFetchApp.fetch('https://api.telegram.org/bot' + TELEGRAM_TOKEN_MU + '/sendMessage', {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ chat_id: chatId, text: mensagem, parse_mode: 'Markdown' }),
      muteHttpExceptions: true
    });
    const httpStatus = resp.getResponseCode();
    const data = JSON.parse(resp.getContentText());
    if (!data.ok) {
      Logger.log(`Telegram falhou | chatId: ${chatId} | HTTP: ${httpStatus} | erro: ${data.description} | código: ${data.error_code}`);
      return false;
    }
    Logger.log(`Telegram OK | chatId: ${chatId} | message_id: ${data.result && data.result.message_id}`);
    return true;
  } catch (err) {
    Logger.log(`Telegram exceção | chatId: ${chatId} | ${err.toString()}`);
    return false;
  }
}

// ============================================================
//  PUSH — via Worker nativo
// ============================================================

function enviarPushMU(email, titulo, mensagem, url) {
  try {
    const resp = UrlFetchApp.fetch(`${WORKER_URL_MU}/push/send`, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'X-Admin-Secret': ADMIN_SECRET_MU },
      payload: JSON.stringify({ email, title: titulo, message: mensagem, url: url || 'https://passagens.fetadeu.com.br' }),
      muteHttpExceptions: true,
    });
    const data = JSON.parse(resp.getContentText());
    Logger.log(`Push para ${email}: ok=${data.ok} status=${data.status || '—'} motivo=${data.motivo || '—'}`);
    if (data.ok) {
      auditLogMU(email, 'push_ok', titulo);
    } else {
      auditLogMU(email, 'push_falhou', data.motivo || `status ${data.status}`);
    }
  } catch (err) {
    Logger.log(`Erro push para ${email}: ${err.toString()}`);
    auditLogMU(email, 'push_falhou', err.toString());
  }
}

// ============================================================
//  E-MAIL — alerta ativado (primeira checagem)
// ============================================================

function enviarEmailAlertaAtivadoMU(usuario, voo, preco, nivelStr, faixaPreco) {
  const url = `https://www.google.com/travel/flights?q=Voos+${voo.origem}+${voo.destino}`;
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:0;background:#0D0D0D;color:#F0F0F0;border-radius:20px;overflow:hidden;">
      <div style="background:#111;padding:28px 28px 20px;border-bottom:1px solid #1C1C1C;">
        <div style="font-size:13px;color:#5A9E6F;font-weight:600;letter-spacing:0.5px;margin-bottom:6px;">✅ ALERTA ATIVADO</div>
        <div style="font-size:26px;font-weight:700;letter-spacing:-0.8px;">${voo.origem} → ${voo.destino}</div>
        <div style="font-size:12px;color:#444;margin-top:4px;">Ida: ${voo.dataIda}${voo.dataVolta ? ' · Volta: ' + voo.dataVolta : ''}</div>
      </div>
      <div style="padding:24px 28px;border-bottom:1px solid #1C1C1C;">
        <div style="font-size:13px;color:#999;margin-bottom:16px;">Seu alerta foi ativado. Vamos monitorar esta rota e te avisar quando o preço cair.</div>
        <div style="background:#0F1A12;border:1px solid #1A2E20;border-radius:10px;padding:16px;text-align:center;">
          <div style="font-size:11px;color:#2D5A38;margin-bottom:4px;">PREÇO BASE CAPTURADO</div>
          <div style="font-size:28px;font-weight:700;color:#F0F0F0;">R$ ${preco.toFixed(2)}</div>
        </div>
        ${nivelStr ? `<div style="margin-top:10px;font-size:12px;color:#666;">📊 ${nivelStr}</div>` : ''}
        ${faixaPreco ? `<div style="font-size:12px;color:#666;margin-top:4px;">📈 Faixa típica: R$ ${faixaPreco[0]} – R$ ${faixaPreco[1]}</div>` : ''}
      </div>
      <div style="padding:24px 28px;">
        <a href="${url}" style="display:block;background:#F0F0F0;color:#0D0D0D;text-decoration:none;border-radius:12px;padding:16px;text-align:center;font-size:15px;font-weight:700;">Ver voos no Google Flights →</a>
        <div style="text-align:center;margin-top:16px;font-size:11px;color:#333;">Monitor de Passagens · <a href="https://passagens.fetadeu.com.br" style="color:#444;">passagens.fetadeu.com.br</a></div>
      </div>
    </div>`;

  try {
    UrlFetchApp.fetch('https://api.resend.com/emails', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'Authorization': `Bearer ${RESEND_KEY_MU}` },
      payload: JSON.stringify({
        from:    'Monitor de Passagens <noreply@fetadeu.com.br>',
        to:      [usuario.email],
        subject: `✈️ Alerta ativo! ${voo.origem} → ${voo.destino} · Preço base R$ ${preco.toFixed(2)}`,
        html:    html,
      }),
      muteHttpExceptions: true,
    });
    Logger.log(`E-mail "alerta ativado" enviado para ${usuario.email}`);
    auditLogMU(usuario.email, 'email_ok', `Alerta ativado ${voo.origem}→${voo.destino}`);
  } catch (err) {
    Logger.log(`Erro e-mail ativado para ${usuario.email}: ${err.toString()}`);
    auditLogMU(usuario.email, 'email_falhou', `Alerta ativado ${voo.origem}→${voo.destino}: ${err.toString()}`);
  }
}

// ============================================================
//  E-MAIL — alerta de queda de preço via Resend
// ============================================================

function enviarEmailAlertaMU(usuario, voo, precoAtual, precoAnterior, economia, pct, nivelStr, faixaPreco, analise) {
  const url = `https://www.google.com/travel/flights?q=Voos+${voo.origem}+${voo.destino}+${(voo.dataIda||'').replace(/-/g,'')}${voo.dataVolta ? '+' + voo.dataVolta.replace(/-/g,'') : ''}`;

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:0;background:#0D0D0D;color:#F0F0F0;border-radius:20px;overflow:hidden;">
      <div style="background:#111;padding:28px 28px 20px;border-bottom:1px solid #1C1C1C;">
        <div style="font-size:13px;color:#5A9E6F;font-weight:600;letter-spacing:0.5px;margin-bottom:6px;">🚨 QUEDA DE PREÇO DETECTADA</div>
        <div style="font-size:26px;font-weight:700;letter-spacing:-0.8px;">${voo.origem} → ${voo.destino}</div>
        <div style="font-size:12px;color:#444;margin-top:4px;">Ida: ${voo.dataIda}${voo.dataVolta ? ' · Volta: ' + voo.dataVolta : ''}</div>
      </div>
      <div style="padding:24px 28px;border-bottom:1px solid #1C1C1C;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <div>
            <div style="font-size:11px;color:#444;margin-bottom:4px;">PREÇO ANTERIOR</div>
            <div style="font-size:18px;color:#666;text-decoration:line-through;">R$ ${precoAnterior.toFixed(2)}</div>
          </div>
          <div style="font-size:24px;color:#444;">→</div>
          <div style="text-align:right;">
            <div style="font-size:11px;color:#5A9E6F;margin-bottom:4px;">PREÇO ATUAL</div>
            <div style="font-size:28px;font-weight:700;color:#F0F0F0;">R$ ${precoAtual.toFixed(2)}</div>
          </div>
        </div>
        <div style="background:#0F1A12;border:1px solid #1A2E20;border-radius:10px;padding:12px 16px;text-align:center;">
          <span style="color:#5A9E6F;font-weight:600;font-size:14px;">💰 Economia de R$ ${economia} (${pct}% mais barato)</span>
        </div>
        ${nivelStr ? `<div style="margin-top:10px;font-size:12px;color:#666;">📊 ${nivelStr}</div>` : ''}
        ${faixaPreco ? `<div style="font-size:12px;color:#666;margin-top:4px;">📈 Faixa típica: R$ ${faixaPreco[0]} – R$ ${faixaPreco[1]}</div>` : ''}
      </div>
      ${analise ? `
      <div style="padding:20px 28px;border-bottom:1px solid #1C1C1C;background:#0F1A12;">
        <div style="font-size:10px;color:#2D5A38;letter-spacing:0.5px;margin-bottom:8px;">🤖 ANÁLISE DE IA</div>
        <div style="font-size:13px;color:#5A9E6F;line-height:1.6;">${analise.replace('🤖 *Análise:*\n', '')}</div>
      </div>` : ''}
      <div style="padding:24px 28px;">
        <a href="${url}" style="display:block;background:#F0F0F0;color:#0D0D0D;text-decoration:none;border-radius:12px;padding:16px;text-align:center;font-size:15px;font-weight:700;">Buscar no Google Flights →</a>
        <div style="text-align:center;margin-top:16px;font-size:11px;color:#333;">
          Monitor de Passagens · <a href="https://passagens.fetadeu.com.br" style="color:#444;">passagens.fetadeu.com.br</a>
        </div>
      </div>
    </div>`;

  try {
    UrlFetchApp.fetch('https://api.resend.com/emails', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'Authorization': `Bearer ${RESEND_KEY_MU}` },
      payload: JSON.stringify({
        from:    'Monitor de Passagens <noreply@fetadeu.com.br>',
        to:      [usuario.email],
        subject: `✈️ Queda de preço! ${voo.origem} → ${voo.destino} agora R$ ${precoAtual.toFixed(2)}`,
        html:    html,
      }),
      muteHttpExceptions: true,
    });
    Logger.log(`E-mail enviado para ${usuario.email}`);
    auditLogMU(usuario.email, 'email_ok', `Queda ${voo.origem}→${voo.destino} R$${precoAtual.toFixed(2)}`);
  } catch (err) {
    Logger.log(`Erro e-mail para ${usuario.email}: ${err.toString()}`);
    auditLogMU(usuario.email, 'email_falhou', `Queda ${voo.origem}→${voo.destino}: ${err.toString()}`);
  }
}

// ============================================================
//  MONITORAMENTO MULTIUSUÁRIO PRINCIPAL
// ============================================================

function monitorarPassagensMultiUser() {
  // ── Lock de execução: evita disparos paralelos da trigger ──────────────────
  // GAS pode executar a mesma trigger duas vezes ao mesmo tempo, causando
  // alertas duplicados e chamadas dobradas ao SerpAPI/Apify.
  // tryLock(0) = "pega o lock agora ou desiste imediatamente".
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(0)) {
    Logger.log('⏸️  Outra execução em andamento — abortando para evitar alertas duplicados.');
    return;
  }

  try {

  const usuarios = getUsuariosAtivos();
  if (!usuarios.length) { Logger.log('Nenhum usuário ativo.'); return; }
  Logger.log(`Monitorando ${usuarios.length} usuário(s)...`);

  usuarios.forEach(usuario => {
    const alertas = redisGetMU(`alertas:${usuario.email}`) || [];
    if (!alertas.length) { Logger.log(`Sem alertas para ${usuario.email}`); return; }

    Logger.log(`Processando ${alertas.length} alerta(s) de ${usuario.nome}`);

    alertas.forEach(voo => {
      try {
        const resultado = buscarMelhorVooMU(voo);
        if (!resultado) { Logger.log(`Sem resultado: ${voo.origem}→${voo.destino}`); return; }

        const { preco, companhia, numeroVoo, partida, chegada, escalas, nivelPreco, faixaPreco, priceHistory, fonte } = resultado;
        Logger.log(`[${usuario.nome}] ${voo.origem}→${voo.destino} R$${preco} via ${fonte}`);

        // ── Audit: preço checado ──────────────────────────────
        auditLogMU(usuario.email, 'preco_checado', `${voo.origem}→${voo.destino} R$${preco.toFixed(2)} via ${fonte}`);

        const precoAnterior = parseFloat(getPrecoMU(usuario.email, voo.id) || 0);
        const historico     = adicionarHistoricoMU(usuario.email, voo.id, preco);
        const nivelStr      = traduzirNivel(nivelPreco);

        // ── PRIMEIRA CHECAGEM ─────────────────────────────────
        if (precoAnterior === 0) {
          setPrecoMU(usuario.email, voo.id, preco);
          Logger.log(`[${usuario.nome}] ${voo.origem}→${voo.destino} | Primeira checagem: R$${preco}`);

          const msgAtivado =
            `✅ *Alerta ativado!*\n` +
            `${voo.origem} → ${voo.destino}\n` +
            `🏢 *${companhia}* · Voo ${numeroVoo}\n` +
            `🕐 ${partida} → ${chegada}${escalas > 0 ? ` (${escalas} escala)` : ' · direto'}\n` +
            `📅 Ida: ${voo.dataIda}${voo.dataVolta ? ' | Volta: ' + voo.dataVolta : ' _(somente ida)_'}\n` +
            `💰 Preço base: *R$ ${preco.toFixed(2)}*\n` +
            (nivelStr ? `📊 Nível: ${nivelStr}\n` : '') +
            (faixaPreco ? `📈 Faixa típica: R$ ${faixaPreco[0]} – R$ ${faixaPreco[1]}\n` : '') +
            `\n_Você será avisado quando o preço cair._`;

          if (usuario.chatId) {
            const tgOk = enviarTelegramMU(usuario.chatId, msgAtivado);
            auditLogMU(usuario.email, tgOk ? 'telegram_ok' : 'telegram_falhou',
              `Alerta ativado ${voo.origem}→${voo.destino}`);
            // Fallback: e-mail se Telegram falhou (usuário não deu /start)
            if (!tgOk) {
              enviarEmailAlertaAtivadoMU(usuario, voo, preco, nivelStr, faixaPreco);
            }
          } else {
            enviarEmailAlertaAtivadoMU(usuario, voo, preco, nivelStr, faixaPreco);
          }

          // Push para todos, independente de ter Telegram ou não
          enviarPushMU(usuario.email,
            `✅ Alerta ativo! ${voo.origem}→${voo.destino}`,
            `Monitorando a partir de R$ ${preco.toFixed(2)}. Te avisamos quando cair.`,
            'https://passagens.fetadeu.com.br'
          );

          return;
        }

        // ── QUEDA DE PREÇO ────────────────────────────────────
        const percentualMinimo = usuario.percentualMinimo || 0;
        const quedaPct = ((precoAnterior - preco) / precoAnterior) * 100;
        setPrecoMU(usuario.email, voo.id, preco);

        if (preco < precoAnterior && quedaPct >= percentualMinimo) {
          const economia = (precoAnterior - preco).toFixed(2);
          const pct      = quedaPct.toFixed(1);

          let analise = '';
          if (usuario.analiseIA) {
            const mercado = { nivelPreco, faixaPreco, priceHistory, companhia, numVoo: numeroVoo, partida, chegada, escalas };
            analise = analisarComIAMU(usuario, voo, preco, historico, mercado);
          }

          const pushUrl = 'https://passagens.fetadeu.com.br';
          const pushMsg = `${voo.origem}→${voo.destino} caiu ${pct}%! Agora R$ ${preco.toFixed(2)}`;

          const msgQueda =
            `🚨 *QUEDA DE PREÇO!*\n\n` +
            `✈️ *${voo.origem} → ${voo.destino}*\n` +
            `🏢 *${companhia}* · Voo ${numeroVoo}\n` +
            `🕐 ${partida} → ${chegada}${escalas > 0 ? ` (${escalas} escala)` : ' · direto'}\n` +
            `📅 Ida: ${voo.dataIda}${voo.dataVolta ? '\n🔄 Volta: ' + voo.dataVolta : ' _(somente ida)_'}\n\n` +
            `~~R$ ${precoAnterior.toFixed(2)}~~ → *R$ ${preco.toFixed(2)}*\n` +
            `💰 Economia de *R$ ${economia}* (${pct}% mais barato)\n` +
            (nivelStr ? `📊 Nível: ${nivelStr}\n` : '') +
            (faixaPreco ? `📈 Faixa típica: R$ ${faixaPreco[0]} – R$ ${faixaPreco[1]}\n` : '') +
            (analise ? `\n${analise}` : '');

          if (usuario.chatId) {
            const tgOk = enviarTelegramMU(usuario.chatId, msgQueda);
            auditLogMU(usuario.email, tgOk ? 'telegram_ok' : 'telegram_falhou',
              `Queda ${voo.origem}→${voo.destino} R$${precoAnterior.toFixed(2)}→R$${preco.toFixed(2)}`);
            // Fallback: e-mail se Telegram falhou
            if (!tgOk) {
              enviarEmailAlertaMU(usuario, voo, preco, precoAnterior, economia, pct, nivelStr, faixaPreco, analise);
            }
          } else {
            enviarEmailAlertaMU(usuario, voo, preco, precoAnterior, economia, pct, nivelStr, faixaPreco, analise);
          }

          // Push para todos, independente de ter Telegram ou não
          enviarPushMU(usuario.email,
            `✈️ Queda de preço! ${voo.origem}→${voo.destino}`,
            pushMsg,
            pushUrl
          );
        }

      } catch (err) {
        Logger.log(`Erro ao processar alerta de ${usuario.nome}: ${err.toString()}`);
      }
    });
  });

  Logger.log('Monitoramento multiusuário concluído.');

  } finally {
    lock.releaseLock();
  }
}

// ============================================================
//  CONFIGURAR PROPRIEDADES DO SCRIPT
//
//  NÃO coloque valores reais aqui — use a UI do Apps Script:
//  Extensões → Apps Script → Configurações do projeto
//                          → Propriedades do script → Adicionar propriedade
//
//  Propriedades necessárias:
//    UPSTASH_TOKEN  — token REST do Upstash Redis
//    ADMIN_SECRET   — mesmo valor do Dashboard do Cloudflare Worker
//    RESEND_KEY     — chave da API Resend (re_...)
//    SERPAPI_KEY    — chave SerpAPI (64 chars hex)
//    APIFY_KEY      — token Apify (apify_api_...)
//
//  Esta função só verifica se todas estão definidas.
// ============================================================

function verificarPropriedades() {
  const obrigatorias = ['UPSTASH_TOKEN', 'ADMIN_SECRET', 'RESEND_KEY', 'SERPAPI_KEY', 'TELEGRAM_TOKEN'];
  const opcionais    = ['APIFY_KEY', 'ANTHROPIC_KEY'];
  const props = PropertiesService.getScriptProperties();
  const faltando = obrigatorias.filter(k => !props.getProperty(k));
  if (faltando.length) {
    Logger.log('⚠️  Propriedades FALTANDO: ' + faltando.join(', '));
    Logger.log('Configure em: Extensões → Apps Script → Configurações do projeto → Propriedades do script');
  } else {
    Logger.log('✅ Todas as propriedades obrigatórias estão configuradas.');
  }
  opcionais.forEach(k => {
    Logger.log((props.getProperty(k) ? '✅' : '⚠️  (opcional ausente)') + ' ' + k);
  });
}

// ============================================================
//  TESTES
// ============================================================

function testeMultiUser() {
  const usuarios = getUsuariosAtivos();
  Logger.log(`Usuários ativos: ${usuarios.length}`);
  usuarios.forEach(u => {
    const alertas = redisGetMU(`alertas:${u.email}`) || [];
    Logger.log(`${u.nome} (${u.email}): ${alertas.length} alerta(s) | IA: ${u.analiseIA} | Token próprio: ${!!u.tokenIA} | Min%: ${u.percentualMinimo}`);
  });
}

function buscarVanessa() {
  const usuarios = getUsuariosAtivos();
  usuarios.forEach(u => Logger.log(u.nome + ' | ' + u.email + ' | chatId: ' + u.chatId));
}

function testeBusca() {
  const voo = { id: 'teste', origem: 'CGH', destino: 'GIG', dataIda: '2026-08-01', dataVolta: null };
  const resultado = buscarMelhorVooMU(voo);
  Logger.log('Resultado: ' + JSON.stringify(resultado));
}

function testeAlertaTelegramVanessa() {
  const usuario = redisGetMU('usuario:vanessametonini@gmail.com');

  if (!usuario) { Logger.log('Usuário não encontrado'); return; }
  if (!usuario.chatId) { Logger.log('Sem chatId cadastrado'); return; }

  Logger.log('Enviando para: ' + usuario.nome + ' | chatId: ' + usuario.chatId);

  const ok = enviarTelegramMU(usuario.chatId,
    '✅ *Teste de notificação!*\n' +
    'Se você recebeu essa mensagem, seu Telegram está configurado corretamente no Monitor de Passagens. ✈️'
  );

  Logger.log('Resultado: ' + (ok ? 'ENVIADO ✓' : 'FALHOU ✗ — provavelmente não deu /start no bot'));
}

function testePushWeb() {
  const email = 'felipe.akuma@gmail.com';
  enviarPushMU(
    email,
    '✈️ Teste de Push Web',
    'CGH→FLN caiu 10%! Agora R$ 560,00',
    'https://passagens.fetadeu.com.br'
  );
  Logger.log('Push enviado para ' + email);
}

// ── SIMULA QUEDA REAL para um usuário e alerta específicos ─────
//
//  Como usar:
//  1. Ajuste EMAIL_TESTE para o seu e-mail
//  2. Ajuste INDICE_ALERTA (0 = primeiro alerta cadastrado, 1 = segundo, etc.)
//  3. Ajuste QUEDA_PCT para o percentual de queda simulado (ex: 15 = 15%)
//  4. Execute a função — ela dispara Telegram, Push e (se chatId falhar) E-mail
//
function testeQuedaPrecoCompleto() {
  const EMAIL_TESTE    = 'felipe.akuma@gmail.com'; // troque se quiser testar outro usuário
  const INDICE_ALERTA  = 0;                        // qual alerta usar (0 = primeiro)
  const QUEDA_PCT      = 15;                       // % de queda simulada

  // 1. Busca usuário real no Redis
  const usuario = redisGetMU(`usuario:${EMAIL_TESTE}`);
  if (!usuario) { Logger.log('Usuário não encontrado: ' + EMAIL_TESTE); return; }

  // 2. Busca alertas reais do usuário
  const alertas = redisGetMU(`alertas:${EMAIL_TESTE}`) || [];
  if (!alertas.length) { Logger.log('Nenhum alerta cadastrado para ' + EMAIL_TESTE); return; }

  const voo = alertas[INDICE_ALERTA];
  if (!voo) { Logger.log('Índice de alerta inválido: ' + INDICE_ALERTA); return; }

  // 3. Pega preço atual do Redis (ou usa fallback)
  const precoAtualRedis = parseFloat(getPrecoMU(EMAIL_TESTE, voo.id) || 0);
  const precoAtual      = precoAtualRedis > 0 ? precoAtualRedis * (1 - QUEDA_PCT / 100) : 450.00;
  const precoAnterior   = precoAtualRedis > 0 ? precoAtualRedis : precoAtual * (1 + QUEDA_PCT / 100);
  const economia        = (precoAnterior - precoAtual).toFixed(2);
  const pct             = QUEDA_PCT.toFixed(1);

  Logger.log('=== TESTE DE QUEDA ===');
  Logger.log(`Usuário: ${usuario.nome} (${usuario.email})`);
  Logger.log(`Rota: ${voo.origem} → ${voo.destino} | Ida: ${voo.dataIda}${voo.dataVolta ? ' / Volta: ' + voo.dataVolta : ''}`);
  Logger.log(`Preço anterior: R$ ${precoAnterior.toFixed(2)} | Atual simulado: R$ ${precoAtual.toFixed(2)} | Queda: ${pct}%`);
  Logger.log(`chatId: ${usuario.chatId || '(sem chatId)'}`);

  const nivelStr  = '🟢 Baixo — ótimo momento para comprar';
  const faixaPreco = null;
  const analise    = ''; // sem IA no teste

  const msgQueda =
    `🚨 *QUEDA DE PREÇO!* _(simulação de teste)_\n\n` +
    `✈️ *${voo.origem} → ${voo.destino}*\n` +
    `📅 Ida: ${voo.dataIda}${voo.dataVolta ? '\n🔄 Volta: ' + voo.dataVolta : ' _(somente ida)_'}\n\n` +
    `~~R$ ${precoAnterior.toFixed(2)}~~ → *R$ ${precoAtual.toFixed(2)}*\n` +
    `💰 Economia de *R$ ${economia}* (${pct}% mais barato)\n` +
    `📊 Nível: ${nivelStr}\n` +
    `\n_Esta é uma notificação de teste — nenhum dado foi alterado._`;

  // 4. Telegram
  Logger.log('--- Canal: Telegram ---');
  if (usuario.chatId) {
    const tgOk = enviarTelegramMU(usuario.chatId, msgQueda);
    Logger.log('Resultado Telegram: ' + (tgOk ? '✓ ENVIADO' : '✗ FALHOU (ver detalhe acima)'));
    if (!tgOk) {
      Logger.log('--- Canal: E-mail (fallback) ---');
      enviarEmailAlertaMU(usuario, voo, precoAtual, precoAnterior, economia, pct, nivelStr, faixaPreco, analise);
    }
  } else {
    Logger.log('Sem chatId cadastrado — pulando Telegram');
    Logger.log('--- Canal: E-mail ---');
    enviarEmailAlertaMU(usuario, voo, precoAtual, precoAnterior, economia, pct, nivelStr, faixaPreco, analise);
  }

  // 5. Push web
  Logger.log('--- Canal: Push Web ---');
  enviarPushMU(
    usuario.email,
    `✈️ [TESTE] Queda de preço! ${voo.origem}→${voo.destino}`,
    `${voo.origem}→${voo.destino} caiu ${pct}%! Agora R$ ${precoAtual.toFixed(2)}`,
    'https://passagens.fetadeu.com.br'
  );

  Logger.log('=== FIM DO TESTE ===');
}

function testeEmailAlerta() {
  const usuarioTeste = {
    nome:   'Felipe Teste',
    email:  'felipe.akuma@gmail.com',
    chatId: null,
  };

  const voo = {
    origem:    'CGH',
    destino:   'FLN',
    dataIda:   '2026-08-01',
    dataVolta: null,
  };

  enviarEmailAlertaMU(
    usuarioTeste,
    voo,
    560.00,
    627.00,
    '67.00',
    '10.7',
    '🟢 Baixo — ótimo momento para comprar',
    [500, 900],
    'COMPRE AGORA. Preço abaixo da média histórica para esta rota.'
  );

  Logger.log('E-mail de teste enviado para ' + usuarioTeste.email);
}
