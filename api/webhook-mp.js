// api/webhook-mp.js
// O Mercado Pago chama esta URL automaticamente quando o status de um
// pagamento muda (aprovado, recusado, etc). Este arquivo:
//   1) confirma o pagamento consultando a API do Mercado Pago (nunca confia
//      cegamente no que chega no corpo da notificação);
//   2) se aprovado, localiza o pedido correspondente (external_reference)
//      dentro dos dados salvos no Supabase e muda o status dele de
//      'aguardando_pagamento' para 'pendente' (pago, aguardando retirada).
//
// Variáveis de ambiente necessárias na Vercel:
//   MP_ACCESS_TOKEN            (mesmo token usado em criar-pagamento.js)
//   SUPABASE_URL                URL do projeto Supabase
//   SUPABASE_SERVICE_ROLE_KEY   chave "service_role" (Project Settings → API)
//     -> use a service_role aqui (NUNCA no HTML do bazar): ela ignora as
//        políticas de RLS, então só deve viver em código de servidor.

import { createClient } from '@supabase/supabase-js';

const STORE_ROW_ID = 'main';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const paymentId = req.body?.data?.id || req.query?.['data.id'];
    const topic = req.body?.type || req.query?.topic;

    if (!paymentId || topic !== 'payment') {
      // Mercado Pago também envia outros tipos de notificação; só nos
      // interessa 'payment'. Responde 200 para não gerar reenvios.
      return res.status(200).end();
    }

    const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` }
    });
    const payment = await mpRes.json();
    if (!mpRes.ok) {
      console.error('Falha ao consultar pagamento no Mercado Pago:', payment);
      return res.status(200).end(); // responde 200 mesmo assim, já foi logado
    }

    if (payment.status !== 'approved') {
      // pendente, recusado, estornado, etc — nada a fazer ainda
      return res.status(200).end();
    }

    const orderId = payment.external_reference;
    if (!orderId) return res.status(200).end();

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: row, error: readErr } = await supabase
      .from('bazar_store')
      .select('data')
      .eq('id', STORE_ROW_ID)
      .single();
    if (readErr) throw readErr;

    const store = row.data;
    const order = (store.orders || []).find(o => o.id === orderId);
    if (order && order.status === 'aguardando_pagamento') {
      order.status = 'pendente'; // pago, aguardando retirada no balcão
      order.paidAt = Date.now();

      const { error: writeErr } = await supabase
        .from('bazar_store')
        .upsert({ id: STORE_ROW_ID, data: store, updated_at: new Date().toISOString() });
      if (writeErr) throw writeErr;
    }

    return res.status(200).end();
  } catch (err) {
    console.error(err);
    // ainda assim responde 200: erros aqui não devem fazer o Mercado Pago
    // ficar reenviando a notificação indefinidamente. O erro fica no log.
    return res.status(200).end();
  }
}
