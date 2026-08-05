const BASE_URL = process.env.PINPAY_BASE_URL || 'https://api.usepinpay.com/functions/v1/api-v1';

function authHeaders() {
  const token = process.env.PINPAY_TOKEN;
  if (!token) {
    throw new Error('PINPAY_TOKEN não configurado. Defina no arquivo .env');
  }
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}

async function readJsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

// orderId é usado como Idempotency-Key: 1 pedido = 1 cobrança, mesmo em retry de rede.
async function createPixCharge({ orderId, amountInCents, description, customer, webhookUrl, checkoutUrl }) {
  const res = await fetch(`${BASE_URL}/pix`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Idempotency-Key': orderId },
    body: JSON.stringify({
      amount: amountInCents,
      description,
      customer: {
        name: customer.name,
        email: customer.email,
        document: { type: 'CPF', number: (customer.cpf || '').replace(/\D/g, '') },
        phone: (customer.phone || '').replace(/\D/g, '')
      },
      expires_in: 3600,
      webhook_url: webhookUrl || process.env.PINPAY_WEBHOOK_URL,
      metadata: { external_reference: orderId, checkout_url: checkoutUrl }
    }),
    signal: AbortSignal.timeout(30000)
  });

  if (!res.ok) {
    const err = await readJsonSafe(res);
    const error = new Error(err.message || 'Falha ao criar cobrança PIX');
    error.status = res.status;
    error.details = err;
    throw error;
  }
  return res.json();
}

async function getPixStatus(pixId) {
  const res = await fetch(`${BASE_URL}/transactions/${pixId}`, {
    headers: authHeaders(),
    signal: AbortSignal.timeout(10000)
  });

  if (!res.ok) {
    const err = await readJsonSafe(res);
    const error = new Error(err.message || 'Falha ao consultar status PIX');
    error.status = res.status;
    error.details = err;
    throw error;
  }
  return res.json();
}

module.exports = { createPixCharge, getPixStatus };
