# Bazar MM

App único (`index.html`) de catálogo + caixa para o bazar "MM", com
pagamento real via Mercado Pago (Pix, débito, crédito em até 3x) e dados
guardados no Supabase.

## Estrutura

```
index.html              → o app (catálogo público + caixa com PIN)
api/criar-pagamento.js  → cria a cobrança no Mercado Pago (Vercel Function)
api/webhook-mp.js       → confirma o pagamento e libera o pedido (Vercel Function)
supabase-setup.sql      → script para criar a tabela no Supabase
package.json            → dependência usada pelo webhook (@supabase/supabase-js)
.env.example            → variáveis de ambiente necessárias
```

## Passo a passo de publicação

Veja a conversa com o Claude para o passo a passo completo (GitHub →
Supabase → Vercel). Resumo rápido:

1. Rode `supabase-setup.sql` no SQL Editor do seu projeto Supabase.
2. Preencha `SUPABASE_URL` e `SUPABASE_ANON_KEY` diretamente no topo do
   `index.html` (são públicas por natureza, ficam no navegador).
3. Suba este projeto para o GitHub e importe na Vercel.
4. Configure em Vercel → Environment Variables: `MP_ACCESS_TOKEN`,
   `SITE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
5. Depois do primeiro deploy, cole a URL pública da função
   `/api/criar-pagamento` na constante `MP_CHECKOUT_ENDPOINT` do
   `index.html`, faça commit e deixe a Vercel reimplantar.
6. No painel do Mercado Pago, cadastre a URL de notificações (webhook)
   apontando para `https://SEU-SITE.vercel.app/api/webhook-mp`.

## Limitação que ainda vale saber

O PIN da Caixa (`2026`, no topo do `index.html`) é só uma trava visual do
app — não é autenticação de verdade. Quem souber a URL e a chave anônima
do Supabase (visíveis no código-fonte da página) consegue ler e escrever
os dados diretamente pela API do Supabase. Para o uso combinado (bazar
entre pessoas de confiança) isso é aceitável; veja os comentários no
`supabase-setup.sql` se quiser endurecer isso no futuro.
