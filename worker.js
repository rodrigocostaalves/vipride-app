/* ============================================================
   VipRide Orlando — API (Cloudflare Worker + D1)

   Variáveis necessárias no painel do Cloudflare:
     - Binding D1        : DB
     - Secret            : ADMIN_TOKEN   (senha do dashboard.html)
     - Variável (texto)  : ALLOWED_ORIGINS
   ============================================================ */

const ORIGENS_PADRAO = ['https://rodrigocostaalves.github.io'];

function origensPermitidas(env) {
  if (env.ALLOWED_ORIGINS) {
    return env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean);
  }
  return ORIGENS_PADRAO;
}

function cabecalhosCors(request, env) {
  const origem = request.headers.get('Origin') || '';
  const lista = origensPermitidas(env);
  const liberada = lista.includes(origem) ? origem : lista[0];
  return {
    'Access-Control-Allow-Origin': liberada,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function json(dados, status, headers) {
  return new Response(JSON.stringify(dados), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' }
  });
}

function tokenConfere(recebido, esperado) {
  if (!esperado || !recebido) return false;
  if (recebido.length !== esperado.length) return false;
  let diff = 0;
  for (let i = 0; i < recebido.length; i++) diff |= recebido.charCodeAt(i) ^ esperado.charCodeAt(i);
  return diff === 0;
}

function ehAdmin(request, env) {
  return tokenConfere(request.headers.get('X-Admin-Token') || '', env.ADMIN_TOKEN || '');
}

const SQL_CRIAR_TABELA = `
  CREATE TABLE IF NOT EXISTS reservas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo TEXT NOT NULL,
    cliente TEXT NOT NULL,
    email TEXT NOT NULL,
    telefone TEXT NOT NULL,
    pais TEXT,
    servico TEXT NOT NULL,
    veiculo TEXT NOT NULL,
    data_servico TEXT NOT NULL,
    periodo TEXT NOT NULL,
    origem TEXT,
    destino TEXT,
    valor TEXT NOT NULL,
    status TEXT DEFAULT 'novo',
    voo TEXT,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`;

// Colunas acrescentadas depois da primeira versão. O ALTER falha se a coluna
// já existir — por isso cada um roda isolado e o erro é ignorado.
const COLUNAS_NOVAS = [
  'ALTER TABLE reservas ADD COLUMN motorista_nome TEXT',
  'ALTER TABLE reservas ADD COLUMN motorista_telefone TEXT',
  'ALTER TABLE reservas ADD COLUMN motorista_obs TEXT',
  'ALTER TABLE reservas ADD COLUMN veiculo_modelo TEXT',
  'ALTER TABLE reservas ADD COLUMN veiculo_placa TEXT',
  'ALTER TABLE reservas ADD COLUMN veiculo_cor TEXT',
  'ALTER TABLE reservas ADD COLUMN atualizado_em DATETIME'
];

let tabelaPronta = false;
async function garantirTabela(env) {
  if (tabelaPronta) return;
  await env.DB.prepare(SQL_CRIAR_TABELA).run();
  for (const sql of COLUNAS_NOVAS) {
    try { await env.DB.prepare(sql).run(); } catch (e) { /* coluna já existe */ }
  }
  tabelaPronta = true;
}

function gerarCodigo() {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return 'VR-' + String((buf[0] % 900000) + 100000);
}

function texto(valor, max) {
  if (valor === undefined || valor === null) return null;
  const s = String(valor).trim();
  if (!s) return null;
  return s.slice(0, max);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default {
  async fetch(request, env) {
    const headers = cabecalhosCors(request, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }

    if (!env.DB) {
      return json({ success: false, error: 'Banco de dados não configurado (binding DB ausente).' }, 500, headers);
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    /* ---------- Diagnóstico ---------- */
    if (path === '/debug') {
      if (!ehAdmin(request, env)) return json({ error: 'Não autorizado' }, 401, headers);
      try {
        await env.DB.prepare('SELECT 1').run();
        return json({ status: 'OK', message: 'Banco de dados conectado.' }, 200, headers);
      } catch (error) {
        return json({ status: 'ERRO', message: error.message }, 500, headers);
      }
    }

    /* ---------- Consulta pública de uma reserva ---------- */
    // Exige código + e-mail juntos: sem isso daria para varrer todas as reservas.
    if (path === '/consulta' && request.method === 'GET') {
      try {
        const codigo = texto(url.searchParams.get('codigo'), 20);
        const email = texto(url.searchParams.get('email'), 160);
        if (!codigo || !email) return json({ error: 'Informe código e e-mail.' }, 400, headers);

        await garantirTabela(env);
        const r = await env.DB.prepare(`
          SELECT codigo, cliente, servico, veiculo, data_servico, periodo, origem, destino,
                 valor, status, voo, criado_em,
                 motorista_nome, motorista_telefone, motorista_obs,
                 veiculo_modelo, veiculo_placa, veiculo_cor
          FROM reservas WHERE codigo = ? AND lower(email) = lower(?)
        `).bind(codigo, email).first();

        if (!r) return json({ error: 'nao_encontrada' }, 404, headers);
        return json(r, 200, headers);
      } catch (error) {
        return json({ error: 'Erro na consulta.' }, 500, headers);
      }
    }

    /* ---------- Criar reserva (público) ---------- */
    if (path === '/reservas' && request.method === 'POST') {
      try {
        let body;
        try { body = await request.json(); }
        catch { return json({ success: false, error: 'JSON inválido.' }, 400, headers); }

        const cliente  = texto(body.cliente, 120);
        const email    = texto(body.email, 160);
        const telefone = texto(body.telefone, 40);
        const servico  = texto(body.servico, 60);
        const veiculo  = texto(body.veiculo, 60);
        const dataServ = texto(body.data_servico, 10);
        const periodo  = texto(body.periodo, 60);
        const valor    = texto(body.valor, 20);

        const faltando = [];
        if (!cliente || cliente.length < 3) faltando.push('cliente');
        if (!email || !EMAIL_RE.test(email)) faltando.push('email');
        if (!telefone || telefone.replace(/\D/g, '').length < 8) faltando.push('telefone');
        if (!servico) faltando.push('servico');
        if (!veiculo) faltando.push('veiculo');
        if (!dataServ || !/^\d{4}-\d{2}-\d{2}$/.test(dataServ)) faltando.push('data_servico');
        if (!periodo) faltando.push('periodo');
        if (!valor) faltando.push('valor');
        if (faltando.length) {
          return json({ success: false, error: 'Campos inválidos: ' + faltando.join(', ') }, 400, headers);
        }

        await garantirTabela(env);
        const codigo = gerarCodigo();

        await env.DB.prepare(`
          INSERT INTO reservas
          (codigo, cliente, email, telefone, pais, servico, veiculo, data_servico, periodo,
           origem, destino, valor, status, voo)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          codigo, cliente, email, telefone, texto(body.pais, 60),
          servico, veiculo, dataServ, periodo,
          texto(body.origem, 200), texto(body.destino, 200),
          valor, 'novo', texto(body.voo, 20)
        ).run();

        return json({ success: true, codigo }, 201, headers);
      } catch (error) {
        return json({ success: false, error: 'Erro ao salvar a reserva.' }, 500, headers);
      }
    }

    /* ---------- Listar reservas (somente admin) ---------- */
    if (path === '/reservas' && request.method === 'GET') {
      if (!ehAdmin(request, env)) return json({ error: 'Não autorizado' }, 401, headers);
      try {
        await garantirTabela(env);
        const { results } = await env.DB.prepare(
          `SELECT * FROM reservas ORDER BY criado_em DESC LIMIT 500`
        ).all();
        return json(results, 200, headers);
      } catch (error) {
        return json({ success: false, error: 'Erro ao listar reservas.' }, 500, headers);
      }
    }

    /* ---------- Atualizar reserva (somente admin) ---------- */
    if (path.startsWith('/reservas/') && request.method === 'PATCH') {
      if (!ehAdmin(request, env)) return json({ error: 'Não autorizado' }, 401, headers);
      try {
        const id = Number(path.split('/')[2]);
        if (!Number.isInteger(id) || id <= 0) {
          return json({ success: false, error: 'ID inválido.' }, 400, headers);
        }

        let body;
        try { body = await request.json(); }
        catch { return json({ success: false, error: 'JSON inválido.' }, 400, headers); }

        await garantirTabela(env);

        const campos = [];
        const valores = [];

        if (body.status !== undefined) {
          const permitidos = ['novo', 'confirmado', 'cancelado'];
          if (!permitidos.includes(body.status)) {
            return json({ success: false, error: 'Status inválido.' }, 400, headers);
          }
          campos.push('status = ?'); valores.push(body.status);
        }

        const mapa = {
          motorista_nome: 120,
          motorista_telefone: 40,
          motorista_obs: 300,
          veiculo_modelo: 80,
          veiculo_placa: 20,
          veiculo_cor: 40
        };
        for (const [campo, max] of Object.entries(mapa)) {
          if (body[campo] !== undefined) {
            campos.push(`${campo} = ?`);
            valores.push(texto(body[campo], max));
          }
        }

        if (!campos.length) {
          return json({ success: false, error: 'Nada para atualizar.' }, 400, headers);
        }

        campos.push('atualizado_em = CURRENT_TIMESTAMP');
        valores.push(id);

        const r = await env.DB.prepare(
          `UPDATE reservas SET ${campos.join(', ')} WHERE id = ?`
        ).bind(...valores).run();

        if (r.meta && r.meta.changes === 0) {
          return json({ success: false, error: 'Reserva não encontrada.' }, 404, headers);
        }
        return json({ success: true }, 200, headers);
      } catch (error) {
        return json({ success: false, error: 'Erro ao atualizar a reserva.' }, 500, headers);
      }
    }

    return json({ error: 'Rota não encontrada' }, 404, headers);
  }
};
