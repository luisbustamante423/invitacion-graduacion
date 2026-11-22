(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const byId = (id) => document.getElementById(id);
  const state = {
    c: null, pos: null, vid: null, visitId: null, visitReady: Promise.resolve(),
    serverOffset: 0, audio: null, ctx: null, gain: null, volume: 0.6, opened: false,
  };

  /* ---------------- utilidades ---------------- */
  async function api(path, opts) {
    const r = await fetch(path, opts);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || 'Error de conexión');
    return data;
  }
  const post = (p, b) => api(p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });

  function visitorId() {
    try {
      let v = localStorage.getItem('inv_vid');
      if (!v) {
        v = (crypto.randomUUID && crypto.randomUUID()) || (Date.now().toString(36) + Math.random().toString(36).slice(2, 12));
        localStorage.setItem('inv_vid', v);
      }
      return v;
    } catch (_) {
      return 'anon-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    }
  }

  function setText(id, text) {
    const el = byId(id);
    if (!el) return;
    el.textContent = text || '';
    el.hidden = !text;
  }

  function sendEvent(event) {
    state.visitReady.then(() => {
      if (state.visitId) post('/api/visit/event', { visitId: state.visitId, visitorId: state.vid, event }).catch(() => {});
    });
  }

  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

  /* ---------------- contenido ---------------- */
  function applyContent(c) {
    const font = c.title_font || 'Pinyon Script';
    document.documentElement.style.setProperty('--font-title', `'${font}', 'Playfair Display', cursive`);
    byId('title').classList.toggle('is-italic', font === 'Playfair Display');
    document.title = [c.title, c.cap_text].filter(Boolean).join(' · ') || 'Invitación';

    setText('gate-title', c.gate_title);
    setText('gate-text', c.gate_text);
    byId('gate-btn').textContent = c.gate_button || 'Activar ubicación';
    setText('env-title', c.env_title);
    setText('env-hint', c.env_hint);
    buildSeal(c.seal_text || '');

    setText('cap-text', c.cap_text);
    setText('title', c.title);
    byId('b1-img').src = c.block1_image || '';
    byId('b1-img').closest('.b1-img').hidden = !c.block1_image;
    setText('b1-text', c.block1_text);

    setText('loc1-title', c.loc1_title);
    setText('loc1-label', c.loc1_label);
    setText('loc2-title', c.loc2_title);
    setText('loc2-label', c.loc2_label);
    byId('gmaps1').textContent = byId('gmaps2').textContent = c.route_button_text || 'Abrir ruta en Google Maps';

    setText('cd-title', c.countdown_title);
    byId('cd-dl').textContent = c.cd_days; byId('cd-hl').textContent = c.cd_hours;
    byId('cd-ml').textContent = c.cd_minutes; byId('cd-sl').textContent = c.cd_seconds;
    setText('cd-done', c.countdown_done_text);
    byId('cd-done').hidden = true;

    byId('b2-img').src = c.block2_image || '';
    byId('b2-img').closest('.b2-img').hidden = !c.block2_image;
    setText('b2-text', c.block2_text);

    setText('gal-title', c.gallery_title);

    setText('rsvp-title', c.rsvp_title);
    setText('rsvp-intro', c.rsvp_intro);
    setText('rsvp-name-label', c.rsvp_name_label);
    $('#rsvp-form [name=fullName]').placeholder = c.rsvp_name_placeholder || '';
    setText('rsvp-attend-label', c.rsvp_attend_label);
    setText('rsvp-yes', c.rsvp_yes_label);
    setText('rsvp-no', c.rsvp_no_label);
    setText('rsvp-comp-label', c.rsvp_companions_label);
    byId('rsvp-btn').textContent = c.rsvp_button || 'Confirmar asistencia';

    setText('contact-title', c.contact_title);
    const wa = String(c.contact_whatsapp || '').replace(/\D/g, '');
    byId('wa-link').hidden = !wa;
    if (wa) {
      byId('wa-link').href = 'https://wa.me/' + wa;
      byId('wa-number').textContent = '+' + wa;
    }
    setText('wa-label', c.contact_whatsapp_label);
    setText('contact-text', c.contact_text);

    setText('fw-text', c.farewell_text);
    byId('farewell').hidden = !c.farewell_text && !c.farewell_image;
    if (c.farewell_image) byId('fw-bg').style.backgroundImage = `url("${c.farewell_image}")`;
    byId('fw-bg').style.opacity = String(Math.min(100, Math.max(0, num(c.farewell_opacity) ?? 45)) / 100);

    setText('footer-text', c.footer_text);
    setText('admin-link', c.admin_link_text);
    state.volume = Math.min(100, Math.max(0, num(c.music_volume) ?? 60)) / 100;
  }

  /* ---------------- sello de cera ---------------- */
  function buildSeal(text) {
    const rnd = (s) => { const x = Math.sin(s * 127.1 + 3.7) * 43758.5453; return x - Math.floor(x); };
    const n = 15, r = 41, amp = 3.6, pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const rr = r + (rnd(i + 1) - 0.5) * amp * 2;
      pts.push([50 + Math.cos(a) * rr, 50 + Math.sin(a) * rr]);
    }
    const mids = pts.map((p, i) => { const q = pts[(i + 1) % n]; return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; });
    let d = `M${mids[n - 1][0].toFixed(2)},${mids[n - 1][1].toFixed(2)}`;
    for (let i = 0; i < n; i++) d += ` Q${pts[i][0].toFixed(2)},${pts[i][1].toFixed(2)} ${mids[i][0].toFixed(2)},${mids[i][1].toFixed(2)}`;
    d += 'Z';
    const safe = String(text).replace(/[<>&"']/g, '');
    const fs = safe.length <= 2 ? 25 : safe.length === 3 ? 19 : 15;
    byId('seal').innerHTML =
      `<svg viewBox="0 0 100 100" aria-hidden="true"><defs>
        <radialGradient id="wax" cx="36%" cy="30%" r="80%"><stop offset="0" stop-color="#c9474f"/><stop offset=".5" stop-color="#8e1f26"/><stop offset="1" stop-color="#4c0c11"/></radialGradient>
      </defs>
      <path d="${d}" fill="url(#wax)"/>
      <path d="${d}" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="1.2" transform="translate(-.8 -.8)"/>
      <circle cx="50" cy="50" r="29" fill="none" stroke="rgba(0,0,0,.32)" stroke-width="2"/>
      <circle cx="50" cy="50" r="29" fill="none" stroke="rgba(255,255,255,.2)" stroke-width="1" transform="translate(.9 .9)"/>
      <text x="50" y="${50 + fs * 0.34}" text-anchor="middle" font-family="'Cormorant Garamond',Georgia,serif" font-weight="700" font-size="${fs}" fill="rgba(0,0,0,.4)" transform="translate(.9 .9)">${safe}</text>
      <text x="50" y="${50 + fs * 0.34}" text-anchor="middle" font-family="'Cormorant Garamond',Georgia,serif" font-weight="700" font-size="${fs}" fill="rgba(255,225,225,.55)">${safe}</text></svg>`;
  }

  /* ---------------- pantalla de ubicación (obligatoria) ---------------- */
  function askLocation() {
    return new Promise((resolve, reject) => {
      if (!('geolocation' in navigator)) return reject({ code: 'unsupported' });
      if (!window.isSecureContext) return reject({ code: 'insecure' });
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }),
        (err) => reject({ code: err.code === 1 ? 'denied' : err.code === 2 ? 'unavailable' : 'timeout' }),
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 }
      );
    });
  }

  const LOCATION_ERRORS = {
    denied: 'Para continuar es necesario permitir el acceso a tu ubicación. Toca el candado junto a la dirección del navegador, activa "Ubicación" y vuelve a intentarlo.',
    unavailable: 'No pudimos detectar tu ubicación. Revisa que el GPS o la ubicación del dispositivo estén encendidos y vuelve a intentarlo.',
    timeout: 'Se agotó el tiempo esperando tu ubicación. Revisa tu señal o el GPS y vuelve a intentarlo.',
    insecure: 'Este navegador solo permite la ubicación en páginas seguras (https). Abre la invitación desde su enlace seguro.',
    unsupported: 'Tu navegador no admite la ubicación. Abre la invitación en Chrome, Safari o Firefox actualizados.',
  };

  function bindGate() {
    const btn = byId('gate-btn');
    const err = byId('gate-error');
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = 'Solicitando…';
      err.hidden = true;
      try {
        state.pos = await askLocation();
        sendEvent('location');
        const gate = byId('gate');
        gate.classList.add('out');
        setTimeout(() => {
          gate.hidden = true;
          const scene = byId('scene');
          scene.hidden = false;
          requestAnimationFrame(() => scene.classList.add('in'));
        }, 450);
      } catch (e) {
        err.textContent = LOCATION_ERRORS[e.code] || LOCATION_ERRORS.unavailable;
        err.hidden = false;
        btn.disabled = false;
        btn.textContent = (state.c && state.c.gate_button) || 'Activar ubicación';
      }
    });
  }

  /* ---------------- música ---------------- */
  function setupAudio() {
    const file = state.c.music_file;
    if (!file) return;
    const a = new Audio();
    a.src = file; a.loop = true; a.preload = 'auto';
    state.audio = a;
    const vol = byId('pl-vol');
    vol.value = Math.round(state.volume * 100);
    vol.addEventListener('input', applyVolume);
    byId('pl-toggle').addEventListener('click', () => {
      if (a.paused) { resumeCtx(); a.play().then(() => setPlaying(true)).catch(() => setPlaying(false)); }
      else { a.pause(); setPlaying(false); }
    });
    a.addEventListener('pause', () => setPlaying(false));
    a.addEventListener('play', () => setPlaying(true));
  }

  function setPlaying(on) { byId('player').classList.toggle('paused', !on); }
  function resumeCtx() { if (state.ctx && state.ctx.state === 'suspended') state.ctx.resume().catch(() => {}); }

  function applyVolume() {
    const v = Math.min(1, Math.max(0, Number(byId('pl-vol').value) / 100));
    state.volume = v;
    if (state.gain) state.gain.gain.value = v; else if (state.audio) state.audio.volume = v;
  }

  // Se llama dentro del toque del sello: ese toque es lo que permite reproducir el audio automáticamente
  function startMusic() {
    const a = state.audio;
    if (!a) return;
    // En iPhone el volumen del <audio> no se puede cambiar; con Web Audio sí (solo para archivos propios del sitio)
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC && !state.ctx && String(state.c.music_file).startsWith('/')) {
        state.ctx = new AC();
        state.gain = state.ctx.createGain();
        state.ctx.createMediaElementSource(a).connect(state.gain);
        state.gain.connect(state.ctx.destination);
      }
    } catch (_) { state.ctx = null; state.gain = null; }
    resumeCtx();
    applyVolume();
    a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }

  /* ---------------- abrir el sobre ---------------- */
  function bindEnvelope() {
    byId('seal').addEventListener('click', () => {
      if (state.opened) return;
      state.opened = true;
      byId('player').hidden = !state.audio;
      startMusic();
      sendEvent('open');
      byId('envelope').classList.add('open');
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      setTimeout(() => byId('scene').classList.add('leaving'), reduce ? 200 : 1900);
      setTimeout(() => {
        byId('scene').hidden = true;
        document.body.classList.remove('is-locked');
        const inv = byId('invitation');
        inv.hidden = false;
        inv.classList.add('show');
        window.scrollTo(0, 0);
        initInvitation();
      }, reduce ? 500 : 2600);
    }, { once: true });
  }

  /* ---------------- cuenta regresiva ---------------- */
  function startCountdown() {
    const c = state.c;
    const target = Date.parse(`${c.countdown_date}:00${c.countdown_tz || '-04:00'}`);
    const grid = byId('cd');
    if (Number.isNaN(target)) { grid.hidden = true; return; }
    const pad = (n) => String(n).padStart(2, '0');
    const tick = () => {
      const diff = target - (Date.now() + state.serverOffset);
      if (diff <= 0) {
        grid.hidden = true;
        byId('cd-done').hidden = !c.countdown_done_text;
        return false;
      }
      const s = Math.floor(diff / 1000);
      byId('cd-d').textContent = pad(Math.floor(s / 86400));
      byId('cd-h').textContent = pad(Math.floor((s % 86400) / 3600));
      byId('cd-m').textContent = pad(Math.floor((s % 3600) / 60));
      byId('cd-s').textContent = pad(s % 60);
      return true;
    };
    if (tick()) setInterval(tick, 1000);
  }

  /* ---------------- mapas con ruta ---------------- */
  const fmtDist = (m) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`);
  const fmtDur = (s) => {
    const min = Math.max(1, Math.round(s / 60));
    return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;
  };
  function haversine(a, b) {
    const R = 6371000, rad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  async function setupMap(n) {
    const c = state.c;
    const dest = { lat: num(c[`loc${n}_lat`]), lng: num(c[`loc${n}_lng`]) };
    const section = byId(`sec-loc${n}`);
    const mapEl = byId(`map${n}`);
    const info = byId(`route${n}`);
    if (dest.lat === null || dest.lng === null) { section.hidden = true; return; }

    const me = state.pos;
    const gm = byId(`gmaps${n}`);
    gm.href = 'https://www.google.com/maps/dir/?api=1' +
      (me ? `&origin=${me.lat},${me.lng}` : '') + `&destination=${dest.lat},${dest.lng}&travelmode=driving`;

    if (!window.L) {
      mapEl.innerHTML = '<div class="map-fallback">No se pudo cargar el mapa. Usa el botón de abajo para ver la ruta.</div>';
      return;
    }
    const map = L.map(mapEl, { scrollWheelZoom: false, dragging: !L.Browser.mobile, tap: false }).setView([dest.lat, dest.lng], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);
    L.marker([dest.lat, dest.lng], { icon: L.divIcon({ className: '', html: '<div class="pin dest"></div>', iconSize: [30, 30], iconAnchor: [15, 30] }) }).addTo(map);
    setTimeout(() => map.invalidateSize(), 200);
    if (!me) return;

    L.marker([me.lat, me.lng], { icon: L.divIcon({ className: '', html: '<div class="pin me"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }) }).addTo(map);
    info.textContent = 'Calculando la ruta desde tu ubicación…';
    const fit = (b) => map.fitBounds(b, { padding: [34, 34] });
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 12000);
      const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${me.lng},${me.lat};${dest.lng},${dest.lat}?overview=full&geometries=geojson`, { signal: ctrl.signal });
      clearTimeout(timer);
      const data = await r.json();
      if (data.code !== 'Ok' || !data.routes?.length) throw new Error('sin ruta');
      const route = data.routes[0];
      const latlngs = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
      L.polyline(latlngs, { color: '#fff', weight: 10, opacity: .9 }).addTo(map);
      const line = L.polyline(latlngs, { color: '#14161a', weight: 5, opacity: .95 }).addTo(map);
      fit(line.getBounds());
      info.textContent = `A ${fmtDist(route.distance)} de ti · aprox. ${fmtDur(route.duration)} en auto`;
    } catch (_) {
      const line = L.polyline([[me.lat, me.lng], [dest.lat, dest.lng]], { color: '#14161a', weight: 4, dashArray: '8 10' }).addTo(map);
      fit(line.getBounds());
      info.textContent = `A ${fmtDist(haversine(me, dest))} en línea recta. Toca el botón para ver la ruta exacta.`;
    }
  }

  /* ---------------- carrusel 3D giratorio ---------------- */
  function initCarousel() {
    const stage = byId('carousel');
    const images = (state.c.carousel || []).filter((i) => i && i.url);
    if (!images.length) { byId('sec-gallery').hidden = true; return; }

    let list = images.slice();
    while (list.length < 7) list = list.concat(images); // anillo más lleno si hay pocas fotos
    stage.innerHTML = '';
    const items = list.map((img) => {
      const d = document.createElement('div');
      d.className = 'c-item';
      const im = document.createElement('img');
      im.src = img.url; im.alt = img.caption || ''; im.draggable = false; im.decoding = 'async';
      d.appendChild(im);
      stage.appendChild(d);
      return d;
    });

    const step = 360 / items.length;
    let angle = 0, radius = 0, last = performance.now(), visible = true, pausedUntil = 0, raf = 0;
    const speed = images.length === 1 ? 0 : 360 / (items.length * 3.2); // grados por segundo (una foto cada ~3 s)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function size() {
      const w = stage.clientWidth;
      const cw = Math.min(w * 0.5, 250);
      stage.style.setProperty('--cw', cw + 'px');
      stage.style.setProperty('--ch', cw * 1.25 + 'px');
      radius = w * 0.36;
    }
    function layout() {
      const ch = parseFloat(getComputedStyle(stage).getPropertyValue('--ch')) || 270;
      items.forEach((el, i) => {
        const th = ((i * step + angle) * Math.PI) / 180;
        const depth = (Math.cos(th) + 1) / 2;            // 1 = frente, 0 = atrás
        const scale = 0.52 + 0.48 * Math.pow(depth, 0.9);
        const x = Math.sin(th) * radius;
        const y = -(1 - depth) * ch * 0.1;               // las de atrás se ven un poco más arriba
        el.style.transform = `translate(-50%,-50%) translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) rotateY(${(-Math.sin(th) * 24).toFixed(1)}deg) scale(${scale.toFixed(3)})`;
        el.style.zIndex = String(Math.round(depth * 100));
        el.style.opacity = (0.42 + 0.58 * depth).toFixed(2);
      });
    }
    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (visible && now > pausedUntil && !reduce) angle = (angle + speed * dt) % 360;
      layout();
      raf = visible ? requestAnimationFrame(frame) : 0;
    }
    size(); layout();
    new ResizeObserver(() => { size(); layout(); }).observe(stage);
    new IntersectionObserver((e) => {
      visible = e[0].isIntersecting;
      if (visible && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
    }).observe(stage);
    raf = requestAnimationFrame(frame);

    // Arrastrar con el dedo o el mouse para girar manualmente
    let dragX = null;
    stage.addEventListener('pointerdown', (e) => { dragX = e.clientX; pausedUntil = Infinity; });
    window.addEventListener('pointermove', (e) => {
      if (dragX === null) return;
      angle = (angle + (e.clientX - dragX) * 0.4 + 360) % 360;
      dragX = e.clientX;
    });
    const end = () => { if (dragX !== null) { dragX = null; pausedUntil = performance.now() + 1800; } };
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  }

  /* ---------------- confirmación de asistencia ---------------- */
  function bindRsvp() {
    const form = byId('rsvp-form');
    const msg = byId('rsvp-msg');
    const comp = byId('comp-field');
    const show = (text, kind) => { msg.textContent = text; msg.className = 'form-msg ' + kind; msg.hidden = false; };
    try {
      const saved = localStorage.getItem('inv_rsvp_name');
      if (saved) form.fullName.value = saved;
    } catch (_) { /* sin almacenamiento */ }

    form.addEventListener('change', () => { comp.hidden = form.attending.value !== '1'; });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      msg.hidden = true;
      const name = form.fullName.value.replace(/\s+/g, ' ').trim();
      if (name.length < 2) { show('Escribe tu nombre completo.', 'err'); form.fullName.focus(); return; }
      const attending = form.attending.value === '1';
      let companions = parseInt(form.companions.value || '0', 10);
      if (!(companions >= 0)) companions = 0;
      if (companions > 20) { show('El número de acompañantes no puede ser mayor a 20.', 'err'); return; }
      const btn = byId('rsvp-btn');
      btn.disabled = true;
      try {
        await post('/api/rsvp', { visitorId: state.vid, fullName: name, attending, companions: attending ? companions : 0 });
        try { localStorage.setItem('inv_rsvp_name', name); } catch (_) { /* sin almacenamiento */ }
        show(attending ? (state.c.rsvp_success || '¡Gracias por confirmar!') : (state.c.rsvp_success_no || 'Gracias por avisarnos.'), 'ok');
      } catch (err) {
        show(err.message || 'No se pudo guardar. Inténtalo otra vez.', 'err');
      } finally {
        btn.disabled = false;
      }
    });
  }

  /* ---------------- animación al hacer scroll ---------------- */
  function bindReveal() {
    const els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { threshold: 0.12 });
    els.forEach((e) => io.observe(e));
  }

  /* ---------------- arranque ---------------- */
  function initInvitation() {
    bindReveal();
    startCountdown();
    initCarousel();
    setupMap(1);
    setupMap(2);
  }

  async function boot() {
    state.vid = visitorId();
    try {
      state.c = await api('/api/content');
    } catch (e) {
      byId('gate-title').textContent = 'No se pudo cargar';
      byId('gate-text').textContent = 'Revisa tu conexión e inténtalo otra vez.';
      byId('gate-btn').textContent = 'Reintentar';
      byId('gate-btn').addEventListener('click', () => location.reload());
      return;
    }
    state.serverOffset = (state.c.serverNow || Date.now()) - Date.now();
    applyContent(state.c);
    setupAudio();
    bindGate();
    bindEnvelope();
    bindRsvp();
    state.visitReady = post('/api/visit', { visitorId: state.vid }).then((r) => { state.visitId = r.id; }).catch(() => {});
  }

  boot();
})();
