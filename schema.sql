-- Criação da tabela principal de Achadinhos e Métricas
CREATE TABLE IF NOT EXISTS achadinhos (
    id SERIAL PRIMARY KEY,
    titulo VARCHAR(255) NOT NULL,
    plataforma VARCHAR(50) NOT NULL, -- 'Shopee' ou 'Mercado Livre'
    categoria VARCHAR(100),
    preco DECIMAL(10,2),
    comissao_estimada DECIMAL(5,2), -- Percentual ou valor da comissão
    link_original TEXT NOT NULL,
    link_afiliado TEXT NOT NULL,
    copy_gerada TEXT,
    hashtags TEXT,
    cliques INT DEFAULT 0,
    vendas_efetivas INT DEFAULT 0,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de logs para monitorar possíveis erros de varredura ou IA
CREATE TABLE IF NOT EXISTS logs_sistema (
    id SERIAL PRIMARY KEY,
    mensagem_erro TEXT,
    detalhes TEXT,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);