require('dotenv').config();
const crypto = require('node:crypto');
const express = require('express');
const cors = require('cors');
const { createPixCharge, getPixStatus } = require('./pinpay');

const app = express();
app.set('trust proxy', true); // Railway fica atrás de proxy — precisa disso pra req.protocol vir "https"
app.use(cors());

// Preços definidos no servidor (nunca confie no valor vindo do front-end)
const KITS = {
  '1': { label: '1 Unidade', valueInCents: 7191 },
  '2': { label: '2 Unidades', valueInCents: 12591 },
  '3': { label: '3 Unidades', valueInCents: 17091 }
};

// pedidos em memória, indexados pelo id da transação retornado pela PinPay
const orders = new Map();

// Rota do webhook precisa vir ANTES do express.json() global: a assinatura HMAC
// é calculada sobre os bytes crus do corpo, então usamos express.raw só aqui.
app.post('/api/pix/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['x-webhook-signature'];
  const secret = process.env.PINPAY_WEBHOOK_SECRET;
  if (!sig || !secret) return res.status(401).end();

  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(req.body)
    .digest('hex');

  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  const valid = sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf);
  if (!valid) return res.status(401).end();

  const { event, data } = JSON.parse(req.body.toString('utf8'));
  const order = orders.get(data.transaction_id);
  if (order) {
    order.status = data.status;
    order.event = event;
  }

  console.log(`Webhook PinPay: ${event} — transação ${data.transaction_id} — status ${data.status}`);
  res.status(200).end();
});

app.use(express.json());
app.use(express.static(__dirname));

app.post('/api/pix/create', async (req, res) => {
  try {
    const { kitId, customer } = req.body || {};
    const kit = KITS[kitId];
    if (!kit) return res.status(400).json({ error: 'Kit inválido' });
    if (!customer || !customer.name || !customer.email || !customer.cpf) {
      return res.status(400).json({ error: 'Dados do cliente incompletos' });
    }

    const orderId = crypto.randomUUID();
    const checkoutUrl = `${req.protocol}://${req.get('host')}/#oferta`;
    const pix = await createPixCharge({
      orderId,
      amountInCents: kit.valueInCents,
      description: `${kit.label} — Lavadora de Alta Pressão Sem Fio 48V Premium`,
      customer,
      checkoutUrl
    });

    orders.set(pix.id, {
      orderId,
      kitId,
      kit: kit.label,
      valueInCents: kit.valueInCents,
      customer,
      status: pix.status,
      createdAt: Date.now()
    });

    res.json({
      transactionId: pix.id,
      qrCode: pix.qr_code,
      qrCodeUrl: pix.qr_code_url,
      expiresAt: pix.expires_at,
      status: pix.status,
      valueInCents: kit.valueInCents
    });
  } catch (err) {
    console.error('Erro ao criar cobrança PIX:', err.status, err.details || err.message);
    res.status(502).json({ error: 'Não foi possível gerar o PIX. Tente novamente.' });
  }
});

app.get('/api/pix/status/:id', async (req, res) => {
  const { id } = req.params;
  const local = orders.get(id);

  // O webhook já mantém o status local atualizado em tempo real — só
  // consultamos a PinPay direto se ainda não recebemos nenhum evento.
  if (local && local.event) {
    return res.json({ status: local.status });
  }

  try {
    const pix = await getPixStatus(id);
    if (local) local.status = pix.status;
    res.json({ status: pix.status });
  } catch (err) {
    console.error('Erro ao consultar status PIX:', err.status, err.message);
    res.status(502).json({ error: 'Não foi possível consultar o status do pagamento.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
