/* Home page: renders everything from /api/content */
(async () => {
  const { esc, safeUrl, $, $$, reducedMotion } = KMS;
  KMS.navBehaviour();

  let c;
  try {
    c = await KMS.loadContent();
  } catch {
    document.body.insertAdjacentHTML('afterbegin', '<p style="padding:12px;text-align:center">Content could not be loaded. Please refresh.</p>');
    return;
  }
  const s = c.settings || {};
  const sections = s.sections || {};
  KMS.applyTheme(s);
  KMS.renderBrand(s);
  if (s.brand) document.title = `${s.brand} — ${s.brandFull || s.tagline || 'Key Management Solutions'}`;

  // Hide sections switched off in admin (or with no content)
  $$('[data-section]').forEach(sec => {
    if (sections[sec.dataset.section] === false) sec.remove();
  });
  $$('#navLinks a').forEach(a => { if (!document.querySelector(a.getAttribute('href'))) a.remove(); });

  // ---------- Hero ----------
  $('#heroEyebrow').textContent = s.heroEyebrow || '';
  $('#heroEyebrow').hidden = !s.heroEyebrow;
  $('#heroTitle').innerHTML = `${esc(s.heroTitle)} <span class="hl">${esc(s.heroHighlight)}</span>`;
  $('#heroSubtitle').textContent = s.heroSubtitle || '';
  $('#ctaPrimary').textContent = s.heroCtaPrimary || 'Explore Applications';
  $('#ctaSecondary').textContent = s.heroCtaSecondary || 'Talk to an Expert';
  $('#heroTrust').innerHTML = (c.stats || []).slice(0, 3)
    .map(x => `<div><b>${esc(x.value)}${esc(x.suffix)}</b><small>${esc(x.label)}</small></div>`).join('');

  const marqueeItems = [...(c.industries || []).map(i => `${i.icon || ''} ${i.name}`), ...(c.services || []).map(x => `${x.icon || ''} ${x.title}`)];
  const mq = marqueeItems.map(t => `<span>${esc(t)}</span>`).join('');
  $('#marquee').innerHTML = mq + mq;

  // ---------- Products ----------
  const products = c.products || [];
  const grid = $('#productGrid');
  if (grid) {
    const cats = [...new Set(products.map(p => p.category).filter(Boolean))];
    const filters = $('#productFilters');
    if (cats.length > 1) {
      filters.innerHTML = ['All', ...cats].map((x, i) => `<button class="chip${i ? '' : ' active'}" data-cat="${esc(x)}">${esc(x)}</button>`).join('');
      filters.addEventListener('click', e => {
        const b = e.target.closest('.chip'); if (!b) return;
        $$('.chip', filters).forEach(x => x.classList.toggle('active', x === b));
        $$('.pcard', grid).forEach(card => {
          const show = b.dataset.cat === 'All' || card.dataset.cat === b.dataset.cat;
          card.style.display = show ? '' : 'none';
        });
      });
    } else filters.remove();

    grid.innerHTML = products.map(p => {
      const img = safeUrl(p.coverImage || (p.gallery || [])[0]);
      return `<a class="pcard reveal" href="/product/${encodeURIComponent(p.slug)}" data-cat="${esc(p.category)}" style="--c:${KMS.color(p.accent)}">
        <span class="glare"></span>
        <div class="pcard-media">
          ${p.badge ? `<span class="badge">${esc(p.badge)}</span>` : ''}
          ${img ? `<img src="${img}" alt="${esc(p.name)} screenshot" loading="lazy">` : KMS.mockup()}
        </div>
        <div class="pcard-body">
          <div class="pcard-top"><span class="app-icon">${esc(p.icon || '◆')}</span>
            <div><span class="cat">${esc(p.category)}</span><h3>${esc(p.name)}</h3></div></div>
          <p>${esc(p.tagline)}</p>
          <ul>${(p.features || []).slice(0, 4).map(f => `<li>${esc(f)}</li>`).join('')}</ul>
          <span class="more">Explore ${esc(p.name)} <i>→</i></span>
        </div>
      </a>`;
    }).join('') || '<p style="text-align:center;color:var(--muted)">Applications coming soon.</p>';
    $$('.pcard', grid).forEach(el => KMS.tilt(el, 7));
  }

  // ---------- Stats ----------
  const statsEl = $('#stats');
  if ((c.stats || []).length) {
    statsEl.style.gridTemplateColumns = `repeat(${Math.min(c.stats.length, 4)}, 1fr)`;
    statsEl.innerHTML = c.stats.map(x => `<div class="stat"><b data-count="${esc(x.value)}" data-suffix="${esc(x.suffix)}">0</b><span>${esc(x.label)}</span></div>`).join('');
    countUp(statsEl);
  } else statsEl.closest('.stats-band').remove();

  // ---------- Services ----------
  const sg = $('#serviceGrid');
  if (sg) {
    sg.innerHTML = (c.services || []).map(x => `
      <article class="scard reveal">
        <div class="cube"><span>${esc(x.icon || '★')}</span></div>
        <h3>${esc(x.title)}</h3>
        <p>${esc(x.summary)}</p>
        <div class="tags">${(x.features || []).map(f => `<span>${esc(f)}</span>`).join('')}</div>
      </article>`).join('');
    $$('.scard', sg).forEach(el => KMS.tilt(el, 6));
  }

  // ---------- Industries ----------
  const ig = $('#industryGrid');
  if (ig) {
    ig.innerHTML = (c.industries || []).map(x => {
      const img = safeUrl(x.image);
      return `<article class="icard reveal${img ? ' has-img' : ''}">
        ${img ? `<div class="ibg" style="background-image:url('${img}')"></div>` : `<span class="iico">${esc(x.icon)}</span>`}
        <h3>${esc(x.name)}</h3><p>${esc(x.description)}</p></article>`;
    }).join('');
  }

  // ---------- Workflows ----------
  const wl = $('#workflowList');
  if (wl) {
    wl.innerHTML = (c.workflows || []).map((w, i) => `
      <article class="wf reveal">
        <div><h3><span>${esc(w.icon)}</span>${esc(w.title)}</h3><p>${esc(w.description)}</p></div>
        <div class="pipe"><span class="dot" style="animation-delay:${i * -1.1}s"></span>
          ${(w.steps || []).map((st, j) => `<div class="step"><small>STEP ${j + 1}</small>${esc(st)}</div>`).join('')}
        </div>
      </article>`).join('');
  }

  // ---------- Process ----------
  const pl = $('#processList');
  if (pl) pl.innerHTML = (c.process || []).map(p => `<li class="reveal"><h3>${esc(p.title)}</h3><p>${esc(p.text)}</p></li>`).join('');

  // ---------- Testimonials (3D ring) ----------
  const ring = $('#ring');
  if (ring) {
    const ts = c.testimonials || [];
    if (!ts.length) $('#testimonials').remove();
    else {
      ring.innerHTML = ts.map(t => {
        const av = safeUrl(t.avatar);
        const initials = esc((t.name || '?').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase());
        return `<figure class="tcard"><blockquote>${esc(t.quote)}</blockquote>
          <figcaption class="who">${av ? `<img class="avatar" src="${av}" alt="">` : `<span class="avatar">${initials}</span>`}
          <div><b>${esc(t.name)}</b><small>${esc([t.role, t.company].filter(Boolean).join(', '))}</small></div></figcaption></figure>`;
      }).join('');
      setupRing(ring, ts.length);
    }
  }

  // ---------- FAQ ----------
  const fl = $('#faqList');
  if (fl) fl.innerHTML = (c.faqs || []).map((f, i) => `<details class="faq reveal"${i === 0 ? ' open' : ''}><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('');

  // ---------- Contact ----------
  const cl = $('#contactLines');
  if (cl) cl.innerHTML = [
    s.email && `<li><a href="mailto:${esc(s.email)}">✉️ ${esc(s.email)}</a></li>`,
    s.phone && `<li><a href="tel:${esc(s.phone.replace(/\s/g, ''))}">📞 ${esc(s.phone)}</a></li>`,
    s.whatsapp && `<li><a href="https://wa.me/${esc(s.whatsapp.replace(/\D/g, ''))}" target="_blank" rel="noopener">💬 Chat on WhatsApp</a></li>`,
    s.address && `<li><span>📍 ${esc(s.address)}</span></li>`
  ].filter(Boolean).join('');
  const sel = $('#interestSelect');
  if (sel) {
    const opts = ['General enquiry', ...products.map(p => p.name), ...(c.services || []).map(x => x.title), 'Custom automation'];
    sel.innerHTML = opts.map(o => `<option>${esc(o)}</option>`).join('');
    const wanted = new URLSearchParams(location.search).get('interest');
    if (wanted && opts.includes(wanted)) sel.value = wanted;
  }
  setupForm();

  KMS.renderFooter(c);
  KMS.reveal();
  heroScene();

  // ===== helpers =====
  function countUp(root) {
    const els = $$('[data-count]', root);
    const run = el => {
      const target = parseFloat(el.dataset.count);
      const suffix = el.dataset.suffix || '';
      if (isNaN(target) || reducedMotion) return (el.textContent = el.dataset.count + suffix);
      const dec = (el.dataset.count.split('.')[1] || '').length;
      const t0 = performance.now();
      const tick = now => {
        const k = Math.min((now - t0) / 1600, 1);
        el.textContent = (target * (1 - Math.pow(1 - k, 3))).toFixed(dec) + suffix;
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(en => en.forEach(e => { if (e.isIntersecting) { run(e.target); io.unobserve(e.target); } }), { threshold: .5 });
    els.forEach(el => io.observe(el));
  }

  function setupRing(ringEl, n) {
    const cards = $$('.tcard', ringEl);
    let idx = 0, timer;
    const layout = () => {
      const w = cards[0].offsetWidth;
      const radius = n < 3 ? 0 : Math.round((w / 2) / Math.tan(Math.PI / n)) + 40;
      cards.forEach((card, i) => {
        if (n < 3) card.style.transform = `translateX(${(i - idx) * 110}%)`;
        else card.style.transform = `rotateY(${(360 / n) * i}deg) translateZ(${radius}px)`;
      });
      ringEl.style.transform = n < 3 ? '' : `translateZ(${-radius}px) rotateY(${-(360 / n) * idx}deg)`;
      cards.forEach((card, i) => (card.style.opacity = i === ((idx % n) + n) % n ? 1 : .45));
    };
    const go = d => { idx += d; layout(); };
    $('#nextT').onclick = () => { go(1); restart(); };
    $('#prevT').onclick = () => { go(-1); restart(); };
    const restart = () => { clearInterval(timer); if (!reducedMotion) timer = setInterval(() => go(1), 5500); };
    addEventListener('resize', layout);
    layout(); restart();
  }

  function setupForm() {
    const form = $('#contactForm');
    if (!form) return;
    const msg = $('#formMsg');
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      msg.className = 'form-msg';
      if (!data.name.trim() || (!data.email.trim() && !data.phone.trim())) {
        msg.textContent = 'Please share your name and an email or phone number.';
        return msg.classList.add('err');
      }
      const btn = form.querySelector('button');
      btn.disabled = true; btn.textContent = 'Sending…';
      try {
        const r = await fetch('/api/enquiry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'Something went wrong');
        form.reset();
        msg.textContent = 'Thank you! Our team will contact you shortly.';
        msg.classList.add('ok');
      } catch (err) {
        msg.textContent = err.message;
        msg.classList.add('err');
      } finally {
        btn.disabled = false; btn.textContent = 'Request a demo';
      }
    });
  }

  // Rotating 3D network sphere + parallax floating cards
  function heroScene() {
    const canvas = $('#orbit');
    const visual = $('#heroVisual');
    const stack = $('#floatStack');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const css = getComputedStyle(document.documentElement);
    const colors = ['--primary', '--secondary', '--accent'].map(v => css.getPropertyValue(v).trim());
    const N = 140, pts = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = golden * i;
      pts.push({ x: Math.cos(th) * r, y, z: Math.sin(th) * r, c: colors[i % 7 === 0 ? 2 : i % 3 === 0 ? 1 : 0] });
    }
    let W, H, R, dpr, rotY = 0, rotX = -0.35, mx = 0, my = 0, running = true;
    const resize = () => {
      dpr = Math.min(devicePixelRatio || 1, 2);
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      R = Math.min(W, H) * 0.36;
    };
    resize();
    addEventListener('resize', resize);
    visual.addEventListener('pointermove', e => {
      const r = visual.getBoundingClientRect();
      mx = (e.clientX - r.left) / r.width - .5; my = (e.clientY - r.top) / r.height - .5;
      stack.style.transform = `rotateY(${mx * 16}deg) rotateX(${-my * 16}deg)`;
    });
    visual.addEventListener('pointerleave', () => { mx = my = 0; stack.style.transform = ''; });
    new IntersectionObserver(([en]) => { running = en.isIntersecting; if (running) requestAnimationFrame(frame); }).observe(canvas);

    const hexA = (hex, a) => {
      const h = hex.replace('#', '');
      const n = parseInt(h.length === 3 ? h.split('').map(x => x + x).join('') : h, 16);
      return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
    };

    function frame(t) {
      if (!running) return;
      ctx.clearRect(0, 0, W, H);
      if (!reducedMotion) rotY += 0.0026;
      const ry = rotY + mx * 0.6, rx = rotX + my * 0.4;
      const cy = Math.cos(ry), sy = Math.sin(ry), cx = Math.cos(rx), sx = Math.sin(rx);
      const proj = pts.map(p => {
        const x1 = p.x * cy - p.z * sy, z1 = p.x * sy + p.z * cy;
        const y2 = p.y * cx - z1 * sx, z2 = p.y * sx + z1 * cx;
        const k = 2.6 / (2.6 + z2);
        return { x: W / 2 + x1 * R * k, y: H / 2 + y2 * R * k, z: z2, c: p.c, k };
      });
      // core glow
      const g = ctx.createRadialGradient(W / 2, H / 2, R * .1, W / 2, H / 2, R * 1.25);
      g.addColorStop(0, hexA(colors[0], .18)); g.addColorStop(1, hexA(colors[0], 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(W / 2, H / 2, R * 1.25, 0, Math.PI * 2); ctx.fill();
      // links
      ctx.lineWidth = 1;
      for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
        const a = proj[i], b = proj[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < R * 0.28) {
          const depth = (2 - (a.z + b.z) / 2) / 3;
          ctx.strokeStyle = hexA(colors[0], (1 - d / (R * .28)) * .35 * depth);
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
      // nodes (back to front)
      proj.sort((a, b) => b.z - a.z).forEach(p => {
        const a = .25 + (1 - (p.z + 1) / 2) * .75;
        ctx.fillStyle = hexA(p.c, a);
        ctx.beginPath(); ctx.arc(p.x, p.y, 2.4 * p.k, 0, Math.PI * 2); ctx.fill();
      });
      // orbit rings with satellites
      [[1.35, .25, 0, colors[1]], [1.5, -.35, 2.1, colors[2]]].forEach(([rr, tiltA, off, col]) => {
        ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(tiltA);
        ctx.strokeStyle = hexA(col, .35); ctx.setLineDash([4, 6]);
        ctx.beginPath(); ctx.ellipse(0, 0, R * rr, R * rr * .32, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        const ang = (t || 0) / 2600 + off;
        ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 14;
        ctx.beginPath(); ctx.arc(Math.cos(ang) * R * rr, Math.sin(ang) * R * rr * .32, 6, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      });
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
})();
