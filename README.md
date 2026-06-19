# Bolão NEXA 2026 - versão limpa

Versão recriada para priorizar atualização automática dos CSVs da planilha.

Arquivos:
- index.html
- api/bolao.js
- vercel.json

Esta versão remove o service worker/cache agressivo das versões anteriores. Ao abrir, ela também tenta desregistrar service workers antigos no navegador.

As URLs CSV padrão já estão no código. Variáveis do Vercel continuam opcionais se você quiser trocar algum link.
