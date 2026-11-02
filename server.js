const express = require('express');
const { Pool } = require('pg');
const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.static(__dirname));
// Rota principal para carregar o Painel Visual da Fabi (index.html)
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// Configuração segura do Banco de Dados com suporte a SSL (essencial para o Render/Neon)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Teste preventivo de conexão com o Banco ao iniciar (apenas se não estiver em ambiente serverless estrito)
if (process.env.NODE_ENV !== 'production') {
  pool.connect((err, client, release) => {
    if (err) {
      console.error('❌ Erro ao conectar ao Banco de Dados:', err.stack);
    } else {
      console.log('✅ Banco de Dados conectado com sucesso!');
      release();
    }
  });
}

// Inicialização segura da IA (Gemini)
const ai = new GoogleGenAI();

// 1. Rota de Status e Teste Geral
app.get('/api/status', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({
      status: 'Online 🚀',
      sistema: 'Achadinhos Conecta - by Franklin Silva',
      banco_dados: 'Operacional',
      timestamp: result.rows[0].now
    });
  } catch (err) {
    console.error('Erro na rota raiz:', err.message);
    res.status(500).json({ status: 'Erro crítico', error: err.message });
  }
});

// 2. Rota para Listar os Produtos do "Filtro de Ouro" (Mais vendidos + Maior comissão)
app.get('/api/produtos', async (req, res) => {
  try {
    const query = 'SELECT * FROM achadinhos ORDER BY comissao_estimada DESC, criado_em DESC LIMIT 20';
    const produtos = await pool.query(query);
    res.json(produtos.rows);
  } catch (err) {
    console.error('Erro ao buscar produtos:', err.message);
    res.status(500).json({ error: 'Não foi possível carregar os produtos no momento.' });
  }
});

// 3. Rota para Cadastrar um Novo Achadinho (Shopee ou Mercado Livre)
app.post('/api/produtos', async (req, res) => {
  const { titulo, plataforma, categoria, preco, comissao_estimada, link_original, link_afiliado } = req.body;

  if (!titulo || !plataforma || !link_afiliado) {
    return res.status(400).json({ error: 'Campos obrigatórios faltando: titulo, plataforma e link_afiliado.' });
  }

  try {
    const query = `
      INSERT INTO achadinhos (titulo, plataforma, categoria, preco, comissao_estimada, link_original, link_afiliado)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;
    const values = [titulo, plataforma, categoria || 'Geral', preco || 0, comissao_estimada || 0, link_original || '', link_afiliado];
    const novoProduto = await pool.query(query, values);

    res.status(201).json({
      mensagem: 'Produto cadastrado com sucesso!',
      produto: novoProduto.rows[0]
    });
  } catch (err) {
    console.error('Erro ao salvar produto:', err.message);
    res.status(500).json({ error: 'Erro interno ao salvar o produto no banco de dados.' });
  }
});

// 4. Rota Inteligente: IA gera a Copy, Hashtags e já salva tratada
app.post('/api/gerar-copy/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Busca o produto no banco
    const produtoRes = await pool.query('SELECT * FROM achadinhos WHERE id = $1', [id]);
    if (produtoRes.rows.length === 0) {
      return res.status(404).json({ error: 'Produto não encontrado.' });
    }

    const produto = produtoRes.rows[0];

    // Prompt otimizado para o Gemini gerar a divulgação comercial
    const prompt = `Aja como um especialista em marketing digital de alta conversão para Shopee e Mercado Livre. 
    Crie uma chamada comercial curta, vendedora e atraente para o Instagram e WhatsApp com base nestes dados:
    - Produto: ${produto.titulo}
    - Preço: R$ ${produto.preco}
    - Plataforma: ${produto.plataforma}
    - Link de Afiliado: ${produto.link_afiliado}

    A resposta deve conter emojis chamativos, uma copy vendedora pronta para copiar e colar, e uma lista de hashtags otimizadas para o Explorar.`;

    const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: [
        {
            role: 'user',
            parts: [{ text: suaVariavelComPrompt }]
        }
    ]
});
    const copyGerada = response.text;

    // Atualiza o banco com a copy gerada pela IA
    await pool.query('UPDATE achadinhos SET copy_gerada = $1 WHERE id = $2', [copyGerada, id]);

    res.json({
      mensagem: 'Copy gerada e salva com sucesso pela IA!',
      id_produto: id,
      copyPronta: copyGerada
    });

  } catch (err) {
    console.error('Erro ao gerar copy com IA:', err.message);
    res.status(500).json({ error: 'Erro ao processar a inteligência artificial.' });
  }
});

// 5. Rota de Métricas: Registrar Clique no Link do Afiliado
app.post('/api/clique/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('UPDATE achadinhos SET cliques = cliques + 1 WHERE id = $1', [id]);
    res.json({ status: 'Clique computado com sucesso' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao registrar métrica de clique.' });
  }
});

// 6. Rota para Consolidar Relatórios Reais por Período
app.get('/api/relatorios', async (req, res) => {
  try {
    const query = `
      SELECT id, titulo, plataforma, preco, comissao_estimada, cliques, 
             (cliques * comissao_estimada * 0.05) as renda_gerada, 
             criado_em as data
      FROM achadinhos
      ORDER BY criado_em DESC;
    `;
    const resultado = await pool.query(query);
    res.json(resultado.rows);
  } catch (err) {
    console.error('Erro ao buscar relatórios:', err.message);
    res.status(500).json({ error: 'Erro ao carregar relatórios.' });
  }
});

// Se estiver a correr localmente no PC, mantém a porta a escutar
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Painel Achadinhos Conecta rodando localmente na porta ${PORT}`);
  });
}

// Essencial para o Vercel compilar e gerir a aplicação corretamente
module.exports = app;
