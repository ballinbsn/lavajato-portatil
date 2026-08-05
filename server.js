require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const { createPixCharge, getPixStatus } = require('./pushinpay');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Preços definidos no servidor (nunca confie no valor vindo do front-end)
const KITS = {
  '1': { label: '1 Unidade', valueInCents: 7191 },
  '2': { label: '2 Unidades', valueInCents: 12591 },
  '3': { label: '3 Unidades', valueInCents: 17091 }
};

// order em memória: id da transação -> pedido
const orders = new Map();

app.post('/api/pix/create', async (req, res) => {
  try {
    const { kitId, customer } = req.body || {};
    const kit = KITS[kitId];
    if (!kit) return res.status(400).json({ error: 'Kit inválido' });
    if (!customer || !customer.name || !customer.email || !customer.cpf) {
      return res.status(400).json({ error: 'Dados do cliente incompletos' });
    }

    const charge = await createPixCharge({ valueInCents: kit.valueInCents });

    orders.set(charge.id, {
      kitId,
      kit: kit.label,
      valueInCents: kit.valueInCents,
      customer,
      status: charge.status || 'created',
      createdAt: Date.now()
    });

    res.json({
      transactionId: charge.id,
      qrCode: charge.qr_code,
      qrCodeBase64: charge.qr_code_base64,
      status: charge.status,
      valueInCents: kit.valueInCents
    });
  } catch (err) {
    console.error('Erro ao criar cobrança PIX:', err.response?.data || err.message);
    res.status(500).json({ error: 'Não foi possível gerar o PIX. Tente novamente.' });
  }
});

app.get('/api/pix/status/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const local = orders.get(id);

    const remote = await getPixStatus(id);
    if (local) local.status = remote.status;

    res.json({ status: remote.status });
  } catch (err) {
    console.error('Erro ao consultar status PIX:', err.response?.data || err.message);
    res.status(500).json({ error: 'Não foi possível consultar o status do pagamento.' });
  }
});

// A PushinPay chama essa URL quando o status do pagamento muda
app.post('/api/pix/webhook', (req, res) => {
  const { id, status } = req.body || {};
  if (id && orders.has(id)) {
    orders.get(id).status = status;
    console.log(`Pedido ${id} atualizado para status: ${status}`);
  }
  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
