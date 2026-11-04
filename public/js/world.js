/* KMS Ops "world" experience: 3D portal intro + robot guide.
   Started from site.js with KMSWorld.start(content).
   Admin toggles: settings.fx.intro / settings.fx.robot / settings.fx.robotName */
window.KMSWorld = (() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch { /* private mode */ } }
  };

  /* ---------- Portal intro ---------- */
  function intro(c) {
    return new Promise(resolve => {
      if (reduced || store.get('kmsIntro')) return resolve();
      store.set('kmsIntro', '1');

      const brand = esc(c.settings?.brand || 'KMS Ops');
      const icons = [...(c.products || []), ...(c.services || []), ...(c.industries || [])]
        .map(x => x.icon).filter(Boolean).slice(0, 16);
      if (!icons.length) icons.push('🍽️', '🎓', '📦', '👥', '🧾', '⚙️');

      const el = document.createElement('div');
      el.className = 'warp';
      el.innerHTML = `
        <div class="warp-scene">
          ${Array.from({ length: 6 }, (_, i) => `<span class="w-ring" style="animation-delay:${(i * 0.53).toFixed(2)}s"></span>`).join('')}
          ${icons.map((ic, i) => {
            const ang = (i / icons.length) * Math.PI * 2 + 0.4;
            const dist = 36 + (i % 4) * 14; // vmin
            return `<span class="w-ico" style="--tx:${(Math.cos(ang) * dist).toFixed(1)}vmin;--ty:${(Math.sin(ang) * dist * 0.75).toFixed(1)}vmin;animation-delay:${((i % 9) * 0.3).toFixed(2)}s;font-size:${26 + (i % 3) * 9}px">${esc(ic)}</span>`;
          }).join('')}
        </div>
        <div class="warp-center">
          <img src="/img/logo-mark.svg" alt="">
          <h2>Welcome to <b>${brand}</b></h2>
          <p>Entering your world of applications…</p>
          <div class="w-bar"><i></i></div>
        </div>
        <button class="w-skip" type="button">Skip intro ›</button>`;
      document.body.append(el);
      document.body.style.overflow = 'hidden';

      let finished = false;
      const done = () => {
        if (finished) return;
        finished = true;
        el.classList.add('out');
        document.body.style.overflow = '';
        setTimeout(() => { el.remove(); resolve(); }, 700);
      };
      el.querySelector('.w-skip').addEventListener('click', done);
      setTimeout(done, 3100);
    });
  }

  /* ---------- Robot guide ---------- */
  const BOT_SVG = `
  <svg class="bot-float" viewBox="0 0 100 110" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <linearGradient id="bt-shell" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#DCE4F4"/>
      </linearGradient>
      <radialGradient id="bt-eye" cx=".35" cy=".3" r=".9">
        <stop offset="0" stop-color="#9FE6FF"/><stop offset="1" stop-color="#2FA4F5"/>
      </radialGradient>
      <radialGradient id="bt-core" cx=".35" cy=".3" r=".9">
        <stop offset="0" stop-color="#7C88F0"/><stop offset="1" stop-color="#1D6FE0"/>
      </radialGradient>
      <radialGradient id="bt-jet" cx=".5" cy=".5" r=".5">
        <stop offset="0" stop-color="#2FA4F5" stop-opacity=".55"/><stop offset="1" stop-color="#2FA4F5" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <ellipse class="bot-jet" cx="50" cy="103" rx="22" ry="6" fill="url(#bt-jet)"/>
    <line x1="50" y1="7" x2="50" y2="15" stroke="#8A93B5" stroke-width="2.4" stroke-linecap="round"/>
    <path class="bot-star" d="M50 1.5 l1.7 3.4 3.8 .55 -2.75 2.7 .65 3.8 -3.4 -1.8 -3.4 1.8 .65 -3.8 -2.75 -2.7 3.8 -.55 Z" fill="#F7931E"/>
    <g class="bot-arm"><rect x="72" y="62" width="10" height="24" rx="5" fill="#CBD5EC"/><circle cx="77" cy="88" r="5.5" fill="#F7931E"/></g>
    <rect x="18" y="60" width="10" height="24" rx="5" fill="#CBD5EC"/><circle cx="23" cy="86" r="5.5" fill="#F7931E"/>
    <rect x="44" y="56" width="12" height="7" fill="#C2CCE6"/>
    <rect x="28" y="61" width="44" height="32" rx="15" fill="url(#bt-shell)" stroke="#C5CFE8" stroke-width="1.5"/>
    <circle cx="50" cy="77" r="8.5" fill="url(#bt-core)"/>
    <path d="M50 72.5 l1.4 2.8 3.1 .45 -2.25 2.2 .55 3.1 -2.8 -1.5 -2.8 1.5 .55 -3.1 -2.25 -2.2 3.1 -.45 Z" fill="#fff" opacity=".9"/>
    <rect x="17" y="14" width="66" height="45" rx="21" fill="url(#bt-shell)" stroke="#C5CFE8" stroke-width="1.5"/>
    <circle cx="15" cy="36" r="5" fill="#F7931E"/><circle cx="85" cy="36" r="5" fill="#F7931E"/>
    <rect x="25" y="22" width="50" height="29" rx="14.5" fill="#16254A"/>
    <ellipse class="bot-eye" cx="41" cy="35.5" rx="5" ry="6.2" fill="url(#bt-eye)"/>
    <ellipse class="bot-eye" cx="59" cy="35.5" rx="5" ry="6.2" fill="url(#bt-eye)"/>
    <path d="M45.5 44 Q50 47.5 54.5 44" fill="none" stroke="#5FD4FF" stroke-width="2" stroke-linecap="round"/>
  </svg>`;

  function robot(c) {
    const s = c.settings || {};
    const name = String(s.fx?.robotName || 'KeyBo').slice(0, 24);
    const brand = s.brand || 'KMS Ops';

    const bot = document.createElement('button');
    bot.className = 'bot';
    bot.type = 'button';
    bot.setAttribute('aria-label', `${name}, your guide`);
    bot.innerHTML = BOT_SVG;

    const bubble = document.createElement('div');
    bubble.className = 'bot-bubble';
    bubble.hidden = true;
    bubble.setAttribute('role', 'dialog');
    bubble.setAttribute('aria-live', 'polite');
    bubble.innerHTML = `<span class="bot-name">${esc(name)} · ${esc(brand)}</span><div class="bot-text"></div><div class="b-btns"></div>`;
    const txt = bubble.querySelector('.bot-text');
    const btns = bubble.querySelector('.b-btns');

    document.body.append(bot, bubble);
    requestAnimationFrame(() => setTimeout(() => bot.classList.add('in'), 80));

    const wave = () => { bot.classList.remove('wave'); void bot.offsetWidth; bot.classList.add('wave'); };

    let typeTimer = null;
    function say(text, buttons = []) {
      clearInterval(typeTimer);
      bubble.hidden = false;
      requestAnimationFrame(() => bubble.classList.add('on'));
      btns.replaceChildren();
      const addButtons = () => buttons.forEach(([label, fn, primary]) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `b-btn${primary ? ' primary' : ''}`;
        b.textContent = label;
        b.addEventListener('click', fn);
        btns.append(b);
      });
      if (reduced) { txt.textContent = text; return addButtons(); }
      txt.textContent = '';
      let i = 0;
      typeTimer = setInterval(() => {
        txt.textContent = text.slice(0, i += 2);
        if (i >= text.length) { clearInterval(typeTimer); addButtons(); }
      }, 15);
    }
    function hush() {
      clearInterval(typeTimer);
      bubble.classList.remove('on');
      setTimeout(() => (bubble.hidden = true), 300);
    }

    /* Tour steps, built from whichever sections exist */
    const products = c.products || [];
    const names = products.slice(0, 3).map(p => p.name).join(', ');
    const steps = [
      ['#top', `This is ${brand} — one world where all your business applications live together. Let me show you around!`],
      ['#products', `Here ${products.length ? `live our ${products.length} applications — ${names}…` : 'live our applications.'} Each one runs a different part of a business. Click any card to step inside! 🧩`],
      ['#services', 'Not just software — real experts too. Income tax filing, CA, GST, accounts, HR and payroll, all handled for you. 💼'],
      ['#industries', 'Schools, restaurants, retail, clinics… whatever you run, there is a solution shaped for it. 🏫🍜🛒'],
      ['#workflows', 'My favourite part — automation! Reminders, re-orders, payroll runs… the busywork just happens by itself. ⚡'],
      ['#contact', `And that's the tour! Drop your details here for a free demo — tell the team ${name} sent you 😉`]
    ].filter(([sel]) => document.querySelector(sel));

    let idx = 0, touring = false;
    const goto = sel => document.querySelector(sel)?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });

    function showStep() {
      const [sel, text] = steps[idx];
      hush();
      goto(sel);
      const nav = [];
      if (idx > 0) nav.push(['‹ Back', () => { idx--; showStep(); }]);
      nav.push(idx < steps.length - 1
        ? [`Next ›  (${idx + 1}/${steps.length})`, () => { idx++; showStep(); }, true]
        : ['Finish 🎉', endTour, true]);
      nav.push(['✕', endTour]);
      setTimeout(() => say(text, nav), reduced ? 100 : 700);
    }
    function startTour() { touring = true; idx = 0; wave(); showStep(); }
    function endTour() {
      touring = false;
      say('Enjoy exploring! I\'ll be right here if you need me. 🤖', [['Okay!', hush, true]]);
    }
    function menu() {
      say('Need anything?', [
        ['🚀 Take the tour', startTour, true],
        ['💬 Request a demo', () => { hush(); goto('#contact'); }],
        ['🙈 Hide me', () => { store.set('kmsBotHide', '1'); bot.remove(); bubble.remove(); }]
      ]);
    }

    bot.addEventListener('click', () => {
      wave();
      if (touring) return;
      if (bubble.hidden || !bubble.classList.contains('on')) menu();
      else hush();
    });
    addEventListener('keydown', e => { if (e.key === 'Escape' && !touring) hush(); });

    // Greeting
    setTimeout(() => {
      wave();
      say(`Hi! I'm ${name} 👋 Welcome to ${brand} — a whole world of business applications. Want a quick tour?`, [
        ['🚀 Show me around', startTour, true],
        ['Maybe later', hush]
      ]);
    }, reduced ? 300 : 1100);
  }

  /* ---------- Entry ---------- */
  function start(c) {
    const fx = (c.settings || {}).fx || {};
    const begin = fx.intro !== false ? intro(c) : Promise.resolve();
    begin.then(() => {
      if (fx.robot === false || store.get('kmsBotHide')) return;
      robot(c);
    });
  }

  return { start };
})();
