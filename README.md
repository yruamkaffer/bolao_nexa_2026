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
- `GE_COPA_URL` — opcional. Padrão: `https://ge.globo.com/futebol/copa-do-mundo/`.
- `GE_ARTILHARIA_URL` — opcional. Padrão: matéria de artilheiros do ge.

Sem as URLs extras, o ranking tenta usar o CSV principal enviado e o restante usa snapshot/fallback local.

## Publicar abas do Google Sheets como CSV

1. Abra a planilha.
2. Vá em **Arquivo → Compartilhar → Publicar na Web**.
3. No primeiro seletor, escolha a aba específica, não “Documento inteiro”.
4. No formato, escolha **Valores separados por vírgula (.csv)**.
5. Clique em **Publicar** e copie o link.
6. Repita para `Classificação`, `Jogos`, `Palpites` e `Campeões`.
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
