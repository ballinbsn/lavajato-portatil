const axios = require('axios');

const BASE_URL = process.env.PUSHINPAY_BASE_URL || 'https://api.pushinpay.com.br';

function client() {
  const token = process.env.PUSHINPAY_TOKEN;
  if (!token) {
    throw new Error('PUSHINPAY_TOKEN não configurado. Defina no arquivo .env');
  }
  return axios.create({
    baseURL: BASE_URL,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    timeout: 15000
  });
}

// valueInCents: valor em centavos (ex: R$ 71,91 => 7191)
async function createPixCharge({ valueInCents, webhookUrl }) {
  const { data } = await client().post('/api/pix/cashIn', {
    value: valueInCents,
    webhook_url: webhookUrl || process.env.WEBHOOK_URL
  });
  // data: { id, qr_code, qr_code_base64, status, value, webhook_url }
  return data;
}

async function getPixStatus(transactionId) {
  const { data } = await client().get(`/api/transactions/${transactionId}`);
  // data: { id, value, status: 'created' | 'paid' | 'canceled', end_to_end_id }
  return data;
}

module.exports = { createPixCharge, getPixStatus };
