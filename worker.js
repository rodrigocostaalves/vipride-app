export default {
  async fetch(request, env) {
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // 1. TESTE DE CONEXÃO (Pra ver se o DB existe)
    if (path === '/debug') {
      try {
        if (!env.DB) {
          return new Response(JSON.stringify({ 
            status: "ERRO", 
            message: "A variável DB não foi encontrada! O Binding não funcionou." 
          }), { headers: { ...headers, 'Content-Type': 'application/json' } });
        }

        // Tentamos rodar um comando simples no banco
        await env.DB.prepare("SELECT 1").run();
        return new Response(JSON.stringify({ 
          status: "OK", 
          message: "Banco de dados conectado com sucesso!" 
        }), { headers: { ...headers, 'Content-Type': 'application/json' } });

      } catch (error) {
        return new Response(JSON.stringify({ 
          status: "ERRO", 
          message: error.message 
        }), { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } });
      }
    }

    // ROTA: Salvar uma nova reserva (POST)
    if (path === '/reservas' && request.method === 'POST') {
      try {
        const body = await request.json();
        const codigo = 'VR-' + Math.floor(1000 + Math.random() * 8999);

        // Se a tabela não existir, cria ela na hora
        await env.DB.prepare(`
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
        `).run();

        await env.DB.prepare(`
          INSERT INTO reservas 
          (codigo, cliente, email, telefone, pais, servico, veiculo, data_servico, periodo, origem, destino, valor, status, voo)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          codigo,
          body.cliente,
          body.email,
          body.telefone,
          body.pais || null,
          body.servico,
          body.veiculo,
          body.data_servico,
          body.periodo,
          body.origem || null,
          body.destino || null,
          body.valor,
          'novo',
          body.voo || null
        ).run();

        return new Response(JSON.stringify({ success: true, codigo }), {
          headers: { ...headers, 'Content-Type': 'application/json' }
        });

      } catch (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
          status: 500,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
    }

    // ROTA: Listar todas as reservas (GET)
    if (path === '/reservas' && request.method === 'GET') {
      try {
        // Cria a tabela se não existir (garantia)
        await env.DB.prepare(`
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
        `).run();

        const { results } = await env.DB.prepare(`
          SELECT * FROM reservas ORDER BY criado_em DESC
        `).all();

        return new Response(JSON.stringify(results), {
          headers: { ...headers, 'Content-Type': 'application/json' }
        });

      } catch (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
          status: 500,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
    }

    // ROTA: Atualizar status (PATCH)
    if (path.startsWith('/reservas/') && request.method === 'PATCH') {
      try {
        const id = path.split('/')[2];
        const body = await request.json();
        await env.DB.prepare(`UPDATE reservas SET status = ? WHERE id = ?`).bind(body.status, id).run();
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
          status: 500,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response('Not Found', { status: 404, headers });
  }
};