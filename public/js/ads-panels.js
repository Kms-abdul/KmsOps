/* Large promo panels for partner apps, rendered from /api/ads `panel` data.
   KMSPanels.render(layout, data, { href }) — layout: brand | solutions | badge */
window.KMSPanels = (() => {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const color = (v, d) => (/^#[0-9a-f]{3,8}$/i.test(String(v || '').trim()) ? v.trim() : d);
  const img = u => (/^(\/(?!\/)|https?:\/\/)/i.test(String(u || '')) ? esc(u) : '');
  const words = s => String(s || '').split('•').map(x => x.trim()).filter(Boolean);
  const delay = i => `style="animation-delay:${(i * 0.08).toFixed(2)}s"`;

  function brand(p, href) {
    const head = words(p.motto).map((w, i) => `<span style="color:${['#12204A', '#1D6FE0', '#16A36A'][i % 3]}">${esc(w.replace(/\.?$/, '.'))}</span>`).join('');
    const chips = words(p.chips).map(esc).join('<i></i>');
    const nameParts = p.brand.split(' ');
    const name = nameParts.length > 1 ? `${esc(nameParts.slice(0, -1).join(' '))} <span>${esc(nameParts.at(-1))}</span>` : esc(p.brand);
    const host = p.host || {};
    const hc = color(host.accent, '#16A36A');
    const screen = img(host.image)
      ? `<img src="${img(host.image)}" alt="">`
      : `<div class="dash" style="--hc:${hc}">
          <div class="dash-side"><b>${esc(host.icon || '◆')} ${esc(host.name || p.brand)}</b><i></i><i></i><i></i><i></i><i></i><i></i></div>
          <div class="dash-main">
            <div class="dash-kpis">
              <span style="--k1:#16A36A;--k2:#3CC08A">₹24,500<small>Today's sales</small></span>
              <span style="--k1:#4C8DF0;--k2:#7FB2FA">128<small>Orders</small></span>
              <span style="--k1:#F28C38;--k2:#F7B267">12<small>Pending</small></span>
            </div>
            <div class="dash-chart">${Array.from({ length: 16 }, (_, i) => `<b style="height:${28 + Math.round(Math.abs(Math.sin(i * 1.3 + 0.6)) * 66)}%;animation-delay:${i * 50}ms"></b>`).join('')}</div>
            <div class="dash-items"><span></span><span></span><span></span></div>
          </div>
        </div>`;
    return `<div class="panel bp" style="--hc:${hc}">
      <a class="bp-logo rise" href="${href('/')}" target="_blank" rel="noopener">
        <img src="/img/logo-mark.svg" alt="">
        <span><span class="bp-name">${name}</span>${p.brandFull ? `<small class="bp-full">${esc(p.brandFull.toUpperCase())}</small>` : ''}</span>
      </a>
      ${chips ? `<div class="bp-chips rise" ${delay(1)}>${chips}</div>` : ''}
      <h2 class="bp-head rise" ${delay(2)}>${head}</h2>
      <p class="bp-text rise" ${delay(3)}>${esc(p.text)}</p>
      <div class="bp-feats rise" ${delay(4)}>
        <div class="bp-feat" style="--fc:#1D6FE0"><b>📊</b>Grow<br>Your Business</div>
        <div class="bp-feat" style="--fc:#16A36A"><b>⚙️</b>Automate<br>Operations</div>
        <div class="bp-feat" style="--fc:#F28C38"><b>👥</b>Connect<br>People &amp; Systems</div>
      </div>
      <a class="bp-devices rise" ${delay(5)} href="${href('/#products')}" target="_blank" rel="noopener" aria-label="See our applications">
        <div class="laptop"><div class="screen">${screen}</div><div class="base"></div></div>
        <div class="phone">${img(host.image) ? `<img src="${img(host.image)}" alt="">` : '<div class="phone-list"><span></span><span></span><span></span><span></span><span></span><span></span></div>'}</div>
      </a>
      ${p.script ? `<div class="bp-script rise" ${delay(7)}>${esc(p.script)}</div>` : ''}
    </div>`;
  }

  const ICONS = {
    industries: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/></svg>',
    businesses: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V4h8v3M3 12h18M10 12v2h4v-2"/></svg>',
    solutions: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 19c-1-3 0-6 3-9 3-3 7-5 11-5 0 4-2 8-5 11-3 3-6 4-9 3z"/><path d="M9 15l-3 3M14 8.5a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0"/></svg>'
  };

  function solutions(p, href) {
    const [t1, t2] = String(p.ecoTitle).split('|').map(x => x.trim());
    const items = p.solutions.map((x, i) => `<a class="sp-item rise" href="${href(x.link)}" target="_blank" rel="noopener" style="--a:${color(x.accent, '#1D6FE0')};animation-delay:${((i + 2) * 0.08).toFixed(2)}s">
        <span class="sp-ico">${esc(x.icon)}</span>
        <span class="sp-body"><b>${esc(x.title)}</b><small>${esc(x.text)}</small></span>
        <span class="sp-go">›</span>
      </a>`).join('');
    const stats = (p.stats || []).map((s, i) => `<div class="sp-stat">${Object.values(ICONS)[i % 3]}<div><b>${esc(s.value)}</b><small>${esc(s.label)}</small></div></div>`).join('');
    return `<div class="panel sp">
      <h2 class="sp-title rise"><span>${esc(t1)}</span>${t2 ? ` <span>${esc(t2)}</span>` : ''}</h2>
      <p class="sp-text rise" ${delay(1)}>${esc(p.ecoText)}</p>
      <div class="sp-list"><svg class="sp-curve" aria-hidden="true"><path fill="none" stroke="#C9D3E6" stroke-width="2"/></svg>${items}</div>
      ${stats ? `<div class="sp-stats rise" ${delay(p.solutions.length + 2)}>${stats}</div>` : ''}
    </div>`;
  }

  // Cards follow a gentle arc (indented most in the middle); a curve joins their dots
  function layoutCurve(root) {
    const list = root.querySelector('.sp-list');
    if (!list) return;
    const items = [...list.querySelectorAll('.sp-item')];
    const draw = () => {
      const n = items.length, depth = Math.min(34, list.clientWidth * 0.07);
      items.forEach((el, i) => (el.style.marginLeft = `${n > 1 ? Math.sin(Math.PI * i / (n - 1)) * depth : 0}px`));
      if (n < 2) return;
      // dot centres: each dot sits one list-padding to the left of its card (see .sp-item::before)
      const box = list.getBoundingClientRect();
      const pad = parseFloat(getComputedStyle(list).paddingLeft);
      const P = items.map(el => {
        const r = el.getBoundingClientRect();
        return [r.left - box.left - pad, r.top - box.top + r.height / 2];
      });
      // extend a little past the first and last dot, then draw a smooth Catmull-Rom curve
      const pts = [[P[0][0] - 8, P[0][1] - 40], ...P, [P.at(-1)[0] - 8, P.at(-1)[1] + 40]];
      let d = `M${pts[0][0]},${pts[0][1]}`;
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
        d += ` C${p1[0] + (p2[0] - p0[0]) / 6},${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6},${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]},${p2[1]}`;
      }
      list.querySelector('.sp-curve path').setAttribute('d', d);
    };
    draw();
    addEventListener('resize', draw);
    setTimeout(draw, 900); // after entrance animations settle
  }

  function badge(p, href) {
    return `<div class="kms-badge"><a href="${href('/')}" target="_blank" rel="noopener"><img src="/img/logo-mark.svg" alt="">A <span>${esc(p.brand)}</span>&nbsp;Product</a></div>`;
  }

  function render(layout, data, { href }) {
    const p = data.panel;
    const html = { brand, solutions, badge }[layout](p, href);
    const stage = document.getElementById('stage');
    stage.innerHTML = html;
    if (layout === 'solutions') layoutCurve(stage);
  }

  return { render };
})();
