// @ts-nocheck
var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker/worker_fase14.js
var AEROPORTOS_VALIDOS = /* @__PURE__ */ new Set([
  // BRASIL
  "CGH",
  "GRU",
  "VCP",
  "FLN",
  "GIG",
  "SDU",
  "BSB",
  "SSA",
  "REC",
  "FOR",
  "BEL",
  "MAO",
  "CWB",
  "POA",
  "GYN",
  "VIX",
  "CNF",
  "IGU",
  "NVT",
  "NAT",
  "MCZ",
  "JPA",
  // ARGENTINA
  "EZE",
  "AEP",
  "COR",
  "MDZ",
  "BRC",
  "IGR",
  "USH",
  "SLA",
  // PORTUGAL
  "LIS",
  "OPO",
  "FAO",
  "FNC",
  "PDL"
]);
var validarAeroporto = /* @__PURE__ */ __name((code) => AEROPORTOS_VALIDOS.has((code || "").toUpperCase().trim()), "validarAeroporto");
async function gerarVapidJWT(publicKey, privateKeyB64, audience) {
  const header = { alg: "ES256", typ: "JWT" };
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1e3) + 43200,
    sub: "mailto:noreply@fetadeu.com.br"
  };
  const enc = /* @__PURE__ */ __name((obj) => btoa(JSON.stringify(obj)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_"), "enc");
  const unsigned = enc(header) + "." + enc(payload);
  const privateBytes = base64urlDecode(privateKeyB64);
  const pkcs8Header = new Uint8Array([
    48,
    65,
    2,
    1,
    0,
    48,
    19,
    6,
    7,
    42,
    134,
    72,
    206,
    61,
    2,
    1,
    6,
    8,
    42,
    134,
    72,
    206,
    61,
    3,
    1,
    7,
    4,
    39,
    48,
    37,
    2,
    1,
    1,
    4,
    32
  ]);
  const pkcs8Key = new Uint8Array(pkcs8Header.length + privateBytes.length);
  pkcs8Key.set(pkcs8Header);
  pkcs8Key.set(privateBytes, pkcs8Header.length);
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pkcs8Key,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(unsigned));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return unsigned + "." + sigB64;
}
__name(gerarVapidJWT, "gerarVapidJWT");
async function encriptarPayload(payload, p256dhB64, authB64) {
  const p256dh = base64urlDecode(p256dhB64);
  const auth = base64urlDecode(authB64);
  // @ts-ignore
  const serverKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );
  // @ts-ignore
  const serverPubBuf = /** @type {ArrayBuffer} */ (await crypto.subtle.exportKey("raw", serverKeyPair.publicKey));
  const serverPub = new Uint8Array(serverPubBuf);
  const clientKey = await crypto.subtle.importKey("raw", p256dh, { name: "ECDH", namedCurve: "P-256" }, false, []);
  // @ts-ignore
  const sharedBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: clientKey },
    // @ts-ignore
    serverKeyPair.privateKey,
    256
  );
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const enc = new TextEncoder();
  const prk = await hkdf(auth, sharedBits, enc.encode("Content-Encoding: auth"), 32);
  const cek = await hkdf(salt, prk, buildInfo("aesgcm", p256dh, serverPub), 16);
  const nonce = await hkdf(salt, prk, buildInfo("nonce", p256dh, serverPub), 12);
  const aesKey = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"]);
  const padded = new Uint8Array([0, 0, ...enc.encode(payload)]);
  const ciphertext = (
    /** @type {ArrayBuffer} */
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, padded)
  );
  const body = new Uint8Array(salt.length + 4 + 1 + serverPub.byteLength + new Uint8Array(ciphertext).byteLength);
  let offset = 0;
  body.set(salt, offset);
  offset += salt.length;
  body.set([0, 0, 16, 0], offset);
  offset += 4;
  body.set([serverPub.byteLength], offset);
  offset += 1;
  body.set(serverPub, offset);
  offset += serverPub.byteLength;
  body.set(new Uint8Array(ciphertext), offset);
  return body;
}
__name(encriptarPayload, "encriptarPayload");
function base64urlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
}
__name(base64urlDecode, "base64urlDecode");
function buildInfo(type, clientKey, serverKey) {
  const enc = new TextEncoder();
  const typeBytes = enc.encode(type);
  const info = new Uint8Array(18 + typeBytes.length + 1 + 5 + 1 + 2 + clientKey.length + 2 + serverKey.byteLength);
  let o = 0;
  const write = /* @__PURE__ */ __name((arr) => {
    info.set(arr instanceof Uint8Array ? arr : new Uint8Array(arr), o);
    o += arr.length || arr.byteLength;
  }, "write");
  write(enc.encode("Content-Encoding: "));
  write(typeBytes);
  write([0]);
  write(enc.encode("P-256"));
  write([0]);
  write([clientKey.length >> 8 & 255, clientKey.length & 255]);
  write(new Uint8Array(clientKey));
  write([serverKey.byteLength >> 8 & 255, serverKey.byteLength & 255]);
  write(new Uint8Array(serverKey));
  return info;
}
__name(buildInfo, "buildInfo");
async function hkdf(salt, ikm, info, length) {
  const saltKey = await crypto.subtle.importKey("raw", salt instanceof Uint8Array ? salt : new Uint8Array(salt), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const prk = await crypto.subtle.sign("HMAC", saltKey, ikm instanceof Uint8Array ? ikm : new Uint8Array(ikm));
  const prkKey = await crypto.subtle.importKey("raw", prk, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const t = await crypto.subtle.sign("HMAC", prkKey, new Uint8Array([...new Uint8Array(info), 1]));
  return new Uint8Array(t).slice(0, length);
}
__name(hkdf, "hkdf");
async function enviarPush(sub, payload, vapidPublic, vapidPrivate) {
  const jwt = await gerarVapidJWT(vapidPublic, vapidPrivate, new URL(sub.endpoint).origin);
  const resp = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "Authorization": `vapid t=${jwt},k=${vapidPublic}`,
      "TTL": "86400"
    },
    body: await encriptarPayload(
      JSON.stringify(payload),
      sub.keys.p256dh,
      sub.keys.auth
    )
  });
  return resp;
}
__name(enviarPush, "enviarPush");
var APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyQJBd0pL8Yxk42_EgRnaIebFczvxxPlXUSqRjWmRTuPYZDPBvUAQQj8TS36zPZep2Mog/exec";
var ALLOWED_ORIGIN = "https://passagens.fetadeu.com.br";
var worker_fase14_default = {
  async fetch(request, env) {
    const UPSTASH_URL = env.UPSTASH_REDIS_REST_URL;
    const UPSTASH_TOKEN = env.UPSTASH_REDIS_REST_TOKEN;
    const RESEND_KEY = env.RESEND_API_KEY;
    const ADMIN_SECRET = env.ADMIN_SECRET;
    const VAPID_PUBLIC = env.VAPID_PUBLIC_KEY;
    const VAPID_PRIVATE = env.VAPID_PRIVATE_KEY;
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Serve ads.txt diretamente para qualquer domínio (fetadeu.com.br ou passagens.fetadeu.com.br)
    if (path === "/ads.txt") {
      return new Response("google.com, pub-7941337038303308, DIRECT, f08c47fec0942fa0\n", {
        status: 200,
        headers: { "Content-Type": "text/plain" }
      });
    }

    const corsHeaders = {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Secret"
    };
    if (method === "OPTIONS") return new Response(null, { headers: corsHeaders });
    const json = /* @__PURE__ */ __name((data, status) => new Response(JSON.stringify(data), {
      status: status || 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    }), "json");
    const redisCmd = /* @__PURE__ */ __name(async (...args) => {
      const resp = await fetch(`${UPSTASH_URL}/${args.map(encodeURIComponent).join("/")}`, {
        headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
      });
      const data = await resp.json();
      return data.result;
    }, "redisCmd");
    const redisSet = /* @__PURE__ */ __name(async (key, value) => redisCmd("SET", key, JSON.stringify(value)), "redisSet");
    const redisSetEx = /* @__PURE__ */ __name(async (key, value, ttlSec) => redisCmd("SET", key, JSON.stringify(value), "EX", ttlSec), "redisSetEx");
    const redisGet = /* @__PURE__ */ __name(async (key) => {
      const r = await redisCmd("GET", key);
      return r ? JSON.parse(r) : null;
    }, "redisGet");
    const redisDel = /* @__PURE__ */ __name(async (key) => redisCmd("DEL", key), "redisDel");
    const redisKeys = /* @__PURE__ */ __name(async (pattern) => redisCmd("KEYS", pattern), "redisKeys");
    // Executa múltiplos comandos em 1 HTTP request via Upstash pipeline.
    // Retorna array com os .result de cada comando na mesma ordem.
    const redisPipeline = /* @__PURE__ */ __name(async (commands) => {
      const resp = await fetch(`${UPSTASH_URL}/pipeline`, {
        method: "POST",
        headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify(commands),
      });
      const data = await resp.json();
      return Array.isArray(data) ? data.map((d) => d.result) : [];
    }, "redisPipeline");

    // ── Índices SET — substituem KEYS scans em produção ──────────
    // Auto-migrável: se o índice está vazio (primeiro deploy), faz um KEYS
    // único para popular e depois nunca mais usa KEYS para usuários/convites.
    const getAllUsuarioEmails = /* @__PURE__ */ __name(async () => {
      const fromIndex = (await redisCmd("SMEMBERS", "idx:usuarios")) || [];
      if (fromIndex.length > 0) return fromIndex;
      // Migração única: popula o índice a partir de KEYS
      const keys = (await redisKeys("usuario:*")) || [];
      const emails = keys.map(k => k.replace("usuario:", ""));
      for (const e of emails) await redisCmd("SADD", "idx:usuarios", e);
      return emails;
    }, "getAllUsuarioEmails");

    const getAllConviteTokens = /* @__PURE__ */ __name(async () => {
      const fromIndex = (await redisCmd("SMEMBERS", "idx:convites")) || [];
      if (fromIndex.length > 0) return fromIndex;
      const keys = (await redisKeys("convite:*")) || [];
      const tokens = keys.map(k => k.replace("convite:", ""));
      for (const t of tokens) await redisCmd("SADD", "idx:convites", t);
      return tokens;
    }, "getAllConviteTokens");
    const redisIncr = /* @__PURE__ */ __name(async (key) => redisCmd("INCR", key), "redisIncr");
    const redisExpire = /* @__PURE__ */ __name(async (key, ttl) => redisCmd("EXPIRE", key, ttl), "redisExpire");
    const auditLog = /* @__PURE__ */ __name(async (email, tipo, detalhe) => {
      const data = new Date().toISOString().slice(0, 10);
      const key  = `audit:${email}:${data}`;
      const entry = JSON.stringify({ ts: new Date().toISOString(), tipo, detalhe: detalhe || "" });
      await redisCmd("RPUSH", key, entry);
      await redisCmd("LTRIM", key, "-200", "-1");  // mantém últimos 200 por dia
      await redisCmd("EXPIRE", key, 7776000);       // 90 dias
    }, "auditLog");
    const gerarOTP = /* @__PURE__ */ __name(() => {
      const a = new Uint32Array(1);
      crypto.getRandomValues(a);
      return String(1e5 + a[0] % 9e5);
    }, "gerarOTP");
    const gerarToken = /* @__PURE__ */ __name(() => {
      const a = new Uint8Array(48);
      crypto.getRandomValues(a);
      return Array.from(a).map((b) => b.toString(16).padStart(2, "0")).join("");
    }, "gerarToken");
    const requireAuth = /* @__PURE__ */ __name(async (req) => {
      const auth = req.headers.get("Authorization") || "";
      const token = auth.replace("Bearer ", "").trim();
      if (!token) return null;
      return await redisGet(`sessao:${token}`);
    }, "requireAuth");
    const requireAdmin = /* @__PURE__ */ __name(async (req) => {
      const sessao = await requireAuth(req);
      if (!sessao || !sessao.isAdmin) return null;
      return sessao;
    }, "requireAdmin");
    const requireAdminSecret = /* @__PURE__ */ __name((req) => (req.headers.get("X-Admin-Secret") || "") === ADMIN_SECRET, "requireAdminSecret");
    const checkRateLimit = /* @__PURE__ */ __name(async (key, maxReqs, windowSec) => {
      const count = await redisIncr(`rl:${key}`);
      if (count === 1) await redisExpire(`rl:${key}`, windowSec);
      return count > maxReqs;
    }, "checkRateLimit");
    if (path === "/" && method === "POST") {
      const sessao = await requireAuth(request);
      if (!sessao) return json({ erro: "N\xE3o autenticado" }, 401);
      try {
        const body = await request.text();
        const resp = await fetch(APPS_SCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain" }, body, redirect: "follow" });
        const data = await resp.text();
        return new Response(data, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (err) {
        return json({ erro: "Erro interno" }, 500);
      }
    }
    if (path === "/auth/request-otp" && method === "POST") {
      try {
        const ip = request.headers.get("CF-Connecting-IP") || "unknown";
        const limited = await checkRateLimit(`otp-req:${ip}`, 5, 900);
        if (limited) return json({ erro: "Muitas tentativas. Aguarde alguns minutos." }, 429);
        const body = await request.json();
        const email = (body.email || "").toLowerCase().trim();
        if (!email) return json({ erro: "E-mail obrigat\xF3rio" }, 400);
        const usuario = await redisGet(`usuario:${email}`);
        if (!usuario || !usuario.ativo) return json({ ok: true, mensagem: "Se este e-mail estiver cadastrado, voc\xEA receber\xE1 um c\xF3digo." });
        const otp = gerarOTP();
        await redisSetEx(`otp:${email}`, { otp, tentativas: 0 }, 600);
        await auditLog(email, "otp_solicitado", "Código de acesso solicitado");
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Monitor de Passagens <noreply@fetadeu.com.br>",
            to: [email],
            subject: "\u2708\uFE0F Seu c\xF3digo de acesso",
            html: `<div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:32px;"><h2>\u2708\uFE0F Monitor de Passagens</h2><p style="color:#666;margin-bottom:24px;">Ol\xE1, ${usuario.nome}! Use o c\xF3digo abaixo para entrar:</p><div style="background:#f5f5f5;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;"><span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#111;">${otp}</span></div><p style="color:#999;font-size:13px;">Expira em <strong>10 minutos</strong>. Se n\xE3o solicitou, ignore.</p></div>`
          })
        });
        return json({ ok: true, mensagem: "Se este e-mail estiver cadastrado, voc\xEA receber\xE1 um c\xF3digo." });
      } catch (err) {
        return json({ erro: "Erro interno" }, 500);
      }
    }
    if (path === "/auth/verify-otp" && method === "POST") {
      try {
        const ip = request.headers.get("CF-Connecting-IP") || "unknown";
        const limited = await checkRateLimit(`otp-ver:${ip}`, 10, 900);
        if (limited) return json({ erro: "Muitas tentativas. Aguarde alguns minutos." }, 429);
        const body = await request.json();
        const email = (body.email || "").toLowerCase().trim();
        const codigo = (body.codigo || "").trim();
        if (!email || !codigo) return json({ erro: "E-mail e c\xF3digo obrigat\xF3rios" }, 400);
        const otpData = await redisGet(`otp:${email}`);
        if (!otpData) return json({ erro: "C\xF3digo expirado ou inv\xE1lido." }, 401);
        if (otpData.tentativas >= 3) {
          await redisDel(`otp:${email}`);
          return json({ erro: "Muitas tentativas. Solicite um novo c\xF3digo." }, 401);
        }
        if (otpData.otp !== codigo) {
          otpData.tentativas++;
          await redisSetEx(`otp:${email}`, otpData, 600);
          return json({ erro: `C\xF3digo inv\xE1lido. ${3 - otpData.tentativas} tentativa(s) restante(s).` }, 401);
        }
        await redisDel(`otp:${email}`);
        const token = gerarToken();
        const usuario = await redisGet(`usuario:${email}`);
        await redisSetEx(`sessao:${token}`, { email, nome: usuario.nome, isAdmin: usuario.isAdmin }, 604800);
        await auditLog(email, "login", "Login realizado com sucesso");
        return json({ ok: true, token, usuario: { nome: usuario.nome, email: usuario.email, isAdmin: usuario.isAdmin, analiseIA: usuario.analiseIA } });
      } catch (err) {
        return json({ erro: "Erro interno" }, 500);
      }
    }
    if (path === "/auth/me" && method === "GET") {
      try {
        const sessao = await requireAuth(request);
        if (!sessao) return json({ erro: "N\xE3o autenticado" }, 401);
        const usuario = await redisGet(`usuario:${sessao.email}`);
        if (!usuario) return json({ erro: "N\xE3o encontrado" }, 404);
        return json({ nome: usuario.nome, email: usuario.email, isAdmin: usuario.isAdmin, analiseIA: usuario.analiseIA, buscaMilhas: usuario.buscaMilhas || false, percentualMinimo: usuario.percentualMinimo || 0, limiteAlertas: usuario.limiteAlertas ?? 10, tokenIA: usuario.tokenIA ? true : false, providerIA: usuario.providerIA || "anthropic" });
      } catch (err) {
        return json({ erro: "Erro interno" }, 500);
      }
    }
    if (path === "/auth/logout" && method === "POST") {
      try {
        const auth = request.headers.get("Authorization") || "";
        const token = auth.replace("Bearer ", "").trim();
        if (token) await redisDel(`sessao:${token}`);
        return json({ ok: true });
      } catch (err) {
        return json({ erro: "Erro interno" }, 500);
      }
    }
    if (path === "/auth/config" && method === "POST") {
      try {
        const sessao = await requireAuth(request);
        if (!sessao) return json({ erro: "N\xE3o autenticado" }, 401);
        const body = await request.json();
        const usuario = await redisGet(`usuario:${sessao.email}`);
        if (!usuario) return json({ erro: "Usu\xE1rio n\xE3o encontrado" }, 404);
        if (body.percentualMinimo !== void 0) usuario.percentualMinimo = Math.max(0, Math.min(100, parseInt(body.percentualMinimo) || 0));
        if (body.tokenIA !== void 0) usuario.tokenIA = body.tokenIA || "";
        if (body.providerIA !== void 0) usuario.providerIA = body.providerIA;
        if (body.promptIA !== void 0) usuario.promptIA = body.promptIA;
        await redisSet(`usuario:${sessao.email}`, usuario);
        return json({ ok: true, percentualMinimo: usuario.percentualMinimo });
      } catch (err) {
        return json({ erro: "Erro interno" }, 500);
      }
    }
    if (path === "/alertas" && method === "GET") {
      try {
        const sessao = await requireAuth(request);
        if (!sessao) return json({ erro: "N\xE3o autenticado" }, 401);
        // Rastrear acesso do usuário (bucket diário)
        const hoje = new Date().toISOString().slice(0, 10);
        await redisCmd("INCR", `acessos:${sessao.email}:${hoje}`);
        await redisCmd("SET", `ultimo_acesso:${sessao.email}`, new Date().toISOString());
        const alertas = await redisGet(`alertas:${sessao.email}`) || [];
        const result = await Promise.all(alertas.map(async (a, i) => {
          const precoAtual = parseFloat(await redisGet(`preco:${sessao.email}:${a.id}`) || 0);
          const historico = await redisGet(`historico:${sessao.email}:${a.id}`) || [];
          const precoInicial = historico.length > 0 ? historico[0].preco : precoAtual;
          const variacao = precoInicial > 0 ? parseFloat(((precoAtual - precoInicial) / precoInicial * 100).toFixed(1)) : 0;
          return { indice: i + 1, id: a.id, origem: a.origem, destino: a.destino, dataIda: a.dataIda, dataVolta: a.dataVolta, precoAtual, precoInicial, variacao, historico: historico.slice(-60) };
        }));
        return json(result);
      } catch (err) {
        return json({ erro: "Erro interno" }, 500);
      }
    }
    // ── BUSCA DE MILHAS (sob demanda, só para usuários com buscaMilhas=true) ──
    if (path === "/alertas/milhas" && method === "POST") {
      try {
        const sessao = await requireAuth(request);
        if (!sessao) return json({ erro: "N\xE3o autenticado" }, 401);

        const usuario = await redisGet(`usuario:${sessao.email}`);
        if (!usuario || !usuario.buscaMilhas) return json({ erro: "Busca de milhas n\xE3o habilitada para este usu\xE1rio" }, 403);

        const APIDEVOOS_KEY = env.APIDEVOOS_KEY;
        if (!APIDEVOOS_KEY) return json({ erro: "API de milhas n\xE3o configurada no servidor" }, 503);

        const body = await request.json();
        const { origem, destino, dataIda, dataVolta } = body;
        if (!origem || !destino || !dataIda) return json({ erro: "origem, destino e dataIda s\xE3o obrigat\xF3rios" }, 400);

        // Chama API de Voos via SSE stream — recebe resultados progressivamente
        // Documentação: https://apidevoos.dev/docs/api-reference/voos
        const payload = {
          type: dataVolta ? "round_trip" : "one_way",
          slices: [
            { origin: origem.toUpperCase(), destination: destino.toUpperCase(), departureDate: dataIda },
            ...(dataVolta ? [{ origin: destino.toUpperCase(), destination: origem.toUpperCase(), departureDate: dataVolta }] : []),
          ],
          passengers: [{ type: "adult", count: 1 }],
          cabinClass: "economy",
          searchType: "milhas",
        };

        const apiCtrl = new AbortController();
        const apiTimer = setTimeout(() => apiCtrl.abort(), 25000); // 25s wall timeout

        let apiResp;
        try {
          apiResp = await fetch("https://app.apidevoos.dev/api/v1/flights/stream", {
            method: "POST",
            headers: { "Authorization": `Bearer ${APIDEVOOS_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: apiCtrl.signal,
          });
        } catch (fetchErr) {
          clearTimeout(apiTimer);
          const isTimeout = fetchErr && fetchErr.name === "AbortError";
          console.error(`[milhas] ${isTimeout ? "timeout" : "fetch error"} stream para ${origem}-${destino}:`, fetchErr && fetchErr.message);
          return json({ erro: isTimeout ? "Consulta de milhas demorou demais — tente novamente." : "Erro de conexão com API de milhas." }, 504);
        }

        if (!apiResp.ok) {
          clearTimeout(apiTimer);
          const errBody = await apiResp.text().catch(() => "");
          console.error(`[milhas] stream HTTP ${apiResp.status} para ${origem}-${destino}:`, errBody.slice(0, 300));
          return json({ erro: `Erro na consulta de milhas (${apiResp.status})` }, 502);
        }

        // Lê o stream SSE e coleta grupos de voos
        const reader = apiResp.body.getReader();
        const decoder = new TextDecoder();
        let sseBuffer = "";
        const grupos = [];
        let done = false;

        try {
          while (!done) {
            const { value, done: streamDone } = await reader.read();
            if (streamDone) break;
            sseBuffer += decoder.decode(value, { stream: true });

            // Processa eventos SSE completos (separados por \n\n)
            const eventos = sseBuffer.split("\n\n");
            sseBuffer = eventos.pop(); // último pode estar incompleto

            for (const bloco of eventos) {
              let eventType = null;
              let eventData = null;
              for (const linha of bloco.split("\n")) {
                if (linha.startsWith("event: ")) eventType = linha.slice(7).trim();
                if (linha.startsWith("data: "))  eventData = linha.slice(6).trim();
              }
              if (!eventType || !eventData) continue;

              if (eventType === "flight-update") {
                try {
                  const d = JSON.parse(eventData);
                  const novos = [...(d.newGroups || []), ...(d.updatedGroups || [])];
                  grupos.push(...novos);
                } catch (_) {}
              } else if (eventType === "search-complete") {
                console.log(`[milhas] search-complete para ${origem}-${destino}, grupos:`, grupos.length);
                done = true;
                break;
              } else if (eventType === "search-error") {
                console.error(`[milhas] search-error para ${origem}-${destino}:`, eventData.slice(0, 200));
                done = true;
                break;
              }
            }
          }
        } finally {
          clearTimeout(apiTimer);
          reader.cancel().catch(() => {});
        }

        console.log(`[milhas] total grupos coletados para ${origem}-${destino}:`, grupos.length, "— amostra:", JSON.stringify(grupos[0] || {}).slice(0, 300));

        // Normaliza por programa de fidelidade
        const mapa = {};
        grupos.forEach(g => {
          // Estrutura esperada: group.options[] com loyalty info
          const opts = g.options || g.itineraries || g.flights || [g];
          opts.forEach(v => {
            const prog   = v.loyaltyProgram || v.program || v.programa || g.loyaltyProgram || g.program || "";
            const pontos = parseInt(v.miles || v.points || v.pontos || g.miles || g.points || 0);
            const taxas  = parseFloat(v.boardingFee || v.fees || v.taxa || g.boardingFee || g.fees || 0);
            if (prog && pontos > 0) {
              if (!mapa[prog] || pontos < mapa[prog].pontos) mapa[prog] = { programa: prog, pontos, taxas };
            }
          });
        });

        return json({ ok: true, programas: Object.values(mapa) });
      } catch (err) {
        console.error("[milhas] erro:", err && err.message ? err.message : String(err));
        return json({ erro: "Erro interno" }, 500);
      }
    }
    if (path === "/alertas" && method === "POST") {
      try {
        const sessao = await requireAuth(request);
        if (!sessao) return json({ erro: "N\xE3o autenticado" }, 401);
        const body = await request.json();
        const { origem, destino, dataIda, dataVolta } = body;
        if (!origem || !destino || !dataIda) return json({ erro: "origem, destino e dataIda s\xE3o obrigat\xF3rios" }, 400);
        if (!validarAeroporto(origem)) return json({ erro: `Aeroporto de origem inv\xE1lido: ${origem}` }, 400);
        if (!validarAeroporto(destino)) return json({ erro: `Aeroporto de destino inv\xE1lido: ${destino}` }, 400);
        if (origem.toUpperCase() === destino.toUpperCase()) return json({ erro: "Origem e destino n\xE3o podem ser iguais" }, 400);
        const usuario = await redisGet(`usuario:${sessao.email}`);
        const limite = usuario.isAdmin ? Infinity : usuario.limiteAlertas ?? 10;
        const alertas = await redisGet(`alertas:${sessao.email}`) || [];
        if (alertas.length >= limite) {
          return json({ erro: `Limite de ${limite} alerta(s) atingido. Solicite aumento ao administrador.` }, 400);
        }
        const id = Date.now();
        alertas.push({ id, origem: origem.toUpperCase(), destino: destino.toUpperCase(), dataIda, dataVolta: dataVolta || null });
        await redisSet(`alertas:${sessao.email}`, alertas);
        await auditLog(sessao.email, "alerta_criado", `${origem.toUpperCase()} → ${destino.toUpperCase()} | ida: ${dataIda}${dataVolta ? ' volta: ' + dataVolta : ''}`);
        return json({ ok: true, id });
      } catch (err) {
        return json({ erro: "Erro interno" }, 500);
      }
    }
    if (path.startsWith("/alertas/") && method === "DELETE") {
      try {
        const sessao = await requireAuth(request);
        if (!sessao) return json({ erro: "N\xE3o autenticado" }, 401);
        const indice = parseInt(path.split("/")[2]);
        const alertas = await redisGet(`alertas:${sessao.email}`) || [];
        if (indice < 1 || indice > alertas.length) return json({ erro: "Alerta n\xE3o encontrado" }, 404);
        const removido = alertas[indice - 1];
        await redisDel(`preco:${sessao.email}:${removido.id}`);
        await redisDel(`historico:${sessao.email}:${removido.id}`);
        alertas.splice(indice - 1, 1);
        await redisSet(`alertas:${sessao.email}`, alertas);
        await auditLog(sessao.email, "alerta_removido", `${removido.origem} → ${removido.destino} | ida: ${removido.dataIda}`);
        return json({ ok: true });
      } catch (err) {
        return json({ erro: "Erro interno" }, 500);
      }
    }
    if (path === "/admin/dashboard" && method === "GET") {
      try {
        const sessao = await requireAdmin(request);
        if (!sessao) return json({ erro: "Acesso negado" }, 403);

        const dashUrl = new URL(request.url);
        const ate = dashUrl.searchParams.get("ate") || new Date().toISOString().slice(0, 10);
        const de  = dashUrl.searchParams.get("de")  || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

        // Gera lista de datas no intervalo — evita KEYS scan O(N) no Redis
        const dates = [];
        let dCursor = new Date(de);
        const dFim  = new Date(ate);
        while (dCursor <= dFim) {
          dates.push(dCursor.toISOString().slice(0, 10));
          dCursor.setDate(dCursor.getDate() + 1);
        }

        const emails = await getAllUsuarioEmails();
        let totalUsuarios = 0, totalAtivos = 0, totalAlertas = 0, totalChecagens = 0;
        const rotasCount = {};
        const acessos = [];

        for (const email of emails) {
          const u = await redisGet(`usuario:${email}`);
          if (!u) continue;
          totalUsuarios++;
          if (u.ativo) totalAtivos++;

          const alertas = await redisGet(`alertas:${u.email}`) || [];
          totalAlertas += alertas.length;

          for (const a of alertas) {
            const rota = `${a.origem} → ${a.destino}`;
            rotasCount[rota] = (rotasCount[rota] || 0) + 1;
            const hist = await redisGet(`historico:${u.email}:${a.id}`) || [];
            totalChecagens += hist.length;
          }

          // Soma acessos e push via pipeline — 1 HTTP call para todos os dias + último acesso
          const pipelineCmds = [
            ...dates.map((d) => ["GET", `acessos:${email}:${d}`]),
            ...dates.map((d) => ["GET", `notif_push:${email}:${d}`]),
            ["GET", `ultimo_acesso:${email}`],
          ];
          const pipelineRes = await redisPipeline(pipelineCmds);
          const n = dates.length;
          let totalAcesso = 0, totalPush = 0;
          for (let i = 0; i < n; i++) totalAcesso += parseInt(pipelineRes[i]     || 0);
          for (let i = 0; i < n; i++) totalPush   += parseInt(pipelineRes[n + i] || 0);
          const ultimoAcesso = pipelineRes[2 * n] || null;
          acessos.push({ nome: u.nome, email: u.email, acessos: totalAcesso, push: totalPush, ultimoAcesso: ultimoAcesso || null });
        }

        const rotasTop = Object.entries(rotasCount)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([rota, count]) => ({ rota, count }));

        acessos.sort((a, b) => b.acessos - a.acessos);

        return json({ totalUsuarios, totalAtivos, totalAlertas, totalChecagens, rotasTop, acessos, de, ate });
      } catch (err) {
        console.error("[dashboard] erro:", err && err.message ? err.message : String(err));
        return json({ erro: "Erro interno" }, 500);
      }
    }
    if (path === "/admin/usuarios" && method === "GET") {
      try {
        const sessao = await requireAdmin(request);
        if (!sessao) return json({ erro: "Acesso negado" }, 403);
        const emails = await getAllUsuarioEmails();
        const usuarios = [];
        for (const email of emails) {
          const u = await redisGet(`usuario:${email}`);
          if (u) {
            const alertas = await redisGet(`alertas:${u.email}`) || [];
            usuarios.push({ ...u, totalAlertas: alertas.length });
          }
        }
        // Inclui convites pendentes (falha silenciosa para não quebrar a lista)
        try {
          const conviteTokens = await getAllConviteTokens();
          for (const token of conviteTokens) {
            try {
              const c = await redisGet(`convite:${token}`);
              if (c && c.email) {
                usuarios.push({ email: c.email, criadoEm: c.criadoEm, pendente: true, token });
              }
            } catch (_) { /* ignora key inválida */ }
          }
        } catch (_) { /* ignora falha no scan de convites */ }
        return json(usuarios);
      } catch (err) {
        return json({ erro: "Erro interno" }, 500);
      }
    }
    if (path === "/admin/usuarios" && method === "POST") {
      try {
        const sessao = await requireAdmin(request);
        if (!sessao) return json({ erro: "Acesso negado" }, 403);
        const body = await request.json();
        const { nome, email, chatId, analiseIA, percentualMinimo, limiteAlertas } = body;
        if (!nome || !email) return json({ erro: "nome e email s\xE3o obrigat\xF3rios" }, 400);
        const emailNorm = email.toLowerCase().trim();
        const existe = await redisGet(`usuario:${emailNorm}`);
        if (existe) return json({ erro: "E-mail j\xE1 cadastrado" }, 400);
        await redisSet(`usuario:${emailNorm}`, {
          nome,
          email: emailNorm,
          chatId,
          ativo: true,
          isAdmin: false,
          analiseIA: analiseIA === true,
          percentualMinimo: percentualMinimo || 0,
          limiteAlertas: limiteAlertas ?? 10,
          criadoEm: (/* @__PURE__ */ new Date()).toISOString()
        });
        await redisSet(`alertas:${emailNorm}`, []);
        await redisCmd("SADD", "idx:usuarios", emailNorm); // mantém índice
        return json({ ok: true, mensagem: `Usu\xE1rio ${nome} cadastrado com sucesso!` });
      } catch (err) {
        return json({ erro: "Erro interno" }, 500);
      }
    }
    if (path.startsWith("/admin/usuarios/") && path.endsWith("/config") && method === "POST") {
      try {
        const sessao = await requireAdmin(request);
        if (!sessao) return json({ erro: "Acesso negado" }, 403);
        const email = decodeURIComponent(path.split("/")[3]);
        const usuario = await redisGet(`usuario:${email}`);
        if (!usuario) return json({ erro: "Usu\xE1rio n\xE3o encontrado" }, 404);
        const body = await request.json();
        if (body.analiseIA    !== void 0) usuario.analiseIA    = body.analiseIA;
        if (body.buscaMilhas  !== void 0) usuario.buscaMilhas  = body.buscaMilhas;
        if (body.percentualMinimo !== void 0) usuario.percentualMinimo = body.percentualMinimo;
        if (body.ativo        !== void 0) usuario.ativo        = body.ativo;
        if (body.limiteAlertas !== void 0) usuario.limiteAlertas = body.limiteAlertas;
        if (body.chatId       !== void 0) usuario.chatId       = body.chatId;
        await redisSet(`usuario:${email}`, usuario);
        return json({ ok: true });
      } catch (err) {
        return json({ erro: "Erro interno" }, 500);
      }
    }
    if (path.startsWith("/admin/usuarios/") && path.endsWith("/alertas") && method === "GET") {
      try {
        const sessao = await requireAdmin(request);
        if (!sessao) return json({ erro: "Acesso negado" }, 403);
        const email = decodeURIComponent(path.split("/")[3]);
        const alertas = await redisGet(`alertas:${email}`) || [];
        const resultado = await Promise.all(alertas.map(async (a, i) => {
          const historico = await redisGet(`historico:${email}:${a.id}`) || [];
          const precoAtual = parseFloat(await redisGet(`preco:${email}:${a.id}`) || 0);
          const precoInicial = historico.length > 0 ? historico[0].preco : precoAtual;
          const variacao = precoInicial > 0 ? parseFloat(((precoAtual - precoInicial) / precoInicial * 100).toFixed(1)) : 0;
          return { indice: i + 1, id: a.id, origem: a.origem, destino: a.destino, dataIda: a.dataIda, dataVolta: a.dataVolta, precoAtual, precoInicial, variacao, historico: historico.slice(-60) };
        }));
        return json(resultado);
      } catch (err) {
        return json({ erro: "Erro interno" }, 500);
      }
    }
    if (path.startsWith("/admin/usuarios/") && path.endsWith("/audit") && method === "GET") {
      try {
        const sessao = await requireAdmin(request);
        if (!sessao) return json({ erro: "Acesso negado" }, 403);
        const email = decodeURIComponent(path.split("/")[3]);
        const hoje  = new Date().toISOString().slice(0, 10);
        const ate   = url.searchParams.get("ate") || hoje;
        const de    = url.searchParams.get("de")  || new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);

        // Gera lista de datas no intervalo
        const datas = [];
        let cursor = new Date(de);
        const fim  = new Date(ate);
        while (cursor <= fim) {
          datas.push(cursor.toISOString().slice(0, 10));
          cursor.setDate(cursor.getDate() + 1);
        }

        // Busca eventos de cada dia e achata em lista única
        const eventos = [];
        for (const data of datas) {
          const raw = await redisCmd("LRANGE", `audit:${email}:${data}`, "0", "-1");
          if (!raw || !Array.isArray(raw)) continue;
          for (const item of raw) {
            try { eventos.push(JSON.parse(item)); } catch (_) {}
          }
        }

        // Ordena por timestamp desc (mais recente primeiro)
        eventos.sort((a, b) => new Date(b.ts) - new Date(a.ts));

        return json({ email, de, ate, total: eventos.length, eventos });
      } catch (err) {
        return json({ erro: "Erro interno" }, 500);
      }
    }
    if (path.startsWith("/admin/usuarios/") && method === "DELETE") {
      try {
        const sessao = await requireAdmin(request);
        if (!sessao) return json({ erro: "Acesso negado" }, 403);
        const email = decodeURIComponent(path.split("/")[3]);
        if (email === sessao.email) return json({ erro: "Voc\xEA n\xE3o pode remover sua pr\xF3pria conta" }, 400);
        const alertas = await redisGet(`alertas:${email}`) || [];
        for (const a of alertas) {
          await redisDel(`preco:${email}:${a.id}`);
          await redisDel(`historico:${email}:${a.id}`);
        }
        await redisDel(`alertas:${email}`);
        await redisDel(`usuario:${email}`);
        await redisCmd("SREM", "idx:usuarios", email); // mantém índice
        return json({ ok: true });
      } catch (err) {
        return json({ erro: "Erro interno" }, 500);
      }
    }
    if (path.startsWith("/admin/convite/") && method === "DELETE") {
      try {
        const sessao = await requireAdmin(request);
        if (!sessao) return json({ erro: "Acesso negado" }, 403);
        const token = path.split("/")[3];
        if (!token) return json({ erro: "Token obrigatório" }, 400);
        const convite = await redisGet(`convite:${token}`);
        await redisDel(`convite:${token}`);
        await redisCmd("SREM", "idx:convites", token); // mantém índice
        await auditLog(sessao.email, "convite_cancelado", convite?.email || token);
        return json({ ok: true });
      } catch (err) {
        return json({ erro: "Erro interno" }, 500);
      }
    }
    if (path === "/admin/convite" && method === "POST") {
      try {
        const sessao = await requireAdmin(request);
        if (!sessao) return json({ erro: "Acesso negado" }, 403);
        const body = await request.json();
        const email = (body.email || "").toLowerCase().trim();
        if (!email) return json({ erro: "E-mail obrigat\xF3rio" }, 400);
        const existe = await redisGet(`usuario:${email}`);
        if (existe) return json({ erro: "E-mail j\xE1 cadastrado" }, 400);
        const token = gerarToken();
        await redisSetEx(`convite:${token}`, { email, criadoEm: (/* @__PURE__ */ new Date()).toISOString() }, 604800);
        await redisCmd("SADD", "idx:convites", token); // mantém índice
        const linkConvite = `https://passagens.fetadeu.com.br/?convite=${token}`;
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Monitor de Passagens <noreply@fetadeu.com.br>",
            to: [email],
            subject: "\u2708\uFE0F Voc\xEA foi convidado para o Monitor de Passagens!",
            html: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0D0D0D;">
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:40px 24px;">

  <!-- Header -->
  <div style="text-align:center;margin-bottom:32px;">
    <div style="font-size:40px;margin-bottom:12px;">\u2708\uFE0F</div>
    <h1 style="color:#F0F0F0;font-size:22px;font-weight:700;margin:0 0 8px;letter-spacing:-0.5px;">Voc\xEA foi convidado!</h1>
    <p style="color:#666;font-size:14px;margin:0;">Acesso exclusivo ao Monitor de Passagens</p>
  </div>

  <!-- CTA principal -->
  <div style="background:#141414;border:1px solid #1C1C1C;border-radius:16px;padding:24px;margin-bottom:20px;text-align:center;">
    <p style="color:#888;font-size:13px;margin:0 0 16px;">Seu link expira em <strong style="color:#F0F0F0;">7 dias</strong>.</p>
    <a href="${linkConvite}" style="display:block;background:#F0F0F0;color:#0D0D0D;text-decoration:none;border-radius:12px;padding:16px;font-size:15px;font-weight:700;">Criar minha conta \u2192</a>
  </div>

  <!-- Features -->
  <div style="background:#141414;border:1px solid #1C1C1C;border-radius:16px;padding:24px;margin-bottom:20px;">
    <p style="color:#F0F0F0;font-size:13px;font-weight:600;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.5px;">O que voc\xEA vai ter acesso</p>

    <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:14px;">
      <span style="font-size:18px;flex-shrink:0;">\u{1F3AF}</span>
      <div>
        <div style="color:#F0F0F0;font-size:14px;font-weight:600;margin-bottom:2px;">Alertas personalizados</div>
        <div style="color:#666;font-size:13px;">Configure rotas e datas que voc\xEA quer monitorar.</div>
      </div>
    </div>

    <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:14px;">
      <span style="font-size:18px;flex-shrink:0;">\u{1F504}</span>
      <div>
        <div style="color:#F0F0F0;font-size:14px;font-weight:600;margin-bottom:2px;">Monitoramento a cada 12 horas</div>
        <div style="color:#666;font-size:13px;">Pre\xE7os verificados automaticamente com hist\xF3rico completo.</div>
      </div>
    </div>

    <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:14px;">
      <span style="font-size:18px;flex-shrink:0;">\u{1F916}</span>
      <div>
        <div style="color:#F0F0F0;font-size:14px;font-weight:600;margin-bottom:2px;">An\xE1lise de IA com recomenda\xE7\xE3o</div>
        <div style="color:#666;font-size:13px;">Use o sistema ou conecte seu pr\xF3prio token com prompt personalizado.</div>
      </div>
    </div>

    <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:14px;">
      <span style="font-size:18px;flex-shrink:0;">\u2708\uFE0F</span>
      <div>
        <div style="color:#F0F0F0;font-size:14px;font-weight:600;margin-bottom:2px;">Alertas via Telegram</div>
        <div style="color:#666;font-size:13px;">Receba notifica\xE7\xF5es de queda diretamente no Telegram.</div>
      </div>
    </div>

    <div style="display:flex;align-items:flex-start;gap:12px;">
      <span style="font-size:18px;flex-shrink:0;">\u{1F514}</span>
      <div>
        <div style="color:#F0F0F0;font-size:14px;font-weight:600;margin-bottom:2px;">Push notifications web</div>
        <div style="color:#666;font-size:13px;">Instale como app e receba alertas mesmo com o browser fechado.</div>
      </div>
    </div>
  </div>

  <!-- Telegram setup -->
  <div style="background:#141414;border:1px solid #1C1C1C;border-radius:16px;padding:24px;margin-bottom:24px;">
    <p style="color:#F0F0F0;font-size:13px;font-weight:600;margin:0 0 14px;text-transform:uppercase;letter-spacing:0.5px;">\u{1F916} Como obter seu Telegram Chat ID</p>
    <div style="color:#666;font-size:13px;line-height:1.8;">
      <div style="margin-bottom:6px;">1. Abra o Telegram e busque <strong style="color:#999;">@userinfobot</strong></div>
      <div style="margin-bottom:6px;">2. Envie <strong style="color:#999;">/start</strong> para obter seu Chat ID</div>
      <div>3. Anote o n\xFAmero \u2014 voc\xEA vai precisar no cadastro</div>
    </div>
    <p style="color:#555;font-size:12px;margin:14px 0 0;">N\xE3o tem Telegram? Sem problema \u2014 voc\xEA receber\xE1 os alertas por e-mail.</p>
  </div>

  <!-- Footer -->
  <p style="color:#333;font-size:11px;text-align:center;margin:0;">Este convite \xE9 exclusivo para ${email}</p>

</div>
</body></html>`
          })
        });
        await auditLog(sessao.email, "convite_enviado", email);
        return json({ ok: true, mensagem: `Convite enviado para ${email}!` });
      } catch (err) {
        return json({ erro: "Erro interno" }, 500);
      }
    }
    if (path.startsWith("/convite/") && method === "GET") {
      try {
        const token = path.split("/")[2];
        const convite = await redisGet(`convite:${token}`);
        if (!convite) return json({ erro: "Convite inv\xE1lido ou expirado." }, 404);
        return json({ ok: true, email: convite.email });
      } catch (err) {
        return json({ erro: "Erro interno" }, 500);
      }
    }
    if (path.startsWith("/convite/") && method === "POST") {
      try {
        const token = path.split("/")[2];
        const convite = await redisGet(`convite:${token}`);
        if (!convite) return json({ erro: "Convite inv\xE1lido ou expirado." }, 404);
        const body = await request.json();
        const { nome, chatId } = body;
        if (!nome) return json({ erro: "Nome \xE9 obrigat\xF3rio" }, 400);
        const existe = await redisGet(`usuario:${convite.email}`);
        if (existe) return json({ erro: "Este e-mail j\xE1 foi cadastrado." }, 400);
        await redisSet(`usuario:${convite.email}`, {
          nome,
          email: convite.email,
          chatId,
          ativo: true,
          isAdmin: false,
          analiseIA: false,
          percentualMinimo: 25,
          limiteAlertas: 10,
          criadoEm: (/* @__PURE__ */ new Date()).toISOString()
        });
        await redisSet(`alertas:${convite.email}`, []);
        await redisDel(`convite:${token}`);
        await redisCmd("SADD", "idx:usuarios",  convite.email); // mantém índice
        await redisCmd("SREM", "idx:convites",  token);          // remove do índice de convites
        await auditLog(convite.email, "cadastro", nome);
        return json({ ok: true, mensagem: "Conta criada com sucesso! Fa\xE7a login para continuar." });
      } catch (err) {
        return json({ erro: "Erro interno" }, 500);
      }
    }
    if (path === "/redis/ping" && method === "GET") {
      if (!requireAdminSecret(request)) return json({ erro: "N\xE3o autorizado" }, 403);
      try {
        return json({ ok: true, result: await redisCmd("PING") });
      } catch (err) {
        return json({ ok: false, erro: "Erro interno" }, 500);
      }
    }
    if (path === "/redis/usuario" && method === "GET") {
      if (!requireAdminSecret(request)) return json({ erro: "N\xE3o autorizado" }, 403);
      try {
        const email = url.searchParams.get("email");
        if (!email) return json({ erro: "email obrigat\xF3rio" }, 400);
        const usuario = await redisGet(`usuario:${email}`);
        return usuario ? json(usuario) : json({ erro: "N\xE3o encontrado" }, 404);
      } catch (err) {
        return json({ erro: "Erro interno" }, 500);
      }
    }
    if (path === "/redis/alertas" && method === "GET") {
      if (!requireAdminSecret(request)) return json({ erro: "N\xE3o autorizado" }, 403);
      try {
        const email = url.searchParams.get("email");
        if (!email) return json({ erro: "email obrigat\xF3rio" }, 400);
        return json(await redisGet(`alertas:${email}`) || []);
      } catch (err) {
        return json({ erro: "Erro interno" }, 500);
      }
    }
    if (path === "/email/teste" && method === "POST") {
      if (!requireAdminSecret(request)) return json({ erro: "N\xE3o autorizado" }, 403);
      try {
        const { para } = await request.json();
        if (!para) return json({ erro: 'campo "para" obrigat\xF3rio' }, 400);
        const resp = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: "Monitor de Passagens <noreply@fetadeu.com.br>", to: [para], subject: "\u2708\uFE0F Teste", html: "<p>Teste \u2705</p>" })
        });
        const data = await resp.json();
        return resp.ok ? json({ ok: true, id: data.id }) : json({ ok: false }, 400);
      } catch (err) {
        return json({ erro: "Erro interno" }, 500);
      }
    }
    if (path === "/push/subscribe" && method === "POST") {
      try {
        const sessao = await requireAuth(request);
        if (!sessao) return json({ erro: "N\xE3o autenticado" }, 401);
        const body = await request.json();
        if (!body.endpoint || !body.keys) return json({ erro: "Subscription inv\xE1lida" }, 400);
        const subAtual = await redisGet(`push:${sessao.email}`);
        const nova = !subAtual || subAtual.endpoint !== body.endpoint;
        await redisSet(`push:${sessao.email}`, body);
        if (nova) await auditLog(sessao.email, "push_ativado", "Push notification ativado");
        return json({ ok: true });
      } catch (err) {
        return json({ erro: "Erro interno" }, 500);
      }
    }
    if (path === "/push/subscribe" && method === "DELETE") {
      try {
        const sessao = await requireAuth(request);
        if (!sessao) return json({ erro: "N\xE3o autenticado" }, 401);
        await redisDel(`push:${sessao.email}`);
        await auditLog(sessao.email, "push_desativado", "Push notification desativado");
        return json({ ok: true });
      } catch (err) {
        return json({ erro: "Erro interno" }, 500);
      }
    }
    if (path === "/push/vapidkey" && method === "GET") {
      return json({ publicKey: VAPID_PUBLIC });
    }
    if (path === "/push/test" && method === "POST") {
      try {
        const sessao = await requireAuth(request);
        if (!sessao) return json({ erro: "N\xE3o autenticado" }, 401);
        const sub = await redisGet(`push:${sessao.email}`);
        if (!sub) return json({ ok: false, motivo: "Nenhuma subscription encontrada. Ative as notifica\xE7\xF5es primeiro." });
        if (!sub.keys || !sub.keys.p256dh || !sub.keys.auth) return json({ ok: false, motivo: "Subscription corrompida. Desative e ative as notifica\xE7\xF5es novamente." });
        const resp = await enviarPush(sub, {
          title: "\u2708\uFE0F Monitor de Passagens",
          message: "Notifica\xE7\xF5es funcionando! Voc\xEA receber\xE1 alertas de queda de pre\xE7o.",
          url: "https://passagens.fetadeu.com.br"
        }, VAPID_PUBLIC, VAPID_PRIVATE);
        if (resp.status === 410 || resp.status === 404) {
          await redisDel(`push:${sessao.email}`);
          return json({ ok: false, motivo: "Subscription expirada. Por favor, ative as notifica\xE7\xF5es novamente." });
        }
        return json({ ok: resp.ok, status: resp.status });
      } catch (err) {
        return json({ erro: err.toString() }, 500);
      }
    }
    if (path === "/push/send" && method === "POST") {
      try {
        if (!requireAdminSecret(request)) return json({ erro: "N\xE3o autorizado" }, 403);
        const body = await request.json();
        const { email, title, message, url: pushUrl } = body;
        if (!email || !title) return json({ erro: "email e title s\xE3o obrigat\xF3rios" }, 400);
        const sub = await redisGet(`push:${email}`);
        if (!sub) return json({ ok: false, motivo: "Sem subscription" });
        if (!sub.keys || !sub.keys.p256dh || !sub.keys.auth) return json({ ok: false, motivo: "Subscription inv\xE1lida" });
        const resp = await enviarPush(sub, {
          title,
          message,
          url: pushUrl || "https://passagens.fetadeu.com.br"
        }, VAPID_PUBLIC, VAPID_PRIVATE);
        if (resp.status === 410 || resp.status === 404) {
          await redisDel(`push:${email}`);
          return json({ ok: false, motivo: "Subscription expirada, removida" });
        }
        if (resp.status === 400) {
          await redisDel(`push:${email}`);
          return json({ ok: false, motivo: "Subscription inválida (400), removida" });
        }
        const pushOk = resp.ok || resp.status === 201;
        if (pushOk) {
          const hoje2 = new Date().toISOString().slice(0, 10);
          await redisCmd("INCR", `notif_push:${email}:${hoje2}`);
        }
        return json({ ok: pushOk, status: resp.status });
      } catch (err) {
        return json({ erro: err.toString() }, 500);
      }
    }
    if (path === "/analisar" && method === "POST") {
      try {
        const sessao = await requireAuth(request);
        if (!sessao) return json({ erro: "N\xE3o autenticado" }, 401);
        const body = await request.json();
        const { id } = body;
        if (!id) return json({ erro: "id do alerta \xE9 obrigat\xF3rio" }, 400);
        const usuario = await redisGet(`usuario:${sessao.email}`);
        if (!usuario) return json({ erro: "Usu\xE1rio n\xE3o encontrado" }, 404);
        const token = usuario.tokenIA;
        const provider = usuario.providerIA || "anthropic";
        if (!token) return json({ erro: "Nenhum token de IA configurado. Configure seu token nas configura\xE7\xF5es." }, 400);
        const alertas = await redisGet(`alertas:${sessao.email}`) || [];
        const alerta = alertas.find((a) => String(a.id) === String(id));
        if (!alerta) return json({ erro: "Alerta n\xE3o encontrado" }, 404);
        const precoAtual = parseFloat(await redisGet(`preco:${sessao.email}:${id}`) || 0);
        const historico = await redisGet(`historico:${sessao.email}:${id}`) || [];
        const precoInicial = historico.length > 0 ? historico[0].preco : precoAtual;
        const variacao = precoInicial > 0 ? ((precoAtual - precoInicial) / precoInicial * 100).toFixed(1) : "0";
        const historicoPontos = historico.slice(-5).map((h) => `R$${h.preco.toFixed(0)} (${new Date(h.data).toLocaleDateString("pt-BR")})`).join(", ") || "sem hist\xF3rico";
        const DEFAULT_PROMPT = `Analise este voo como especialista em tarifas a\xE9reas.
Rota: {origem} \u2192 {destino}
Ida: {dataIda}{dataVoltaStr}
Pre\xE7o atual: R$ {precoAtual}
Varia\xE7\xE3o desde in\xEDcio do monitoramento: {variacao}%
Hist\xF3rico recente de pre\xE7os: {historicoPontos}

Responda EXATAMENTE em 2 frases curtas em portugu\xEAs:
1. Veredicto claro: "COMPRE AGORA", "AGUARDE" ou "PRE\xC7O EST\xC1VEL"
2. Justificativa objetiva em at\xE9 20 palavras explicando o motivo.`;
        const promptTemplate = usuario.promptIA || DEFAULT_PROMPT;
        const dataVoltaStr = alerta.dataVolta ? `
Volta: ${alerta.dataVolta}` : "";
        const prompt = promptTemplate.replace("{origem}", alerta.origem).replace("{destino}", alerta.destino).replace("{dataIda}", alerta.dataIda).replace("{dataVoltaStr}", dataVoltaStr).replace("{precoAtual}", precoAtual.toFixed(2)).replace("{variacao}", variacao).replace("{historicoPontos}", historicoPontos);
        let analise = "";
        if (provider === "anthropic") {
          const resp = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "x-api-key": token,
              "anthropic-version": "2023-06-01",
              "content-type": "application/json"
            },
            body: JSON.stringify({
              model: "claude-haiku-4-5",
              max_tokens: 150,
              messages: [{ role: "user", content: prompt }]
            })
          });
          if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            return json({ erro: "Erro na API Anthropic: " + (err.error?.message || resp.status) }, 502);
          }
          const data = await resp.json();
          analise = data.content?.[0]?.text || "";
        } else if (provider === "openai") {
          const resp = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              max_tokens: 150,
              messages: [{ role: "user", content: prompt }]
            })
          });
          if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            return json({ erro: "Erro na API OpenAI: " + (err.error?.message || resp.status) }, 502);
          }
          const data = await resp.json();
          analise = data.choices?.[0]?.message?.content || "";
        } else if (provider === "google") {
          const resp = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${token}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            }
          );
          if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            return json({ erro: "Erro na API Google: " + (err.error?.message || resp.status) }, 502);
          }
          const data = await resp.json();
          analise = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        } else {
          return json({ erro: `Provider desconhecido: ${provider}` }, 400);
        }
        await auditLog(sessao.email, "analise_ia", `${alerta.origem} → ${alerta.destino} via ${provider}`);
        return json({ ok: true, analise: analise.trim() });
      } catch (err) {
        return json({ erro: "Erro interno: " + err.toString() }, 500);
      }
    }
    return json({ erro: "Rota n\xE3o encontrada" }, 404);
  }
};
export {
  worker_fase14_default as default
};
//# sourceMappingURL=worker_fase14.js.map
