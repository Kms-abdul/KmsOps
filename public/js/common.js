/* Shared helpers for public pages */
const KMS = (() => {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Only allow site-relative or http(s) URLs in src/href attributes
  const safeUrl = u => {
    u = String(u ?? '').trim();
    return /^(\/(?!\/)|https?:\/\/)/i.test(u) ? esc(u) : '';
  };
  const color = (v, fallback = 'var(--primary)') => (/^#[0-9a-f]{3,8}$/i.test(String(v ?? '').trim()) ? v.trim() : fallback);
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  async function loadContent() {
    const res = await fetch('/api/content', { cache: 'no-store' });
    if (!res.ok) throw new Error('Could not load content');
    return res.json();
  }

  function applyTheme(settings = {}) {
    const t = settings.theme || {};
    const root = document.documentElement.style;
    for (const k of ['primary', 'secondary', 'accent']) {
      const v = color(t[k], '');
      if (v) root.setProperty(`--${k}`, v);
    }
  }

  // "KMS Ops" -> "KMS" in ink + "Ops" in brand blue
  const brandHtml = brand => {
    const i = brand.lastIndexOf(' ');
    return i > 0 ? `${esc(brand.slice(0, i))} <span class="brand-hl">${esc(brand.slice(i + 1))}</span>` : esc(brand);
  };

  function renderBrand(s) {
    const brand = s.brand || 'KMS Ops';
    const full = s.brandFull ?? 'Key Management Solutions';
    const motto = (s.brandMotto ?? 'Build • Automate • Operate').split('•').map(x => x.trim()).filter(Boolean);
    $$('.logo').forEach(logo => {
      logo.innerHTML = s.logoImage
        ? `<img src="${safeUrl(s.logoImage)}" alt="${esc(brand)}">`
        : `<img class="logo-mark" src="/img/logo-mark.svg" alt=""><span class="logo-text"><b>${brandHtml(brand)}</b>${full ? `<small>${esc(full)}</small>` : ''}</span>`;
    });
    $$('[data-brand]').forEach(el => (el.textContent = brand));
    $$('[data-motto]').forEach(el => {
      el.innerHTML = motto.map(m => `<span>${esc(m)}</span>`).join('');
      el.hidden = !motto.length;
    });
  }

  function renderFooter(c) {
    const s = c.settings || {};
    const y = $('#year'); if (y) y.textContent = new Date().getFullYear();
    const note = $('#footerNote'); if (note) note.textContent = s.footerNote || '';
    const fp = $('#footProducts');
    if (fp) fp.innerHTML = (c.products || []).map(p => `<li><a href="/product/${encodeURIComponent(p.slug)}">${esc(p.name)}</a></li>`).join('');
    const fs = $('#footServices');
    if (fs) fs.innerHTML = (c.services || []).map(x => `<li><a href="/#services">${esc(x.title)}</a></li>`).join('');
    const fc = $('#footContact');
    if (fc) fc.innerHTML = [
      s.email && `<li><a href="mailto:${esc(s.email)}">${esc(s.email)}</a></li>`,
      s.phone && `<li><a href="tel:${esc(s.phone.replace(/\s/g, ''))}">${esc(s.phone)}</a></li>`,
      s.address && `<li><span>${esc(s.address)}</span></li>`
    ].filter(Boolean).join('');
    const so = $('#socials');
    if (so) {
      const labels = { linkedin: 'in', instagram: 'ig', twitter: 'X', facebook: 'f', youtube: '▶' };
      so.innerHTML = Object.entries(s.social || {}).filter(([, v]) => safeUrl(v))
        .map(([k, v]) => `<a href="${safeUrl(v)}" target="_blank" rel="noopener" aria-label="${esc(k)}">${labels[k] || esc(k[0])}</a>`).join('');
    }
    const wa = $('#waFloat');
    if (wa && s.whatsapp) {
      wa.href = `https://wa.me/${encodeURIComponent(s.whatsapp.replace(/\D/g, ''))}`;
      wa.hidden = false;
    }
  }

  // Generated "app screenshot" used until real images are uploaded
  function mockup() {
    const bars = Array.from({ length: 8 }, (_, i) => `<b style="height:${30 + Math.round(Math.abs(Math.sin(i * 1.7 + 1)) * 65)}%;animation-delay:${i * 80}ms"></b>`).join('');
    return `<div class="mock"><div class="mock-side"><i></i><i></i><i></i><i></i><i></i><i></i></div>
      <div class="mock-main"><div class="mock-kpis"><span></span><span></span><span></span></div><div class="mock-chart">${bars}</div></div></div>`;
  }

  // 3D tilt with moving glare
  function tilt(el, max = 8) {
    if (reducedMotion || matchMedia('(hover: none)').matches) return;
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      el.style.transform = `rotateX(${(0.5 - y) * max}deg) rotateY(${(x - 0.5) * max}deg) translateY(-6px)`;
      el.style.setProperty('--gx', `${x * 100}%`);
      el.style.setProperty('--gy', `${y * 100}%`);
    });
    el.addEventListener('pointerleave', () => (el.style.transform = ''));
  }

  function reveal(root = document) {
    const items = $$('.reveal:not(.in)', root);
    if (reducedMotion || !('IntersectionObserver' in window)) return items.forEach(el => el.classList.add('in'));
    const io = new IntersectionObserver(entries => entries.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    }), { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    items.forEach((el, i) => { el.style.transitionDelay = `${Math.min(i % 6, 5) * 70}ms`; io.observe(el); });
  }

  function navBehaviour() {
    const nav = $('#nav');
    if (!nav) return;
    const onScroll = () => nav.classList.toggle('scrolled', scrollY > 10);
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    const burger = $('#burger');
    burger?.addEventListener('click', () => nav.classList.toggle('open'));
    $$('#navLinks a').forEach(a => a.addEventListener('click', () => nav.classList.remove('open')));
  }

  return { esc, safeUrl, color, $, $$, reducedMotion, loadContent, applyTheme, renderBrand, renderFooter, mockup, tilt, reveal, navBehaviour };
})();
