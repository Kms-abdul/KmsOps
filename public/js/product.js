/* Product detail page: /product/:slug */
(async () => {
  const { esc, safeUrl, $, $$ } = KMS;
  KMS.navBehaviour();

  const slug = decodeURIComponent(location.pathname.split('/').filter(Boolean)[1] || '');
  let c;
  try { c = await KMS.loadContent(); } catch { return; }
  const s = c.settings || {};
  KMS.applyTheme(s);
  KMS.renderBrand(s);
  KMS.renderFooter(c);

  const products = c.products || [];
  const p = products.find(x => x.slug === slug);
  if (!p) {
    $('#productMain').innerHTML = `<section class="section"><div class="container section-head">
      <h2>Application not found</h2><p>It may have been renamed or removed.</p><br>
      <a class="btn btn-primary" href="/#products">See all applications</a></div></section>`;
    return;
  }

  document.title = `${p.name} — ${s.brand || 'KmsOps'}`;
  document.body.style.setProperty('--c', KMS.color(p.accent));
  const demoHref = `/?interest=${encodeURIComponent(p.name)}#contact`;
  $('#pDemoBtn').href = demoHref;
  $('#navDemo').href = demoHref;
  $('#pIcon').textContent = p.icon || '◆';
  $('#pCat').textContent = p.category || '';
  $('#pName').textContent = p.name;
  $('#pTagline').textContent = p.tagline || '';
  $('#pDesc').textContent = p.description || '';
  if (safeUrl(p.demoLink)) { $('#pLiveBtn').href = p.demoLink; $('#pLiveBtn').hidden = false; }

  const images = [p.coverImage, ...(p.gallery || [])].filter(u => safeUrl(u)).filter((u, i, a) => a.indexOf(u) === i);

  // 3D device stage — cover image with gallery images fanned behind it
  const device = $('#device');
  const behind = images.slice(1, 3).map((u, i) => `<div class="layer l${i + 1}"><img src="${safeUrl(u)}" alt=""></div>`).join('');
  device.innerHTML = `${behind}<div class="layer front">${images[0] ? `<img src="${safeUrl(images[0])}" alt="${esc(p.name)}">` : `<div class="pcard-media">${KMS.mockup()}</div>`}</div>`;
  const stage = $('#deviceStage');
  if (!KMS.reducedMotion) {
    stage.addEventListener('pointermove', e => {
      const r = stage.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      device.style.transform = `rotateY(${-14 + x * 18}deg) rotateX(${8 - y * 14}deg)`;
    });
    stage.addEventListener('pointerleave', () => (device.style.transform = ''));
  }

  // Features
  const feats = p.features || [];
  if (feats.length) {
    $('#pFeatures').innerHTML = feats.map((f, i) => `<div class="feature reveal"><span class="fnum">${String(i + 1).padStart(2, '0')}</span><p>${esc(f)}</p></div>`).join('');
  } else $('#pFeaturesSec').remove();

  // Gallery + lightbox
  if (images.length) {
    let cur = 0;
    const main = $('#gMain'), thumbs = $('#gThumbs');
    const show = i => {
      cur = (i + images.length) % images.length;
      main.innerHTML = `<img src="${safeUrl(images[cur])}" alt="${esc(p.name)} screenshot ${cur + 1}">`;
      $$('button', thumbs).forEach((b, j) => b.classList.toggle('active', j === cur));
    };
    thumbs.innerHTML = images.map((u, i) => `<button aria-label="Screenshot ${i + 1}"><img src="${safeUrl(u)}" alt="" loading="lazy"></button>`).join('');
    if (images.length < 2) thumbs.remove();
    else $$('button', thumbs).forEach((b, i) => b.addEventListener('click', () => show(i)));
    show(0);

    const lb = $('#lightbox'), lbImg = $('#lbImg');
    const openLb = () => { lbImg.src = images[cur]; lb.hidden = false; document.body.style.overflow = 'hidden'; };
    const closeLb = () => { lb.hidden = true; document.body.style.overflow = ''; };
    const step = d => { show(cur + d); lbImg.src = images[cur]; };
    main.addEventListener('click', openLb);
    $('#lbClose').onclick = closeLb;
    $('#lbPrev').onclick = () => step(-1);
    $('#lbNext').onclick = () => step(1);
    lb.addEventListener('click', e => { if (e.target === lb) closeLb(); });
    addEventListener('keydown', e => {
      if (lb.hidden) return;
      if (e.key === 'Escape') closeLb();
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
    });
    if (images.length < 2) { $('#lbPrev').remove(); $('#lbNext').remove(); }
  } else $('#pGallerySec').remove();

  // Other products
  const others = products.filter(x => x !== p).slice(0, 3);
  if (others.length) {
    $('#pOthers').innerHTML = others.map(o => {
      const img = safeUrl(o.coverImage || (o.gallery || [])[0]);
      return `<a class="pcard reveal" href="/product/${encodeURIComponent(o.slug)}" style="--c:${KMS.color(o.accent)}">
        <span class="glare"></span>
        <div class="pcard-media">${img ? `<img src="${img}" alt="" loading="lazy">` : KMS.mockup()}</div>
        <div class="pcard-body"><div class="pcard-top"><span class="app-icon">${esc(o.icon || '◆')}</span>
          <div><span class="cat">${esc(o.category)}</span><h3>${esc(o.name)}</h3></div></div>
          <p>${esc(o.tagline)}</p><span class="more">Explore <i>→</i></span></div></a>`;
    }).join('');
    $$('#pOthers .pcard').forEach(el => KMS.tilt(el, 7));
  } else $('#pOtherSec').remove();

  KMS.reveal();
})();
