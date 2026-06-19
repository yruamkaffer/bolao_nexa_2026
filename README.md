# Bolão Copa do Mundo NEXA 2026

Projeto pronto para subir no Vercel Hobby, sem API paga.

## O que tem nesta versão

- `index.html`: painel do bolão.
- `api/bolao.js`: função serverless gratuita do Vercel Hobby para buscar CSVs da planilha e notícias do ge.
- `vercel.json`: configuração simples de cache/rotas.
- Atualização automática via CSV público do Google Sheets.
- Bloco de notícias da Copa buscado da página do ge.
- Artilharia e classificação de grupos no painel.

## Variáveis opcionais no Vercel

Configure em **Project Settings → Environment Variables**:

- `CSV_RANKING_URL` — CSV da aba Classificação.
- `CSV_JOGOS_URL` — CSV da aba Jogos.
- `CSV_PALPITES_URL` — CSV da aba Palpites.
- `CSV_CAMPEOES_URL` — CSV da aba Palpites de Campeão ou aba equivalente.
- `CSV_PONTUACAO_URL` — opcional; CSV com pontos por jogo/participante, caso essa pontuação esteja em aba separada. Também aceita `CSV_PONTOS_JOGOS_URL`.
- `CSV_DESEMPENHO_DIA_URL` — opcional; CSV da aba Desempenho por dia.
- `CSV_DESEMPENHO_RODADA_URL` — opcional; CSV da aba Desempenho por rodada.
- `GE_BRASIL_URL` — opcional. Padrão: `https://ge.globo.com/futebol/selecao-brasileira/`.
- `GE_COPA_URL` — opcional. Padrão: `https://ge.globo.com/futebol/copa-do-mundo/`.
- `GE_ARTILHARIA_URL` — opcional. Padrão: matéria de artilheiros do ge.

Sem as URLs extras, o ranking tenta usar o CSV principal enviado e o restante usa snapshot/fallback local.

## Publicar abas do Google Sheets como CSV

1. Abra a planilha.
2. Vá em **Arquivo → Compartilhar → Publicar na Web**.
3. No primeiro seletor, escolha a aba específica, não “Documento inteiro”.
4. No formato, escolha **Valores separados por vírgula (.csv)**.
5. Clique em **Publicar** e copie o link.
6. Repita para `Classificação`, `Jogos`, `Palpites`, `Campeões` e, se existirem, `Pontuação por jogo`, `Desempenho por dia` e `Desempenho por rodada`.
7. Cole cada link nas variáveis de ambiente do Vercel.

## Subir no GitHub pelo navegador

1. Crie um repositório novo no GitHub.
2. Extraia este `.zip` no seu computador.
3. No GitHub, use **Add file → Upload files**.
4. Arraste `index.html`, `vercel.json`, `README.md` e a pasta `api` inteira.
5. Clique em **Commit changes**.

## Publicar no Vercel

1. Entre no Vercel usando sua conta GitHub.
2. Clique em **Add New → Project**.
3. Importe o repositório do bolão.
4. Framework Preset: **Other**.
5. Build Command: deixe vazio.
6. Output Directory: deixe vazio.
7. Adicione as variáveis de ambiente se já tiver os CSVs das abas.
8. Clique em **Deploy**.

Depois disso, cada alteração enviada ao GitHub gera novo deploy automático. As mudanças na planilha não precisam de deploy: o site lê os CSVs publicados ao carregar.

## Observações importantes

- Não coloque senhas, tokens ou dados privados dentro da planilha publicada como CSV.
- O Google pode aplicar cache no CSV por alguns minutos.
- O Vercel também tem cache curto na função para evitar excesso de chamadas.
- Se o ge mudar a estrutura da página, o bloco de notícias pode cair para o fallback local até ajustarmos o parser.


## Ajustes finais

- O HTML destaca o último jogo com resultado preenchido antes da classificação.
- Os palpites dos jogos mostram cravada/acerto de resultado e pontos por participante. Quando houver coluna/aba de pontos publicada, o painel usa a pontuação oficial da planilha; quando não houver, mostra uma prévia simples e marcada como “prévia”.


## Ajustes desta versão

- O botão **Instalar como app** fica visível dentro da página.
- A logo da Copa 2026 aparece no cabeçalho.
- O ícone do site usa a imagem indicada.
- O desempenho por dia e por rodada fica em blocos empilhados, sem tabela lado a lado.
- A pontuação por jogo e por rodada usa dados oficiais quando você configurar `CSV_PONTUACAO_URL`, `CSV_DESEMPENHO_DIA_URL` e `CSV_DESEMPENHO_RODADA_URL` no Vercel. Sem esses CSVs, o site mostra que está aguardando a planilha oficial em vez de inventar pontuação.


## Central Ney

A seção Central Ney puxa notícias do ge por padrão em `https://ge.globo.com/atletas/neymar/`. Se quiser trocar a fonte, configure a variável opcional `GE_NEYMAR_URL` no Vercel.
