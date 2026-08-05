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
  const summaryKitLabel = document.getElementById('summaryKitLabel');
  const summaryPrice = document.getElementById('summaryPrice');

  function updateSelectedKitUI() {
    const label = document.querySelector(`.kit-option[data-kit="${selectedKit.id}"] strong`).textContent;
    selectedPriceEl.textContent = money(selectedKit.price);
    stickyPriceEl.textContent = money(selectedKit.price);
    summaryKitLabel.textContent = label;
    summaryPrice.textContent = money(selectedKit.price);
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

  // ---- Modal / checkout em etapas ----
  const modal = document.getElementById('checkoutModal');
  const stepPanels = Array.from(modal.querySelectorAll('[data-step-panel]'));
  const stepDots = Array.from(document.querySelectorAll('[data-step-dot]'));
  const stepPix = document.getElementById('stepPix');
  const stepSuccess = document.getElementById('stepSuccess');
  const openCheckoutBtn = document.getElementById('openCheckout');
  const formContact = document.getElementById('formContact');
  const formAddress = document.getElementById('formAddress');
  const formError = document.getElementById('formError');
  const generateBtn = document.getElementById('generatePixBtn');

  function goToStep(n) {
    stepPanels.forEach((panel) => { panel.hidden = panel.dataset.stepPanel !== String(n); });
    stepDots.forEach((dot) => {
      const dotStep = Number(dot.dataset.stepDot);
      dot.classList.toggle('is-active', dotStep === n);
      dot.classList.toggle('is-done', dotStep < n);
    });
  }

  function openModal() {
    modal.classList.add('open');
    formContact.reset();
    formAddress.reset();
    clearFieldErrors(formContact);
    clearFieldErrors(formAddress);
    goToStep(1);
    setTimeout(() => formContact.querySelector('input[name="name"]').focus(), 50);
  }
  function closeModal() {
    modal.classList.remove('open');
    stopPolling();
    stopPixCountdown();
  }

  openCheckoutBtn.addEventListener('click', openModal);
  modal.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', closeModal));

  // ---- Máscaras de campo ----
  function onlyDigits(v) { return v.replace(/\D/g, ''); }

  function maskCPF(v) {
    v = onlyDigits(v).slice(0, 11);
    v = v.replace(/(\d{3})(\d)/, '$1.$2');
    v = v.replace(/(\d{3})(\d)/, '$1.$2');
    v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    return v;
  }
  function maskPhone(v) {
    v = onlyDigits(v).slice(0, 11);
    if (v.length > 10) v = v.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    else if (v.length > 5) v = v.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
    else if (v.length > 2) v = v.replace(/(\d{2})(\d{0,5})/, '($1) $2');
    else v = v.replace(/(\d{0,2})/, '($1');
    return v;
  }
  function maskCEP(v) {
    v = onlyDigits(v).slice(0, 8);
    v = v.replace(/(\d{5})(\d{1,3})/, '$1-$2');
    return v;
  }

  formContact.cpf.addEventListener('input', (e) => { e.target.value = maskCPF(e.target.value); });
  formContact.phone.addEventListener('input', (e) => { e.target.value = maskPhone(e.target.value); });
  formAddress.cep.addEventListener('input', (e) => {
    e.target.value = maskCEP(e.target.value);
    if (onlyDigits(e.target.value).length === 8) lookupCEP(onlyDigits(e.target.value));
  });

  // ---- Validação ----
  function isValidCPF(cpf) {
    cpf = onlyDigits(cpf);
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += Number(cpf[i]) * (10 - i);
    let check1 = (sum * 10) % 11;
    if (check1 === 10) check1 = 0;
    if (check1 !== Number(cpf[9])) return false;
    sum = 0;
    for (let i = 0; i < 10; i++) sum += Number(cpf[i]) * (11 - i);
    let check2 = (sum * 10) % 11;
    if (check2 === 10) check2 = 0;
    return check2 === Number(cpf[10]);
  }
  function isValidEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
  function isValidPhone(phone) { return onlyDigits(phone).length >= 10; }

  function setFieldError(input, message) {
    const errorEl = input.parentElement.querySelector('.field-error');
    input.classList.toggle('invalid', Boolean(message));
    input.classList.toggle('valid', !message && input.value.trim() !== '');
    if (errorEl) errorEl.textContent = message || '';
  }
  function clearFieldErrors(form) {
    form.querySelectorAll('.field-error').forEach((el) => (el.textContent = ''));
    form.querySelectorAll('input').forEach((el) => el.classList.remove('invalid', 'valid'));
  }

  function validateContactForm() {
    let ok = true;
    if (formContact.name.value.trim().length < 3) { setFieldError(formContact.name, 'Digite seu nome completo'); ok = false; }
    else setFieldError(formContact.name, '');

    if (!isValidCPF(formContact.cpf.value)) { setFieldError(formContact.cpf, 'CPF inválido'); ok = false; }
    else setFieldError(formContact.cpf, '');

    if (!isValidPhone(formContact.phone.value)) { setFieldError(formContact.phone, 'Telefone inválido'); ok = false; }
    else setFieldError(formContact.phone, '');

    if (!isValidEmail(formContact.email.value)) { setFieldError(formContact.email, 'E-mail inválido'); ok = false; }
    else setFieldError(formContact.email, '');

    return ok;
  }

  formContact.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validateContactForm()) return;
    goToStep(2);
    setTimeout(() => formAddress.cep.focus(), 50);
  });

  document.getElementById('backToContact').addEventListener('click', () => goToStep(1));

  // ---- Autocompletar endereço pelo CEP (ViaCEP) ----
  const cepHint = document.getElementById('cepHint');
  async function lookupCEP(cep) {
    cepHint.textContent = 'Buscando endereço...';
    cepHint.className = 'field-hint';
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (data.erro) {
        cepHint.textContent = 'CEP não encontrado — preencha o endereço manualmente';
        cepHint.className = 'field-hint error';
        return;
      }
      formAddress.address.value = data.logradouro || '';
      formAddress.district.value = data.bairro || '';
      formAddress.city.value = data.localidade || '';
      formAddress.state.value = data.uf || '';
      cepHint.textContent = '✓ Endereço encontrado';
      cepHint.className = 'field-hint found';
      formAddress.number.focus();
    } catch (err) {
      cepHint.textContent = 'Não foi possível buscar o CEP — preencha manualmente';
      cepHint.className = 'field-hint error';
    }
  }

  function validateAddressForm() {
    let ok = true;
    ['address', 'number', 'district', 'city'].forEach((field) => {
      const input = formAddress[field];
      if (!input.value.trim()) { setFieldError(input, 'Obrigatório'); ok = false; }
      else setFieldError(input, '');
    });
    return ok;
  }

  // ---- Envio final -> cria cobrança PIX no backend ----
  let pollTimer = null;
  function stopPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  }

  formAddress.addEventListener('submit', async (e) => {
    e.preventDefault();
    formError.textContent = '';
    if (!validateAddressForm()) return;

    generateBtn.disabled = true;
    generateBtn.textContent = 'Gerando PIX...';

    const contact = Object.fromEntries(new FormData(formContact).entries());
    const address = Object.fromEntries(new FormData(formAddress).entries());
    const customer = { ...contact, ...address };

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
      setPixStatus(false);

      goToStep(3);
      startPixCountdown(data.expiresAt);
      startPolling(data.transactionId);
      document.getElementById('checkNowBtn').onclick = () => checkStatusNow(data.transactionId);
    } catch (err) {
      formError.textContent = err.message || 'Erro ao gerar PIX. Tente novamente.';
    } finally {
      generateBtn.disabled = false;
      generateBtn.textContent = 'Gerar PIX agora';
    }
  });

  function setPixStatus(paid) {
    const statusEl = document.getElementById('pixStatus');
    statusEl.classList.toggle('paid', paid);
    statusEl.innerHTML = paid
      ? '✅ Pagamento confirmado!'
      : '<span class="pulse-dot"></span> Aguardando pagamento...';
  }

  function markAsPaid(transactionId) {
    stopPolling();
    stopPixCountdown();
    setPixStatus(true);
    document.getElementById('successOrderId').textContent = '#' + transactionId.slice(-8).toUpperCase();
    setTimeout(() => {
      stepPix.hidden = true;
      stepSuccess.hidden = false;
    }, 700);
  }

  function startPolling(transactionId) {
    stopPolling();
    pollTimer = setInterval(async () => {
      try {
        const res = await fetch(`/api/pix/status/${transactionId}`);
        const data = await res.json();
        if (data.status === 'paid') markAsPaid(transactionId);
      } catch (err) {
        // silencioso: só tenta de novo no próximo ciclo
      }
    }, 4000);
  }

  async function checkStatusNow(transactionId) {
    const btn = document.getElementById('checkNowBtn');
    btn.disabled = true;
    btn.textContent = 'Verificando...';
    try {
      const res = await fetch(`/api/pix/status/${transactionId}`);
      const data = await res.json();
      if (data.status === 'paid') markAsPaid(transactionId);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Já paguei — verificar agora';
    }
  }

  // ---- Cronômetro de expiração do PIX ----
  let pixCountdownTimer = null;
  function stopPixCountdown() {
    if (pixCountdownTimer) clearInterval(pixCountdownTimer);
    pixCountdownTimer = null;
  }
  function startPixCountdown(expiresAt) {
    stopPixCountdown();
    const target = new Date(expiresAt).getTime();
    const el = document.getElementById('pixTimerValue');
    function update() {
      const remaining = Math.max(0, target - Date.now());
      const m = Math.floor(remaining / 60000);
      const s = Math.floor((remaining % 60000) / 1000);
      el.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      if (remaining <= 0) {
        stopPixCountdown();
        el.textContent = 'expirado';
      }
    }
    update();
    pixCountdownTimer = setInterval(update, 1000);
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
