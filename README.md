# Bolão Copa do Mundo NEXA 2026

Projeto final completo para publicar na Vercel.

## Estrutura

```txt
index.html
api/bolao.js
vercel.json
manifest.webmanifest
service-worker.js
README.md
icons/
  icon-192.png
  icon-512.png
  maskable-512.png
```

## Como funciona

- O `index.html` consome `/api/bolao`.
- A API busca as abas públicas do Google Sheets via `gviz` em CSV.
- Os dados da planilha são sempre buscados com cache busting.
- A API retorna JSON consolidado para ranking, jogos, palpites, desempenho, campeões, grupos, estatísticas e notícias.
- O HTML não calcula a pontuação oficial dos palpites. Ele usa a coluna `Pontos` da aba `Palpites`.
- O service worker não cacheia `/api/bolao`, Google Sheets ou notícias.

## Planilha padrão

```txt
https://docs.google.com/spreadsheets/d/1DVLPCm8xLxRFsadiEW_89_H3GE9cv5YAyNY5CI3jrzM/edit
```

A API tenta buscar as abas pelos nomes:

- Classificação
- Jogos
- Palpites
- Desempenho por dia
- Desempenho por rodada
- Outras pontuações

## Publicar na Vercel

1. Envie todos os arquivos para um repositório GitHub.
2. Importe o repositório na Vercel.
3. Use configuração padrão, sem build command.
4. Publique.

Não precisa de `npm install`.

## Variáveis opcionais na Vercel

A versão funciona por nome de aba, mas você pode sobrescrever por GID ou URL:

```txt
SHEET_ID
SHEET_RANKING_GID
SHEET_JOGOS_GID
SHEET_PALPITES_GID
SHEET_DESEMPENHO_DIA_GID
SHEET_DESEMPENHO_RODADA_GID
SHEET_CAMPEOES_GID
```

Ou por nome:

```txt
SHEET_RANKING_NAME
SHEET_JOGOS_NAME
SHEET_PALPITES_NAME
SHEET_DESEMPENHO_DIA_NAME
SHEET_DESEMPENHO_RODADA_NAME
SHEET_CAMPEOES_NAME
```

Ou URL direta:

```txt
SHEET_RANKING_URL
SHEET_JOGOS_URL
SHEET_PALPITES_URL
SHEET_DESEMPENHO_DIA_URL
SHEET_DESEMPENHO_RODADA_URL
SHEET_CAMPEOES_URL
```

## Modo debug

Abra:

```txt
/?debug=1
```

O debug mostra:

- status da API;
- versão do app;
- quantidade de linhas carregadas por aba;
- quantidade de registros parseados;
- último jogo detectado;
- quantidade de palpites com pontos oficiais;
- erros por aba;
- origem dos dados;
- status do service worker.

## Regras importantes implementadas

- CSV robusto, sem `split(',')` ingênuo.
- Preserva colunas vazias.
- Suporta aspas, vírgulas dentro de aspas e quebras de linha.
- Reconhece `IA` somente quando a célula inteira normalizada é exatamente `ia`.
- Pontuação oficial vem da aba `Palpites`.
- Se uma aba falhar, o JSON continua saindo com erro registrado em `debug.erros`.
- Notícias são secundárias e não quebram o painel.
- O site nunca deve ficar em branco; erros são exibidos em tela.

## Teste local simples

A pasta não usa dependências. Para validar sintaxe:

```bash
node -c api/bolao.js
```

Para testar a API localmente, use a Vercel CLI:

```bash
npx vercel dev
```

Depois abra:

```txt
http://localhost:3000/?debug=1
```

## Observação sobre abas da planilha

Se a planilha pública mudar nomes de abas ou estruturas, ajuste as variáveis de ambiente de nome/GID. A API foi feita para aceitar variações de cabeçalho, mas depende da aba continuar pública.
