(function () {
  const money = (n) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // ---- Galeria ----
  const mainImage = document.getElementById('mainImage');
  document.querySelectorAll('.thumb').forEach((thumb) => {
    thumb.addEventListener('click', () => {
      mainImage.src = thumb.src;
      document.querySelectorAll('.thumb').forEach((t) => t.classList.remove('active'));
      thumb.classList.add('active');
    });
  });

  // ---- Contador regressivo (reinicia a cada 2h pra manter urgência) ----
  const cdHours = document.getElementById('cd-hours');
  const cdMin = document.getElementById('cd-min');
  const cdSec = document.getElementById('cd-sec');
  const WINDOW_MS = 2 * 60 * 60 * 1000;
  function tick() {
    const remaining = WINDOW_MS - (Date.now() % WINDOW_MS);
    const h = Math.floor(remaining / 3600000);
    const m = Math.floor((remaining % 3600000) / 60000);
    const s = Math.floor((remaining % 60000) / 1000);
    cdHours.textContent = String(h).padStart(2, '0');
    cdMin.textContent = String(m).padStart(2, '0');
    cdSec.textContent = String(s).padStart(2, '0');
  }
  tick();
  setInterval(tick, 1000);

  // ---- Seleção de kit ----
  let selectedKit = { id: '2', price: 126.00, old: 159.80 };
  const selectedPriceEl = document.getElementById('selectedPrice');
  const stickyPriceEl = document.getElementById('stickyPrice');
  const modalKitSummary = document.getElementById('modalKitSummary');

  function updateSelectedKitUI() {
    const label = document.querySelector(`.kit-option[data-kit="${selectedKit.id}"] strong`).textContent;
    selectedPriceEl.textContent = money(selectedKit.price);
    stickyPriceEl.textContent = money(selectedKit.price);
    modalKitSummary.textContent = `${label} — ${money(selectedKit.price)} no PIX`;
  }

  document.querySelectorAll('.kit-option').forEach((el) => {
    el.addEventListener('click', () => {
      el.querySelector('input').checked = true;
      selectedKit = {
        id: el.dataset.kit,
        price: parseFloat(el.dataset.price),
        old: parseFloat(el.dataset.old)
      };
      updateSelectedKitUI();
    });
  });
  updateSelectedKitUI();

  // ---- Modal / checkout ----
  const modal = document.getElementById('checkoutModal');
  const stepForm = document.getElementById('stepForm');
  const stepPix = document.getElementById('stepPix');
  const stepSuccess = document.getElementById('stepSuccess');
  const openCheckoutBtn = document.getElementById('openCheckout');
  const form = document.getElementById('checkoutForm');
  const formError = document.getElementById('formError');
  const generateBtn = document.getElementById('generatePixBtn');

  function openModal() {
    modal.classList.add('open');
    [stepForm, stepPix, stepSuccess].forEach((s) => (s.hidden = true));
    stepForm.hidden = false;
  }
  function closeModal() {
    modal.classList.remove('open');
    stopPolling();
  }

  openCheckoutBtn.addEventListener('click', openModal);
  modal.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', closeModal));

  // ---- Envio do formulário -> cria cobrança PIX no backend ----
  let pollTimer = null;
  function stopPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    formError.textContent = '';
    generateBtn.disabled = true;
    generateBtn.textContent = 'Gerando PIX...';

    const fd = new FormData(form);
    const customer = Object.fromEntries(fd.entries());

    try {
      const res = await fetch('/api/pix/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kitId: selectedKit.id, customer })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao gerar PIX');

      document.getElementById('pixQrImage').src = data.qrCodeUrl;
      document.getElementById('pixCopyPaste').value = data.qrCode;
      document.getElementById('pixValue').textContent = money(data.valueInCents / 100);
      document.getElementById('pixStatus').textContent = '⏳ Aguardando pagamento...';
      document.getElementById('pixStatus').classList.remove('paid');

      stepForm.hidden = true;
      stepPix.hidden = false;

      startPolling(data.transactionId);
    } catch (err) {
      formError.textContent = err.message || 'Erro ao gerar PIX. Tente novamente.';
    } finally {
      generateBtn.disabled = false;
      generateBtn.textContent = 'Gerar PIX agora';
    }
  });

  function startPolling(transactionId) {
    stopPolling();
    pollTimer = setInterval(async () => {
      try {
        const res = await fetch(`/api/pix/status/${transactionId}`);
        const data = await res.json();
        if (data.status === 'paid') {
          stopPolling();
          stepPix.hidden = true;
          stepSuccess.hidden = false;
        }
      } catch (err) {
        // silencioso: só tenta de novo no próximo ciclo
      }
    }, 4000);
  }

  // ---- Copiar código PIX ----
  document.getElementById('copyPixBtn').addEventListener('click', () => {
    const input = document.getElementById('pixCopyPaste');
    input.select();
    navigator.clipboard.writeText(input.value).then(() => {
      const btn = document.getElementById('copyPixBtn');
      const original = btn.textContent;
      btn.textContent = 'Copiado!';
      setTimeout(() => (btn.textContent = original), 1800);
    });
  });
})();
