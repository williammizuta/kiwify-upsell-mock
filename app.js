(function () {
  'use strict';

  const UPSELL_SCRIPT_URL = 'https://snippets.kiwify.com/upsell-v2-dev/upsell.min.js';
  const LINK_API_URL = 'https://checkout-api-dev.kiwify.com.br/link/';
  const LINK_ID_PATTERN = /^[A-Za-z0-9]{3,32}$/;
  const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
  const MAX_TEXT_LENGTH = 120;
  const COUNTDOWN_SECONDS = 15 * 60;
  const DEFAULT_COLOR = '#2563eb';
  const DEFAULT_ACCEPT_TEXT = 'Sim, eu aceito essa oferta especial!';
  const DEFAULT_DECLINE_TEXT = 'Não, eu gostaria de recusar essa oferta';
  // The link API returns "<product> -|- <offer>" in the name field.
  const NAME_SEPARATOR = ' -|- ';
  const FUNNEL_STEPS = ['upsell', 'upsell2', 'downsell'];
  const LOOK_PARAMS = ['accept-text', 'decline-text', 'color'];
  const PAGE_PARAMS = FUNNEL_STEPS.concat(LOOK_PARAMS, ['step']);

  const STEP_COPY = {
    upsell: {
      label: 'Upsell',
      banner: 'Pagamento aprovado! Não feche esta página: preparamos uma oferta exclusiva para você.',
      eyebrow: 'Espere! Seu pedido ainda não terminou',
      title: 'Leve também {product} com uma condição que só aparece agora',
      subtitle: 'Adicione ao seu pedido com 1 clique. Você não precisa digitar os dados do pagamento de novo.',
    },
    upsell2: {
      label: 'Upsell 2',
      banner: 'Oferta adicionada ao seu pedido! Temos mais uma condição especial para você.',
      eyebrow: 'Parabéns pela decisão',
      title: 'Complete sua jornada com {product}',
      subtitle: 'Você está a um clique do pacote completo. Esta condição também é exclusiva desta página.',
    },
    downsell: {
      label: 'Downsell',
      banner: 'Pagamento aprovado! Antes de ir, veja esta última condição.',
      eyebrow: 'Tudo bem, entendemos',
      title: 'Que tal começar com {product}?',
      subtitle: 'Preparamos uma opção mais acessível para você não ficar de fora.',
    },
  };

  const FREQUENCIES = {
    weekly: 'semana',
    monthly: 'mês',
    bimonthly: 'bimestre',
    quarterly: 'trimestre',
    'semi-annually': 'semestre',
    annually: 'ano',
  };

  function main() {
    const params = new URLSearchParams(window.location.search);
    const config = readConfig(params);
    if (!config.funnel.upsell) {
      showSetup(params, params.get('token') ? 'Esta página recebeu um token do checkout, mas a URL não informa o upsell.' : '');
      return;
    }

    const error = findConfigError(config);
    if (error) {
      showSetup(params, error);
      return;
    }

    showLanding(config, params);
  }

  function readConfig(params) {
    const color = params.get('color') || '';
    const look = {};
    LOOK_PARAMS.forEach(function (name) {
      if (params.get(name)) {
        look[name] = params.get(name);
      }
    });

    return {
      funnel: readFunnel(function (step) {
        return params.get(step) || '';
      }),
      step: params.get('step') || 'upsell',
      acceptText: limitText(params.get('accept-text')) || DEFAULT_ACCEPT_TEXT,
      declineText: limitText(params.get('decline-text')) || DEFAULT_DECLINE_TEXT,
      color: COLOR_PATTERN.test(color) ? color : DEFAULT_COLOR,
      look: look,
    };
  }

  function readFunnel(readValue) {
    const funnel = {};
    FUNNEL_STEPS.forEach(function (step) {
      funnel[step] = readValue(step).trim();
    });
    return funnel;
  }

  function findConfigError(config) {
    const invalidSteps = findInvalidSteps(config.funnel);
    if (invalidSteps.length) {
      return describeInvalidSteps(invalidSteps);
    }
    if (!STEP_COPY[config.step]) {
      return 'Etapa desconhecida: "' + config.step + '".';
    }
    if (!config.funnel[config.step]) {
      return 'A URL pede a etapa "' + config.step + '", mas não informa o link dela.';
    }
    return '';
  }

  function findInvalidSteps(funnel) {
    return FUNNEL_STEPS.filter(function (step) {
      return funnel[step] && !LINK_ID_PATTERN.test(funnel[step]);
    });
  }

  function describeInvalidSteps(steps) {
    return 'ID de link inválido em: ' + steps.join(', ') + '. Use só letras e números, por exemplo oRA9f06.';
  }

  function limitText(value) {
    return (value || '').trim().slice(0, MAX_TEXT_LENGTH);
  }

  function buildFunnelUrl(funnel, look, step) {
    const url = new URL(window.location.href);
    url.search = '';
    url.hash = '';
    FUNNEL_STEPS.forEach(function (name) {
      if (funnel[name]) {
        url.searchParams.set(name, funnel[name]);
      }
    });
    Object.keys(look).forEach(function (name) {
      url.searchParams.set(name, look[name]);
    });
    if (step !== 'upsell') {
      url.searchParams.set('step', step);
    }
    return url.toString();
  }

  function buildSetupUrl() {
    const url = new URL(window.location.href);
    url.search = '';
    url.hash = '';
    return url.toString();
  }

  // Only the first upsell branches. Upsell 2 and downsell end the funnel with the Kiwify default.
  function findNextUrls(config) {
    if (config.step !== 'upsell') {
      return { accept: '', decline: '' };
    }
    return {
      accept: config.funnel.upsell2 ? buildFunnelUrl(config.funnel, config.look, 'upsell2') : '',
      decline: config.funnel.downsell ? buildFunnelUrl(config.funnel, config.look, 'downsell') : '',
    };
  }

  /* Landing */

  function showLanding(config, params) {
    const copy = STEP_COPY[config.step];
    const linkId = config.funnel[config.step];
    const next = findNextUrls(config);

    document.title = copy.label + ' — mock de upsell Kiwify (dev)';
    applyAccent(config.color);
    bindText('banner', copy.banner);
    bindText('eyebrow', copy.eyebrow);
    bindText('subtitle', copy.subtitle);
    renderTitle(copy.title, 'esta oferta');
    renderProgress(config);
    startCountdown(document.getElementById('countdown'), COUNTDOWN_SECONDS);
    mountUpsellWidget(document.getElementById('upsell-widget'), linkId, next, config);
    renderDevPanel(config, params, next);
    document.getElementById('landing').hidden = false;

    loadUpsellScript();
    loadOffer(linkId, params, copy);
  }

  function applyAccent(color) {
    const root = document.documentElement;
    root.style.setProperty('--accent', color);
    root.style.setProperty('--accent-contrast', contrastColor(color));
  }

  // Same rule as the dashboard's upsell generator, so the button text color matches the real snippet.
  function contrastColor(hex) {
    const red = parseInt(hex.slice(1, 3), 16);
    const green = parseInt(hex.slice(3, 5), 16);
    const blue = parseInt(hex.slice(5, 7), 16);
    return red * 0.299 + green * 0.587 + blue * 0.114 > 186 ? '#000000' : '#FFFFFF';
  }

  function bindText(name, text) {
    document.querySelectorAll('[data-bind="' + name + '"]').forEach(function (element) {
      element.textContent = text;
    });
  }

  function renderTitle(template, productName) {
    const parts = template.split('{product}');
    const highlight = document.createElement('span');
    highlight.className = 'highlight';
    highlight.textContent = productName;
    document.getElementById('hero-title').replaceChildren(
      document.createTextNode(parts[0]),
      highlight,
      document.createTextNode(parts[1] || '')
    );
  }

  function renderProgress(config) {
    const labels = ['Pedido aprovado', 'Oferta especial'];
    if (config.funnel.upsell2 || config.funnel.downsell) {
      labels.push('Última oferta');
    }
    labels.push('Acesso ao produto');

    const current = config.step === 'upsell' ? 1 : 2;
    const list = document.getElementById('progress-steps');
    labels.forEach(function (label, index) {
      const item = document.createElement('li');
      item.textContent = label;
      if (index < current) {
        item.classList.add('is-done');
      }
      if (index === current) {
        item.classList.add('is-current');
        item.setAttribute('aria-current', 'step');
      }
      list.appendChild(item);
    });
  }

  function startCountdown(element, seconds) {
    const deadline = Date.now() + seconds * 1000;
    const timer = window.setInterval(tick, 1000);

    function tick() {
      const remaining = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      element.textContent = padTime(Math.floor(remaining / 60)) + ':' + padTime(remaining % 60);
      if (remaining === 0) {
        window.clearInterval(timer);
      }
    }

    tick();
  }

  function padTime(value) {
    return String(value).padStart(2, '0');
  }

  // Mirrors the HTML that the dashboard's upsell generator gives to producers.
  // Never declare the globals nextUpsellURL or nextDownsellURL: the upsell script
  // prefers them over the data attributes, and an empty value disables the funnel.
  function mountUpsellWidget(target, linkId, next, config) {
    const container = document.createElement('div');
    container.id = 'kiwify-upsell-' + linkId;
    container.setAttribute('data-upsell-url', next.accept);
    container.setAttribute('data-downsell-url', next.decline);
    container.style.setProperty('--kiwify-upsell-accept-bg', config.color);
    container.style.setProperty('--kiwify-upsell-accept-color', contrastColor(config.color));

    const acceptButton = document.createElement('button');
    acceptButton.id = 'kiwify-upsell-trigger-' + linkId;
    acceptButton.textContent = config.acceptText;

    const declineButton = document.createElement('div');
    declineButton.id = 'kiwify-upsell-cancel-trigger-' + linkId;
    declineButton.textContent = config.declineText;

    container.append(acceptButton, declineButton);
    target.appendChild(container);
  }

  function loadUpsellScript() {
    const script = document.createElement('script');
    script.src = UPSELL_SCRIPT_URL;
    document.body.appendChild(script);
  }

  function loadOffer(linkId, params, copy) {
    fetchOffer(linkId, params.get('kw-parent-currency'))
      .then(function (offer) {
        renderOffer(offer, copy);
        renderDevOffer(offer);
      })
      .catch(function (error) {
        renderOfferError(linkId, error);
      });
  }

  function fetchOffer(linkId, parentCurrency) {
    const url = new URL(LINK_API_URL + encodeURIComponent(linkId));
    url.searchParams.set('upsell', 'yes');
    if (parentCurrency) {
      url.searchParams.set('kw-parent-currency', parentCurrency);
    }

    return fetch(url)
      .then(function (response) {
        if (!response.ok) {
          throw new Error('HTTP ' + response.status);
        }
        return response.json();
      })
      .then(function (offer) {
        // The link API answers HTTP 200 with an error body for unknown links.
        if (offer.error) {
          throw new Error(offer.error);
        }
        return offer;
      });
  }

  function renderOffer(offer, copy) {
    const names = splitName(offer.name || '');
    const price = describePrice(offer);

    bindText('product-name', names.product);
    bindText('offer-name', names.offer ? 'Oferta: ' + names.offer : '');
    bindText('price', price.amount);
    bindText('installments', price.detail);
    bindText('company', describeSeller(offer));
    renderTitle(copy.title, names.product);
    renderProductImage(offer.product_img);
  }

  function splitName(name) {
    const parts = name.split(NAME_SEPARATOR);
    return { product: parts[0], offer: parts.slice(1).join(NAME_SEPARATOR) };
  }

  function describePrice(offer) {
    const currency = (offer.settings && offer.settings.currency) || 'BRL';
    if (offer.subscription) {
      const frequency = FREQUENCIES[offer.subscription.frequency] || offer.subscription.frequency;
      return { amount: formatMoney(offer.subscription.price, currency), detail: 'por ' + frequency };
    }

    const installments = Array.isArray(offer.installments) ? offer.installments : [];
    if (installments.length < 2) {
      return { amount: formatMoney(offer.price, currency), detail: 'à vista' };
    }

    const count = installments.length;
    return {
      amount: count + 'x de ' + formatMoney(installments[count - 1], currency),
      detail: 'ou ' + formatMoney(offer.price, currency) + ' à vista',
    };
  }

  function formatMoney(cents, currency) {
    try {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: currency }).format(cents / 100);
    } catch (error) {
      return currency + ' ' + (cents / 100).toFixed(2);
    }
  }

  function describeSeller(offer) {
    const parts = [];
    const seller = offer.company_name || offer.producer_name;
    if (seller) {
      parts.push('Vendido por ' + seller);
    }
    if (offer.support_email) {
      parts.push('Suporte: ' + offer.support_email);
    }
    return parts.join(' · ');
  }

  function renderProductImage(source) {
    if (!isHttpsUrl(source)) {
      return;
    }
    const image = document.getElementById('product-image');
    image.src = source;
    image.hidden = false;
    document.getElementById('product-placeholder').hidden = true;
  }

  function isHttpsUrl(value) {
    if (!value) {
      return false;
    }
    try {
      return new URL(value).protocol === 'https:';
    } catch (error) {
      return false;
    }
  }

  function renderOfferError(linkId, error) {
    const alert = document.getElementById('offer-error');
    alert.textContent = 'Não foi possível carregar o link ' + linkId + ' da API de dev (' + error.message + '). Confira o ID do link.';
    alert.hidden = false;
    bindText('product-name', 'Oferta ' + linkId);
  }

  /* Dev panel */

  function renderDevPanel(config, params, next) {
    const funnelList = document.getElementById('dev-funnel');
    FUNNEL_STEPS.forEach(function (step) {
      const isCurrent = step === config.step;
      const value = config.funnel[step] || '—';
      appendRow(funnelList, STEP_COPY[step].label, isCurrent ? value + ' (esta página)' : value, isCurrent ? 'is-current' : '');
    });
    appendRow(funnelList, 'Ao aceitar', next.accept || 'padrão da Kiwify (acesso ao produto)', '');
    appendRow(funnelList, 'Ao recusar', next.decline || 'padrão da Kiwify (acesso ao produto)', '');

    const paramsList = document.getElementById('dev-params');
    params.forEach(function (value, name) {
      if (PAGE_PARAMS.indexOf(name) === -1) {
        appendRow(paramsList, name, value, '');
      }
    });
    if (!paramsList.children.length) {
      appendRow(paramsList, '—', 'nenhum', '');
    }

    document.getElementById('dev-script').textContent = UPSELL_SCRIPT_URL;
    document.getElementById('dev-setup-link').href = buildSetupUrl();

    if (!params.get('token')) {
      const warning = document.getElementById('dev-warning');
      warning.textContent = 'Sem token na URL. Chegue a esta página pelo checkout de dev para testar a compra de 1 clique.';
      warning.hidden = false;
      document.getElementById('dev-panel').open = true;
    }
  }

  function renderDevOffer(offer) {
    const offerList = document.getElementById('dev-offer');
    appendRow(offerList, 'nome', offer.name || '—', '');
    appendRow(offerList, 'status', offer.status || '—', '');
    appendRow(offerList, 'preço', String(offer.price) + ' (centavos)', '');
    appendRow(offerList, 'moeda', (offer.settings && offer.settings.currency) || '—', '');
    appendRow(offerList, 'tipo', offer.product_type || '—', '');
    appendRow(offerList, 'gateway', offer.gateway_type || '—', '');
    appendRow(offerList, 'métodos', (offer.available_payment_methods || []).join(', ') || '—', '');
  }

  function appendRow(list, term, value, className) {
    const termElement = document.createElement('dt');
    termElement.textContent = term;
    const valueElement = document.createElement('dd');
    valueElement.textContent = value;
    if (className) {
      termElement.classList.add(className);
      valueElement.classList.add(className);
    }
    list.append(termElement, valueElement);
  }

  /* Setup */

  function showSetup(params, error) {
    const form = document.getElementById('setup-form');
    FUNNEL_STEPS.concat(['accept-text', 'decline-text']).forEach(function (name) {
      if (params.get(name)) {
        form.elements[name].value = params.get(name);
      }
    });
    if (COLOR_PATTERN.test(params.get('color') || '')) {
      form.elements.color.value = params.get('color');
    }

    if (error) {
      const alert = document.getElementById('setup-error');
      alert.textContent = error;
      alert.hidden = false;
    }

    form.addEventListener('input', function () {
      updateSetupUrl(form);
    });
    form.addEventListener('submit', function (event) {
      event.preventDefault();
    });
    document.getElementById('setup-copy').addEventListener('click', copySetupUrl);

    updateSetupUrl(form);
    document.getElementById('setup').hidden = false;
  }

  function updateSetupUrl(form) {
    const funnel = readFunnel(function (step) {
      return form.elements[step].value;
    });
    const invalidSteps = findInvalidSteps(funnel);
    const output = document.getElementById('setup-url');
    const copyButton = document.getElementById('setup-copy');
    const preview = document.getElementById('setup-preview');

    if (!funnel.upsell || invalidSteps.length) {
      output.textContent = invalidSteps.length ? describeInvalidSteps(invalidSteps) : 'Preencha o upsell para gerar a URL.';
      copyButton.disabled = true;
      preview.removeAttribute('href');
      preview.setAttribute('aria-disabled', 'true');
      return;
    }

    const url = buildFunnelUrl(funnel, readLookFromForm(form), 'upsell');
    output.textContent = url;
    copyButton.disabled = false;
    preview.href = url;
    preview.setAttribute('aria-disabled', 'false');
  }

  function readLookFromForm(form) {
    const look = {};
    const acceptText = limitText(form.elements['accept-text'].value);
    const declineText = limitText(form.elements['decline-text'].value);
    const color = form.elements.color.value.toLowerCase();
    if (acceptText) {
      look['accept-text'] = acceptText;
    }
    if (declineText) {
      look['decline-text'] = declineText;
    }
    if (color !== DEFAULT_COLOR) {
      look.color = color;
    }
    return look;
  }

  function copySetupUrl() {
    const url = document.getElementById('setup-url').textContent;
    const status = document.getElementById('setup-copy-status');
    navigator.clipboard.writeText(url).then(
      function () {
        status.textContent = 'URL copiada.';
      },
      function () {
        status.textContent = 'Não foi possível copiar. Selecione a URL e copie à mão.';
      }
    );
  }

  main();
})();
