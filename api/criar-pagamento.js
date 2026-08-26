// api/criar-pagamento.js
// Função serverless (Vercel) que cria uma "preferência" de pagamento no
// Mercado Pago (Checkout Pro) e devolve o link (init_point) para onde o
// cliente deve ser redirecionado para pagar.
//
// IMPORTANTE: o Access Token FICA SÓ AQUI, nunca no HTML do bazar.
// Configure-o como variável de ambiente MP_ACCESS_TOKEN no painel da Vercel
// (Project Settings → Environment Variables). Nunca cole o token no código.

export default async function handler(req, res) {
  // Libera chamadas vindas do artifact do Claude (ajuste se publicar em domínio próprio)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
  if (!ACCESS_TOKEN) {
    return res.status(500).json({ error: 'MP_ACCESS_TOKEN não configurado no servidor' });
  }

  try {
    const { orderId, orderCode, items, method, parcelas } = req.body;

    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ error: 'Pedido sem itens' });
    }

    // URL pública do artifact/site — ajuste depois de publicar
    const SITE_URL = process.env.SITE_URL || 'https://exemplo.com';

    const preference = {
      items: items.map(it => ({
        title: it.title,
        quantity: it.quantity,
        unit_price: it.unit_price,
        currency_id: 'BRL'
      })),
      external_reference: orderId, // liga o pagamento ao pedido no seu sistema
      payment_methods: {
        // permite débito e crédito; limita o crédito a até 3x sem juros
        installments: 3,
        default_installments: method === 'credito' ? (parcelas || 1) : 1,
        excluded_payment_types: method === 'pix'
          ? []
          : [{ id: 'ticket' }] // remove boleto se quiser restringir aos métodos pedidos
      },
      back_urls: {
        success: `${SITE_URL}?pedido=${orderCode}&status=aprovado`,
        pending: `${SITE_URL}?pedido=${orderCode}&status=pendente`,
        failure: `${SITE_URL}?pedido=${orderCode}&status=falhou`
      },
      auto_return: 'approved',
      notification_url: `${SITE_URL}/api/webhook-mp`
    };

    const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(preference)
    });

    const data = await mpRes.json();
    if (!mpRes.ok) {
      console.error('Erro Mercado Pago:', data);
      return res.status(502).json({ error: 'Falha ao criar preferência', details: data });
    }

    return res.status(200).json({ init_point: data.init_point });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno' });
  }
}
