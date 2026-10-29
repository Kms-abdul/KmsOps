/* KmsOps admin panel — edits data/content.json through the admin API */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // Tiny DOM builder: h('div.cls', {attrs/on*}, ...children)
  function h(tag, props, ...children) {
    const [name, ...classes] = tag.split('.');
    const el = document.createElement(name || 'div');
    if (classes.length) el.className = classes.join(' ');
    if (props != null && (typeof props !== 'object' || props instanceof Node || Array.isArray(props))) { children.unshift(props); props = null; }
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'class') el.className = v;
      else if (k === 'list' || k.startsWith('data-') || k === 'role' || !(k in el)) el.setAttribute(k, v === true ? '' : v);
      else el[k] = v;
    }
    for (const c of children.flat(Infinity)) if (c != null && c !== false) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
    return el;
  }

  const api = async (url, opts = {}) => {
    const res = await fetch(url, { credentials: 'same-origin', ...opts, headers: { ...(opts.body && !(opts.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...(opts.headers || {}) } });
    if (res.status === 401 && !url.endsWith('/login')) { showLogin(); throw new Error('Session expired — please sign in again'); }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  };

  let toastTimer;
  function toast(msg, isError) {
    const t = $('#toast');
    t.textContent = msg;
    t.className = `toast show${isError ? ' error' : ''}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.className = 'toast'), 2800);
  }

  const uid = p => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const slugify = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const bgUrl = u => `url("${String(u).replace(/["\\]/g, '')}")`;
  const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  const setPath = (o, p, v) => { const ks = p.split('.'); const last = ks.pop(); ks.reduce((a, k) => (a[k] ??= {}), o)[last] = v; };

  // ---------- Schemas ----------
  const COLLECTIONS = {
    products: {
      label: 'Applications', icon: '🧩', title: 'name', sub: p => [p.category, p.tagline].filter(Boolean).join(' · '), thumb: p => p.coverImage || (p.gallery || [])[0], emoji: 'icon',
      help: 'Your SaaS products (e.g. Kitchorea). Each one gets its own page at /product/<slug> with a screenshot gallery.',
      blank: () => ({ id: uid('p'), name: 'New application', slug: '', category: '', badge: '', icon: '✨', tagline: '', description: '', features: [], accent: '#4F5BD5', coverImage: '', gallery: [], demoLink: '', visible: true }),
      fields: [
        { k: 'name', label: 'Application name', req: true },
        { k: 'slug', label: 'Page URL', type: 'slug', from: 'name', hint: 'Used in the link: /product/<this>' },
        { k: 'category', label: 'Category', hint: 'e.g. Restaurant, Education, Inventory', list: 'categories' },
        { k: 'icon', label: 'Icon (emoji)', hint: 'Paste any emoji, e.g. 🍽️' },
        { k: 'badge', label: 'Badge', hint: 'Optional label like “New” or “Popular”' },
        { k: 'accent', label: 'Brand colour', type: 'color' },
        { k: 'tagline', label: 'Tagline', full: true },
        { k: 'description', label: 'Description', type: 'textarea', full: true },
        { k: 'features', label: 'Key features', type: 'list', full: true, hint: 'First 4 show on the home page card' },
        { k: 'coverImage', label: 'Cover image', type: 'image', full: true, hint: 'Main screenshot. Leave empty to show an auto-generated preview.' },
        { k: 'gallery', label: 'Screenshot gallery', type: 'gallery', full: true },
        { k: 'demoLink', label: 'Live demo link', type: 'url', full: true, hint: 'Optional — https://…' },
        { k: 'visible', label: 'Show on website', type: 'toggle' }
      ]
    },
    services: {
      label: 'Business services', icon: '💼', title: 'title', sub: x => x.summary, emoji: 'icon',
      help: 'Income tax, CA, GST, accounts, HR, payroll and any other services you provide.',
      blank: () => ({ id: uid('s'), title: 'New service', icon: '⭐', summary: '', features: [], visible: true }),
      fields: [
        { k: 'title', label: 'Service name', req: true },
        { k: 'icon', label: 'Icon (emoji)' },
        { k: 'summary', label: 'Short description', type: 'textarea', full: true },
        { k: 'features', label: 'Highlights (tags)', type: 'list', full: true },
        { k: 'visible', label: 'Show on website', type: 'toggle' }
      ]
    },
    industries: {
      label: 'Industries', icon: '🏢', title: 'name', sub: x => x.description, thumb: x => x.image, emoji: 'icon',
      help: 'Industries you serve — schools, restaurants, retail…',
      blank: () => ({ id: uid('i'), name: 'New industry', icon: '🏢', description: '', image: '', visible: true }),
      fields: [
        { k: 'name', label: 'Industry', req: true },
        { k: 'icon', label: 'Icon (emoji)' },
        { k: 'description', label: 'Description', type: 'textarea', full: true },
        { k: 'image', label: 'Background image (optional)', type: 'image', full: true },
        { k: 'visible', label: 'Show on website', type: 'toggle' }
      ]
    },
    workflows: {
      label: 'Automation workflows', icon: '⚙️', title: 'title', sub: x => (x.steps || []).join(' → '), emoji: 'icon',
      help: 'Automation examples shown as animated step pipelines.',
      blank: () => ({ id: uid('w'), title: 'New workflow', icon: '⚡', description: '', steps: ['Trigger', 'Action', 'Result'], visible: true }),
      fields: [
        { k: 'title', label: 'Workflow name', req: true },
        { k: 'icon', label: 'Icon (emoji)' },
        { k: 'description', label: 'Description', type: 'textarea', full: true },
        { k: 'steps', label: 'Steps (in order)', type: 'list', full: true },
        { k: 'visible', label: 'Show on website', type: 'toggle' }
      ]
    },
    process: {
      label: 'How we work', icon: '🧭', title: 'title', sub: x => x.text,
      help: 'The numbered steps of your onboarding process.',
      blank: () => ({ id: uid('pr'), title: 'New step', text: '' }),
      fields: [
        { k: 'title', label: 'Step title', req: true },
        { k: 'text', label: 'Description', type: 'textarea', full: true }
      ]
    },
    stats: {
      label: 'Numbers', icon: '📈', title: x => `${x.value}${x.suffix || ''}`, sub: x => x.label,
      help: 'Headline numbers. The first three also appear in the hero.',
      blank: () => ({ id: uid('st'), value: '100', suffix: '+', label: 'New metric' }),
      fields: [
        { k: 'value', label: 'Number', hint: 'Digits only, e.g. 500 or 99.9' },
        { k: 'suffix', label: 'Suffix', hint: 'e.g. + or % or k+' },
        { k: 'label', label: 'Label', full: true }
      ]
    },
    testimonials: {
      label: 'Testimonials', icon: '💬', title: 'name', sub: x => x.quote, thumb: x => x.avatar,
      help: 'Customer quotes shown in the 3D carousel.',
      blank: () => ({ id: uid('t'), name: '', role: '', company: '', quote: '', avatar: '', visible: true }),
      fields: [
        { k: 'name', label: 'Name', req: true },
        { k: 'role', label: 'Role' },
        { k: 'company', label: 'Company', full: true },
        { k: 'quote', label: 'Quote', type: 'textarea', full: true },
        { k: 'avatar', label: 'Photo (optional)', type: 'image', full: true },
        { k: 'visible', label: 'Show on website', type: 'toggle' }
      ]
    },
    faqs: {
      label: 'FAQs', icon: '❓', title: 'q', sub: x => x.a,
      help: 'Frequently asked questions.',
      blank: () => ({ id: uid('f'), q: 'New question?', a: '', visible: true }),
      fields: [
        { k: 'q', label: 'Question', req: true, full: true },
        { k: 'a', label: 'Answer', type: 'textarea', full: true },
        { k: 'visible', label: 'Show on website', type: 'toggle' }
      ]
    }
  };

  const SETTINGS = [
    { title: 'Brand', desc: 'Name and logo shown across the site.', fields: [
      { k: 'brand', label: 'Company name' },
      { k: 'brandFull', label: 'Full name (under the logo)', hint: 'e.g. Key Management Solutions — leave empty to hide' },
      { k: 'brandMotto', label: 'Motto (footer)', hint: 'Separate words with • e.g. Build • Automate • Operate' },
      { k: 'tagline', label: 'Tagline', full: true },
      { k: 'logoImage', label: 'Logo image (optional — replaces the generated logo)', type: 'image', full: true }
    ] },
    { title: 'Hero section', desc: 'The first thing visitors see.', fields: [
      { k: 'heroEyebrow', label: 'Small label above title', full: true },
      { k: 'heroTitle', label: 'Title' },
      { k: 'heroHighlight', label: 'Highlighted words (gradient)' },
      { k: 'heroSubtitle', label: 'Subtitle', type: 'textarea', full: true },
      { k: 'heroCtaPrimary', label: 'Primary button text' },
      { k: 'heroCtaSecondary', label: 'Secondary button text' }
    ] },
    { title: 'Colours', desc: 'Main colours of the website. Mid-tone colours work best.', fields: [
      { k: 'theme.primary', label: 'Primary', type: 'color' },
      { k: 'theme.secondary', label: 'Secondary', type: 'color' },
      { k: 'theme.accent', label: 'Accent', type: 'color' }
    ] },
    { title: 'Contact', desc: 'Shown in the contact section and footer.', fields: [
      { k: 'email', label: 'Email' },
      { k: 'phone', label: 'Phone' },
      { k: 'whatsapp', label: 'WhatsApp number', hint: 'With country code, digits only — e.g. 919876543210' },
      { k: 'address', label: 'Address' },
      { k: 'footerNote', label: 'Footer text', type: 'textarea', full: true }
    ] },
    { title: 'Social links', desc: 'Full URLs. Leave empty to hide.', fields: [
      { k: 'social.linkedin', label: 'LinkedIn', type: 'url' },
      { k: 'social.instagram', label: 'Instagram', type: 'url' },
      { k: 'social.facebook', label: 'Facebook', type: 'url' },
      { k: 'social.twitter', label: 'X / Twitter', type: 'url' },
      { k: 'social.youtube', label: 'YouTube', type: 'url' }
    ] },
    { title: 'Sections', desc: 'Turn whole sections of the home page on or off.', fields:
      ['products', 'services', 'industries', 'workflows', 'process', 'testimonials', 'faqs', 'contact'].map(k => ({ k: `sections.${k}`, label: COLLECTIONS[k]?.label || (k === 'contact' ? 'Contact form' : k), type: 'toggle', defaultOn: true }))
    }
  ];

  const NAV = [
    { group: 'Overview' }, { id: 'dashboard', label: 'Dashboard', icon: '🏠' }, { id: 'enquiries', label: 'Enquiries', icon: '📥' },
    { group: 'Website content' }, { id: 'settings', label: 'Site settings', icon: '🎨' },
    ...['products', 'services', 'industries', 'workflows', 'process', 'stats', 'testimonials', 'faqs'].map(id => ({ id, label: COLLECTIONS[id].label, icon: COLLECTIONS[id].icon })),
    { group: 'System' }, { id: 'media', label: 'Media library', icon: '🖼️' }, { id: 'backups', label: 'Backups', icon: '🕘' }, { id: 'account', label: 'Account', icon: '🔐' }
  ];

  // ---------- State ----------
  let content = null, savedJson = '', me = null, enquiries = [];
  const isDirty = () => content && JSON.stringify(content) !== savedJson;
  function markDirty() {
    const d = isDirty();
    $('#dirtyBadge').hidden = !d;
    $('#discardBtn').hidden = !d;
    $('#saveBtn').disabled = !d;
  }
  addEventListener('beforeunload', e => { if (isDirty()) { e.preventDefault(); e.returnValue = ''; } });

  // ---------- Auth ----------
  function showLogin() {
    $('#appView').hidden = true;
    $('#loginView').hidden = false;
    closeDrawer();
  }

  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    $('#loginErr').textContent = '';
    try {
      me = await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ username: f.get('username'), password: f.get('password') }) });
      e.target.reset();
      await boot();
    } catch (err) { $('#loginErr').textContent = err.message; }
  });

  $('#logoutBtn').addEventListener('click', async () => {
    if (isDirty() && !confirm('You have unsaved changes. Sign out anyway?')) return;
    await api('/api/admin/logout', { method: 'POST' }).catch(() => {});
    content = null; showLogin();
  });

  async function boot() {
    try {
      me = await api('/api/admin/me');
    } catch { return showLogin(); }
    const [c, enq] = await Promise.all([api('/api/admin/content'), api('/api/admin/enquiries')]);
    content = c; enquiries = enq;
    for (const k of Object.keys(COLLECTIONS)) content[k] ??= [];
    content.settings ??= {};
    savedJson = JSON.stringify(content);
    $('#loginView').hidden = true;
    $('#appView').hidden = false;
    markDirty();
    route();
  }

  // ---------- Save ----------
  async function save() {
    // validation
    const slugs = new Set();
    for (const p of content.products) {
      p.slug = slugify(p.slug || p.name) || p.id;
      if (slugs.has(p.slug)) { toast(`Two applications use the URL “${p.slug}”. Please change one.`, true); return location.hash = '#/products'; }
      slugs.add(p.slug);
    }
    for (const k of Object.keys(COLLECTIONS)) content[k].forEach((x, i) => (x.order = i + 1));
    const btn = $('#saveBtn');
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      const r = await api('/api/admin/content', { method: 'PUT', body: JSON.stringify(content) });
      content.updatedAt = r.updatedAt;
      savedJson = JSON.stringify(content);
      toast('Saved — your website is updated ✓');
    } catch (err) { toast(err.message, true); }
    btn.textContent = 'Save & publish';
    markDirty();
  }
  $('#saveBtn').addEventListener('click', save);
  addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); if (isDirty()) save(); } });
  $('#discardBtn').addEventListener('click', () => {
    if (!confirm('Discard all unsaved changes?')) return;
    content = JSON.parse(savedJson); markDirty(); closeDrawer(); route();
  });

  // ---------- Router ----------
  addEventListener('hashchange', route);
  $('#menuBtn').addEventListener('click', () => $('#side').classList.toggle('open'));

  function renderNav(active) {
    const unread = enquiries.filter(e => !e.read).length;
    $('#sideNav').replaceChildren(...NAV.map(n => n.group
      ? h('div.group', n.group)
      : h('a', { href: `#/${n.id}`, class: n.id === active ? 'active' : null, onclick: () => $('#side').classList.remove('open') },
          h('span', n.icon), n.label, n.id === 'enquiries' && unread ? h('span.count', unread) : null)));
  }

  function route() {
    if (!content) return;
    const id = location.hash.replace(/^#\/?/, '') || 'dashboard';
    const nav = NAV.find(n => n.id === id) || NAV[1];
    renderNav(nav.id);
    $('#pageTitle').textContent = nav.label;
    const view = $('#view');
    view.replaceChildren();
    const pages = { dashboard: pageDashboard, enquiries: pageEnquiries, settings: pageSettings, media: pageMedia, backups: pageBackups, account: pageAccount };
    (pages[nav.id] || (v => pageCollection(v, nav.id)))(view);
    $('.main').scrollTo?.(0, 0); scrollTo(0, 0);
  }

  // ---------- Field rendering ----------
  function field(obj, f, onChange) {
    const path = f.k;
    const get = () => getPath(obj, path);
    const set = v => { setPath(obj, path, v); onChange?.(); markDirty(); };
    const wrap = (...kids) => h('div.field', { class: `field${f.full ? ' full' : ''}` }, h('span', f.label), ...kids, f.hint ? h('span.hint', f.hint) : null);

    switch (f.type) {
      case 'textarea':
        return wrap(h('textarea', { value: get() ?? '', rows: 4, oninput: e => set(e.target.value) }));
      case 'toggle': {
        const v = get();
        return h('div.field', { class: `field${f.full ? ' full' : ''}` },
          h('label.switch', h('input', { type: 'checkbox', checked: f.defaultOn ? v !== false : !!v, onchange: e => set(e.target.checked) }), f.label));
      }
      case 'color': {
        const txt = h('input', { type: 'text', value: get() || '#4F5BD5', maxLength: 7 });
        const pick = h('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(get()) ? get() : '#4F5BD5' });
        pick.addEventListener('input', () => { txt.value = pick.value.toUpperCase(); set(txt.value); });
        txt.addEventListener('input', () => { if (/^#[0-9a-f]{6}$/i.test(txt.value)) { pick.value = txt.value; set(txt.value.toUpperCase()); } });
        return wrap(h('div.color-row', pick, txt));
      }
      case 'slug': {
        const inp = h('input', { type: 'text', value: get() || '', placeholder: slugify(obj[f.from]) || 'auto', oninput: e => set(slugify(e.target.value)) });
        inp.addEventListener('blur', () => (inp.value = get() || ''));
        return wrap(inp);
      }
      case 'list': return wrap(listEditor(get() || [], v => set(v)));
      case 'image': return wrap(imageField(get(), v => set(v)));
      case 'gallery': return wrap(galleryField(get() || [], v => set(v)));
      default: {
        const listId = f.list ? `dl-${f.list}` : null;
        const inp = h('input', { type: f.type === 'url' ? 'url' : 'text', value: get() ?? '', required: f.req, list: listId, oninput: e => set(e.target.value) });
        const dl = f.list === 'categories' ? h('datalist', { id: listId }, [...new Set(content.products.map(p => p.category).filter(Boolean))].map(c => h('option', { value: c }))) : null;
        return wrap(inp, dl);
      }
    }
  }

  function listEditor(arr, onSet) {
    const box = h('div.list-edit');
    const draw = () => {
      box.replaceChildren(
        ...arr.map((v, i) => h('div.list-row',
          h('input', { type: 'text', value: v, oninput: e => { arr[i] = e.target.value; onSet(arr); },
            onkeydown: e => { if (e.key === 'Enter') { e.preventDefault(); arr.splice(i + 1, 0, ''); onSet(arr); draw(); box.querySelectorAll('input')[i + 1]?.focus(); } } }),
          h('button.icon-btn', { type: 'button', title: 'Move up', disabled: i === 0, onclick: () => { [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; onSet(arr); draw(); } }, '↑'),
          h('button.icon-btn.danger', { type: 'button', title: 'Remove', onclick: () => { arr.splice(i, 1); onSet(arr); draw(); } }, '×'))),
        h('button.btn.sm', { type: 'button', onclick: () => { arr.push(''); onSet(arr); draw(); box.querySelectorAll('input')[arr.length - 1]?.focus(); } }, '+ Add item'));
    };
    draw();
    return box;
  }

  // Large photos are resized in the browser (max 2400px, re-encoded) so uploads
  // stay fast and under the hosting request-size limit. GIF/SVG are left untouched.
  const MAX_SIDE = 2400, SHRINK_OVER = 1.5 * 1024 * 1024;
  async function shrinkImage(file) {
    if (!/^image\/(jpeg|png|webp|avif)$/.test(file.type)) return file;
    let bmp;
    try { bmp = await createImageBitmap(file); } catch { return file; }
    const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size <= SHRINK_OVER) { bmp.close(); return file; }
    const cv = document.createElement('canvas');
    cv.width = Math.round(bmp.width * scale);
    cv.height = Math.round(bmp.height * scale);
    cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
    bmp.close();
    const out = await new Promise(r => cv.toBlob(r, 'image/webp', 0.86));
    if (!out || out.size >= file.size) return file;
    return new File([out], file.name.replace(/\.\w+$/, '') + '.webp', { type: 'image/webp' });
  }

  async function uploadFiles(files) {
    const list = [...files].filter(f => f.type.startsWith('image/'));
    if (!list.length) { toast('Please choose image files', true); return []; }
    const urls = [];
    for (const [i, original] of list.entries()) {
      toast(`Uploading ${i + 1} of ${list.length}…`);
      try {
        const fd = new FormData();
        fd.append('images', await shrinkImage(original));
        const r = await api('/api/admin/upload', { method: 'POST', body: fd });
        urls.push(...r.files);
      } catch (err) { toast(`${original.name}: ${err.message}`, true); }
    }
    if (urls.length) toast(`Uploaded ${urls.length} image${urls.length > 1 ? 's' : ''} ✓`);
    return urls;
  }

  function filePicker(multiple, cb) {
    const inp = h('input', { type: 'file', accept: 'image/*', multiple, hidden: true });
    inp.addEventListener('change', async () => { cb(await uploadFiles(inp.files)); inp.remove(); });
    document.body.append(inp);
    inp.click();
  }

  function imageField(value, onSet) {
    const box = h('div.img-field');
    const draw = () => {
      const prev = h('div.img-prev', value ? { style: { backgroundImage: bgUrl(value) } } : null, value ? '' : 'No image');
      box.replaceChildren(prev, h('div.img-btns',
        h('button.btn.sm', { type: 'button', onclick: () => filePicker(false, urls => { if (urls[0]) { value = urls[0]; onSet(value); draw(); } }) }, '⬆ Upload'),
        h('button.btn.sm', { type: 'button', onclick: async () => { const u = await openMedia(false); if (u[0]) { value = u[0]; onSet(value); draw(); } } }, '🖼 Library'),
        value ? h('button.btn.sm.danger', { type: 'button', onclick: () => { value = ''; onSet(''); draw(); } }, 'Remove') : null));
    };
    box.addEventListener('dragover', e => e.preventDefault());
    box.addEventListener('drop', async e => { e.preventDefault(); const u = await uploadFiles(e.dataTransfer.files); if (u[0]) { value = u[0]; onSet(value); draw(); } });
    draw();
    return box;
  }

  function galleryField(arr, onSet) {
    const box = h('div.gallery-edit');
    const add = urls => { arr.push(...urls); onSet(arr); draw(); };
    const draw = () => {
      const adder = h('div.g-add', { tabIndex: 0, role: 'button', onclick: () => filePicker(true, add) }, h('span', '⬆ Upload images', h('br'), h('small', 'or drop files here')));
      adder.addEventListener('dragover', e => { e.preventDefault(); adder.classList.add('over'); });
      adder.addEventListener('dragleave', () => adder.classList.remove('over'));
      adder.addEventListener('drop', async e => { e.preventDefault(); adder.classList.remove('over'); add(await uploadFiles(e.dataTransfer.files)); });
      box.replaceChildren(
        ...arr.map((u, i) => h('div.g-item', { style: { backgroundImage: bgUrl(u) } }, h('div.g-ctrl',
          h('button', { type: 'button', title: 'Move left', onclick: () => { if (i) { [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; onSet(arr); draw(); } } }, '◀'),
          h('button', { type: 'button', title: 'Remove', onclick: () => { arr.splice(i, 1); onSet(arr); draw(); } }, '🗑'),
          h('button', { type: 'button', title: 'Move right', onclick: () => { if (i < arr.length - 1) { [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; onSet(arr); draw(); } } }, '▶')))),
        adder,
        h('div.g-add', { tabIndex: 0, role: 'button', onclick: async () => add(await openMedia(true)) }, '🖼 Pick from library'));
    };
    draw();
    return box;
  }

  // ---------- Media library ----------
  let mediaResolve = null, mediaSel = [], mediaMultiple = false;
  async function loadMediaGrid(selectable) {
    const grid = $('#mediaGrid');
    const files = await api('/api/admin/uploads');
    grid.replaceChildren(...(files.length ? files.map(f => {
      const el = h('div.m-item', { style: { backgroundImage: bgUrl(f.url) }, title: f.url.split('/').pop(), 'data-url': f.url },
        h('button.m-del', { type: 'button', title: 'Delete file', onclick: async e => {
          e.stopPropagation();
          if (!confirm('Delete this image permanently? Pages using it will show no image.')) return;
          await api(`/api/admin/uploads/${encodeURIComponent(f.url.split('/').pop())}`, { method: 'DELETE' });
          mediaSel = mediaSel.filter(x => x !== f.url);
          loadMediaGrid(selectable);
        } }, '🗑'));
      if (mediaSel.includes(f.url)) el.classList.add('sel');
      if (selectable) el.addEventListener('click', () => {
        if (!mediaMultiple) mediaSel = [];
        mediaSel = mediaSel.includes(f.url) ? mediaSel.filter(x => x !== f.url) : [...mediaSel, f.url];
        $$('.m-item', grid).forEach(x => x.classList.toggle('sel', mediaSel.includes(x.dataset.url)));
        $('#mediaUse').disabled = !mediaSel.length;
        $('#mediaHint').textContent = mediaSel.length ? `${mediaSel.length} selected` : '';
      });
      return el;
    }) : [h('p.muted', 'No images uploaded yet.')]));
  }

  function openMedia(multiple) {
    mediaMultiple = multiple; mediaSel = [];
    $('#mediaUse').disabled = true; $('#mediaUse').hidden = false;
    $('#mediaHint').textContent = multiple ? 'Click to select several images' : 'Click an image to select it';
    $('#mediaWrap').hidden = false;
    loadMediaGrid(true);
    return new Promise(res => (mediaResolve = res));
  }
  function closeMedia(result = []) {
    $('#mediaWrap').hidden = true;
    mediaResolve?.(result); mediaResolve = null;
  }
  $('#mediaClose').onclick = () => closeMedia();
  $('#mediaWrap').addEventListener('click', e => { if (e.target.id === 'mediaWrap') closeMedia(); });
  $('#mediaUse').onclick = () => closeMedia(mediaSel);
  $('#mediaInput').addEventListener('change', async e => {
    const u = await uploadFiles(e.target.files);
    e.target.value = '';
    mediaSel = mediaMultiple ? [...mediaSel, ...u] : u.slice(0, 1);
    $('#mediaUse').disabled = !mediaSel.length;
    loadMediaGrid(!!mediaResolve);
  });
  const drop = $('#mediaDrop');
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', async e => {
    e.preventDefault(); drop.classList.remove('over');
    const u = await uploadFiles(e.dataTransfer.files);
    mediaSel = mediaMultiple ? [...mediaSel, ...u] : u.slice(0, 1);
    $('#mediaUse').disabled = !mediaSel.length;
    loadMediaGrid(!!mediaResolve);
  });

  // ---------- Drawer ----------
  let drawerOnClose = null;
  function openDrawer(title, body, onClose) {
    $('#drawerTitle').textContent = title;
    $('#drawerBody').replaceChildren(body);
    $('#drawerWrap').hidden = false;
    drawerOnClose = onClose;
    setTimeout(() => $('#drawerBody input, #drawerBody textarea')?.focus(), 50);
  }
  function closeDrawer() {
    if ($('#drawerWrap').hidden) return;
    $('#drawerWrap').hidden = true;
    drawerOnClose?.(); drawerOnClose = null;
  }
  $('#drawerClose').onclick = closeDrawer;
  $('#drawerDone').onclick = closeDrawer;
  $('#drawerWrap').addEventListener('click', e => { if (e.target.id === 'drawerWrap') closeDrawer(); });
  addEventListener('keydown', e => { if (e.key === 'Escape') { if (!$('#mediaWrap').hidden) closeMedia(); else closeDrawer(); } });

  // ---------- Pages ----------
  function pageDashboard(v) {
    if (me?.mustChange) v.append(h('div.banner', 'You are using the default password. ', h('a', { href: '#/account' }, 'Change it now'), ' to keep your site secure.'));
    const unread = enquiries.filter(e => !e.read).length;
    const kpi = (icon, n, label, to) => h('div.kpi', { onclick: () => (location.hash = to) }, h('i', icon), h('b', n), h('span', label));
    v.append(h('div.kpis',
      kpi('🧩', content.products.length, 'Applications', '#/products'),
      kpi('💼', content.services.length, 'Services', '#/services'),
      kpi('📥', unread, 'New enquiries', '#/enquiries'),
      kpi('🏢', content.industries.length, 'Industries', '#/industries')));
    v.append(h('div.card', h('h3', 'Quick start'), h('p.muted', 'Everything on the website is editable here. Make changes, then press “Save & publish” (or Ctrl+S).'),
      h('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap' } },
        h('button.btn.primary', { onclick: () => { location.hash = '#/products'; setTimeout(() => addItem('products'), 50); } }, '+ Add an application'),
        h('a.btn', { href: '#/settings' }, '🎨 Edit hero & colours'),
        h('a.btn', { href: '#/media' }, '🖼 Upload images'),
        h('a.btn', { href: '/', target: '_blank' }, '↗ View website'))));
    if (enquiries.length) {
      v.append(h('div.card', h('h3', 'Latest enquiries'), h('p.muted', ''),
        h('table.table', h('tbody', enquiries.slice(0, 5).map(e => h('tr', { class: e.read ? null : 'unread' },
          h('td', h('b', e.name), h('br'), h('small.muted', e.email || e.phone)), h('td', h('span.pill', e.interest || 'General')), h('td.muted', new Date(e.createdAt).toLocaleString())))))));
    }
    if (content.updatedAt) v.append(h('p.muted.small', `Last published: ${new Date(content.updatedAt).toLocaleString()}`));
  }

  function pageSettings(v) {
    const s = content.settings;
    SETTINGS.forEach(sec => v.append(h('div.card', h('h3', sec.title), h('p.muted', sec.desc), h('div.form-grid', sec.fields.map(f => field(s, f))))));
  }

  function pageCollection(v, key) {
    const cfg = COLLECTIONS[key];
    const arr = content[key];
    const titleOf = x => (typeof cfg.title === 'function' ? cfg.title(x) : x[cfg.title]) || '(untitled)';
    v.append(h('div.list-head', h('p.muted', cfg.help), h('button.btn.primary', { onclick: () => addItem(key) }, `+ Add ${cfg.label.toLowerCase().replace(/s$/, '')}`)));
    if (!arr.length) return v.append(h('div.empty', `No ${cfg.label.toLowerCase()} yet.`));
    v.append(h('div.items', arr.map((x, i) => {
      const thumb = cfg.thumb?.(x);
      const visibleToggle = 'visible' in x;
      return h('div.item', { class: x.visible === false ? 'hidden-item' : null },
        h('div.thumb', thumb ? { style: { backgroundImage: bgUrl(thumb) } } : null, thumb ? '' : (cfg.emoji ? x[cfg.emoji] : '') || cfg.icon),
        h('div.item-main', { onclick: () => editItem(key, x) }, h('b', titleOf(x)), h('small', (cfg.sub?.(x) || '').slice(0, 110))),
        h('div.item-actions',
          visibleToggle ? h('label.switch', { title: 'Show on website' }, h('input', { type: 'checkbox', checked: x.visible !== false, onchange: e => { x.visible = e.target.checked; markDirty(); route(); } })) : null,
          key === 'products' ? h('a.icon-btn', { href: `/product/${encodeURIComponent(x.slug || slugify(x.name))}`, target: '_blank', title: 'Preview page (saved version)' }, '↗') : null,
          h('button.icon-btn', { title: 'Move up', disabled: i === 0, onclick: () => { [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; markDirty(); route(); } }, '↑'),
          h('button.icon-btn', { title: 'Move down', disabled: i === arr.length - 1, onclick: () => { [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; markDirty(); route(); } }, '↓'),
          h('button.icon-btn', { title: 'Duplicate', onclick: () => { const copy = JSON.parse(JSON.stringify(x)); copy.id = uid(key[0]); if ('slug' in copy) copy.slug = ''; if (cfg.title && typeof cfg.title === 'string') copy[cfg.title] = `${copy[cfg.title]} (copy)`; arr.splice(i + 1, 0, copy); markDirty(); route(); } }, '⧉'),
          h('button.btn.sm', { onclick: () => editItem(key, x) }, 'Edit'),
          h('button.icon-btn.danger', { title: 'Delete', onclick: () => { if (confirm(`Delete “${titleOf(x)}”?`)) { arr.splice(i, 1); markDirty(); route(); } } }, '🗑')));
    })));
  }

  function addItem(key) {
    const x = COLLECTIONS[key].blank();
    content[key].push(x);
    markDirty();
    route();
    editItem(key, x);
  }

  function editItem(key, x) {
    const cfg = COLLECTIONS[key];
    const form = h('div.form-grid', cfg.fields.map(f => field(x, f)));
    openDrawer(`Edit ${cfg.label.toLowerCase().replace(/s$/, '')}`, form, () => {
      if (key === 'products' && !x.slug) x.slug = slugify(x.name);
      markDirty(); route();
    });
  }

  function pageEnquiries(v) {
    if (!enquiries.length) return v.append(h('div.empty', 'No enquiries yet. Messages from the website contact form will appear here.'));
    v.append(h('div.card', h('table.table',
      h('thead', h('tr', h('th', 'From'), h('th', 'Interest'), h('th', 'Message'), h('th', 'Received'), h('th', ''))),
      h('tbody', enquiries.map(e => h('tr', { class: e.read ? null : 'unread' },
        h('td', h('b', e.name), e.company ? h('div.muted.small', e.company) : null,
          e.email ? h('div', h('a', { href: `mailto:${e.email}` }, e.email)) : null,
          e.phone ? h('div', h('a', { href: `tel:${e.phone}` }, e.phone)) : null),
        h('td', h('span.pill', e.interest || 'General')),
        h('td', h('div.msg', e.message || '—')),
        h('td.muted.small', new Date(e.createdAt).toLocaleString()),
        h('td', h('div.item-actions',
          h('button.btn.sm', { onclick: async () => { await api(`/api/admin/enquiries/${e.id}`, { method: 'PATCH', body: JSON.stringify({ read: !e.read }) }); e.read = !e.read; route(); } }, e.read ? 'Mark unread' : 'Mark read'),
          h('button.icon-btn.danger', { title: 'Delete', onclick: async () => { if (!confirm('Delete this enquiry?')) return; await api(`/api/admin/enquiries/${e.id}`, { method: 'DELETE' }); enquiries = enquiries.filter(z => z !== e); route(); } }, '🗑')))))))));
  }

  function pageMedia(v) {
    const zone = h('label.dropzone', h('b', 'Drop images here'), ' or click to upload', h('small', 'Uploaded images can be used for applications, galleries, industries and the logo.'));
    const inp = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true });
    zone.append(inp);
    const grid = h('div.media-grid');
    const load = async () => {
      const files = await api('/api/admin/uploads');
      grid.replaceChildren(...(files.length ? files.map(f => h('div.m-item', { style: { backgroundImage: bgUrl(f.url) }, title: `${f.url}  (${Math.round(f.size / 1024)} KB)` },
        h('button.m-del', { type: 'button', title: 'Delete', onclick: async () => {
          if (!confirm('Delete this image permanently?')) return;
          await api(`/api/admin/uploads/${encodeURIComponent(f.url.split('/').pop())}`, { method: 'DELETE' }); load();
        } }, '🗑'))) : [h('p.muted', 'No images uploaded yet.')]));
    };
    inp.addEventListener('change', async () => { await uploadFiles(inp.files); inp.value = ''; load(); });
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('over'));
    zone.addEventListener('drop', async e => { e.preventDefault(); zone.classList.remove('over'); await uploadFiles(e.dataTransfer.files); load(); });
    v.append(h('div.card', zone, h('div', { style: { height: '16px' } }), grid));
    load();
  }

  async function pageBackups(v) {
    const card = h('div.card', h('h3', 'Automatic backups'), h('p.muted', 'A copy of your content is saved every time you publish (last 30 kept). Restore one to roll back.'));
    v.append(card);
    const list = await api('/api/admin/backups');
    if (!list.length) return card.append(h('div.empty', 'No backups yet — one is created on your next save.'));
    const fmt = n => { const m = n.match(/content-(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})/); return m ? new Date(`${m[1]}T${m[2]}:${m[3]}:${m[4]}Z`).toLocaleString() : n; };
    card.append(h('div.items', list.map(n => h('div.item', h('div.thumb', '🕘'), h('div.item-main', h('b', fmt(n)), h('small', n)),
      h('button.btn.sm', { onclick: async () => {
        if (!confirm(`Restore the version from ${fmt(n)}? Current content will be backed up first.`)) return;
        await api(`/api/admin/backups/${encodeURIComponent(n)}/restore`, { method: 'POST' });
        toast('Restored ✓'); await boot();
      } }, 'Restore')))));
  }

  function pageAccount(v) {
    const msg = h('p.err');
    const form = h('form.form-grid',
      h('label.full', 'Username', h('input', { name: 'newUsername', value: me?.username || '', autocomplete: 'username' })),
      h('label.full', 'Current password', h('input', { name: 'currentPassword', type: 'password', required: true, autocomplete: 'current-password' })),
      h('label', 'New password', h('input', { name: 'newPassword', type: 'password', required: true, minLength: 8, autocomplete: 'new-password' })),
      h('label', 'Confirm new password', h('input', { name: 'confirm', type: 'password', required: true, autocomplete: 'new-password' })),
      h('div.full', h('button.btn.primary', { type: 'submit' }, 'Update account'), msg));
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(form));
      msg.textContent = '';
      if (f.newPassword !== f.confirm) return (msg.textContent = 'New passwords do not match');
      try {
        await api('/api/admin/account', { method: 'POST', body: JSON.stringify(f) });
        me = await api('/api/admin/me');
        form.reset(); form.newUsername.value = me.username;
        toast('Account updated ✓');
      } catch (err) { msg.textContent = err.message; }
    });
    v.append(h('div.card', h('h3', 'Admin account'), h('p.muted', 'Use a strong password of at least 8 characters.'), form));
  }

  boot();
})();
