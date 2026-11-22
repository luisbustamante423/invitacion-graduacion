(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let schema = null;           // { groups, values }
  let dashTimer = null;
  let currentTab = 'dashboard';

  /* ---------------- red ---------------- */
  async function api(method, url, body, raw) {
    const opts = { method, headers: { 'x-admin': '1' }, credentials: 'same-origin' };
    if (raw) { opts.body = body; opts.headers['Content-Type'] = 'application/octet-stream'; }
    else if (body !== undefined) { opts.body = JSON.stringify(body); opts.headers['Content-Type'] = 'application/json'; }
    const r = await fetch(url, opts);
    const data = await r.json().catch(() => ({}));
    if (r.status === 401 && !url.endsWith('/login')) { showLogin(); throw new Error('Sesión vencida. Entra otra vez.'); }
    if (!r.ok) throw new Error(data.error || 'Error de conexión');
    return data;
  }

  let toastTimer;
  function toast(msg, isErr) {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'toast' + (isErr ? ' err' : '');
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, isErr ? 6000 : 2800);
  }

  const parseDate = (s) => new Date(String(s).replace(' ', 'T') + 'Z');
  const fmtDateTime = (s) => parseDate(s).toLocaleString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  /* ---------------- acceso ---------------- */
  function showLogin() {
    clearInterval(dashTimer);
    $('#panel').hidden = true;
    $('#login').hidden = false;
    $('#pw').value = '';
    $('#pw').focus();
  }

  async function showPanel() {
    $('#login').hidden = true;
    $('#panel').hidden = false;
    schema = await api('GET', '/api/admin/schema');
    renderContent(); renderMusic(); renderSecurity();
    switchTab(currentTab);
  }

  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#login-err'); err.hidden = true;
    const btn = $('#login-btn'); btn.disabled = true;
    try {
      await api('POST', '/api/admin/login', { password: $('#pw').value });
      await showPanel();
    } catch (ex) { err.textContent = ex.message; err.hidden = false; }
    finally { btn.disabled = false; }
  });

  $('#logout').addEventListener('click', async () => {
    try { await api('POST', '/api/admin/logout', {}); } catch (_) { /* ya cerrada */ }
    showLogin();
  });

  /* ---------------- pestañas ---------------- */
  $('#tabs').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-tab]');
    if (b) switchTab(b.dataset.tab);
  });

  function switchTab(name) {
    currentTab = name;
    $$('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
    $$('.tabpane').forEach((p) => { p.hidden = p.id !== 'tab-' + name; });
    clearInterval(dashTimer);
    if (name === 'dashboard') { loadDashboard(); dashTimer = setInterval(loadDashboard, 15000); }
    if (name === 'carousel') loadCarousel();
    if (name === 'rsvps') loadRsvps();
  }

  /* ---------------- resumen ---------------- */
  async function loadDashboard() {
    let d;
    try { d = await api('GET', '/api/admin/dashboard'); } catch (e) { return; }
    const max = Math.max(1, ...d.days.map((x) => x.views));
    const stat = (n, label, small, dark) => `<div class="stat${dark ? ' dark' : ''}"><b>${n}</b><span>${esc(label)}</span><small>${esc(small || '')}</small></div>`;
    $('#tab-dashboard').innerHTML = `
      <div class="stats">
        ${stat(d.confirmed, 'Confirmados', `+ ${d.companions} acompañantes = ${d.totalPeople} personas`, true)}
        ${stat(d.pending, 'Pendientes', 'Entraron pero aún no responden')}
        ${stat(d.declined, 'No asistirán', 'Respondieron que no')}
        ${stat(d.views, 'Visitas totales', 'Cada ingreso cuenta, aunque sea la misma persona')}
        ${stat(d.unique, 'Personas distintas', 'Dispositivos diferentes que entraron')}
        ${stat(d.repeat, 'Entraron más de una vez', `${d.reentries} ${d.reentries === 1 ? 'reingreso' : 'reingresos'} en total`)}
        ${stat(d.openedUnique, 'Abrieron el sobre', `${d.openedViews} aperturas en total`)}
        ${stat(d.locationUnique, 'Activaron la ubicación', 'Personas distintas')}
      </div>
      <div class="card">
        <h3>Visitas de los últimos 14 días</h3>
        <p class="sub">Altura de cada barra = visitas del día (número arriba).</p>
        <div class="bars">${d.days.map((x) => `<div class="bar" title="${x.views} visitas · ${x.people} personas"><u>${x.views || ''}</u><i style="height:${Math.round((x.views / max) * 100)}%"></i><em>${x.day.slice(8, 10)}/${x.day.slice(5, 7)}</em></div>`).join('')}</div>
      </div>
      <div class="card">
        <h3>Últimos ingresos</h3>
        <p class="sub">El código identifica el dispositivo: si se repite, es la misma persona entrando otra vez.</p>
        <div class="table-wrap"><table>
          <thead><tr><th>Fecha</th><th>Visitante</th><th>Veces que entró</th><th>Ubicación</th><th>Abrió el sobre</th><th>Confirmó</th></tr></thead>
          <tbody>${d.recent.length ? d.recent.map((r) => `<tr><td>${esc(fmtDateTime(r.created_at))}</td><td><code>${esc(r.visitor)}</code></td><td>${r.total}</td><td>${r.location_granted ? '<span class="tag ok">Sí</span>' : '<span class="tag">No</span>'}</td><td>${r.opened ? '<span class="tag ok">Sí</span>' : '<span class="tag">No</span>'}</td><td>${r.confirmed ? '<span class="tag ok">Sí</span>' : '<span class="tag">No</span>'}</td></tr>`).join('') : '<tr><td colspan="6" class="empty">Todavía no hay visitas.</td></tr>'}</tbody>
        </table></div>
      </div>`;
  }

  /* ---------------- editor de contenido ---------------- */
  function fieldHtml(f, v) {
    const id = 'f_' + f.key;
    const help = f.help ? `<div class="help">${esc(f.help)}</div>` : '';
    const label = `<label for="${id}">${esc(f.label)}</label>`;
    switch (f.type) {
      case 'textarea':
        return `<div class="f">${label}<textarea class="inp" id="${id}" data-key="${f.key}">${esc(v)}</textarea>${help}</div>`;
      case 'image':
        return `<div class="f"><span class="lbl">${esc(f.label)}</span><div class="media">
          <img class="thumb" data-thumb="${f.key}" src="${esc(v)}" alt="">
          <div class="grow">
            <div class="row"><label class="btn-sm dark upl">Subir imagen<input type="file" accept="image/*" data-upload="${f.key}" data-kind="image"></label></div>
            <input class="inp" id="${id}" data-key="${f.key}" value="${esc(v)}" placeholder="o pega la dirección (URL) de una imagen">
          </div></div>${help}</div>`;
      case 'audio':
        return `<div class="f"><span class="lbl">${esc(f.label)}</span>
          <audio controls preload="none" data-audio="${f.key}" src="${esc(v)}"></audio>
          <div class="row"><label class="btn-sm dark upl">Subir audio<input type="file" accept="audio/*,.mp3,.m4a,.ogg,.wav" data-upload="${f.key}" data-kind="audio"></label>
          <input class="inp" id="${id}" data-key="${f.key}" value="${esc(v)}" placeholder="o la dirección (URL) del audio"></div>${help}</div>`;
      case 'mapsurl':
        return `<div class="f">${label}<div class="row"><input class="inp" id="${id}" data-key="${f.key}" value="${esc(v)}" placeholder="https://maps.app.goo.gl/…">
          <button class="btn-sm plain" type="button" data-testmap="${f.key}">Probar enlace</button></div>
          <div class="map-status" data-mapstatus="${f.key}"></div>${help}</div>`;
      case 'coord':
        return `<div class="f">${label}<input class="inp" id="${id}" data-key="${f.key}" value="${esc(v)}" inputmode="decimal"></div>`;
      case 'datetime':
        return `<div class="f">${label}<input class="inp" type="datetime-local" id="${id}" data-key="${f.key}" value="${esc(v)}"></div>`;
      case 'range':
        return `<div class="f">${label}<div class="range-row"><input type="range" min="0" max="100" id="${id}" data-key="${f.key}" value="${esc(v)}"><output>${esc(v)}%</output></div></div>`;
      case 'select':
        return `<div class="f">${label}<select class="inp" id="${id}" data-key="${f.key}">${f.options.map(([val, txt]) => `<option value="${esc(val)}"${val === v ? ' selected' : ''}>${esc(txt)}</option>`).join('')}</select></div>`;
      case 'phone':
        return `<div class="f">${label}<input class="inp" id="${id}" data-key="${f.key}" value="${esc(v)}" inputmode="tel" placeholder="59170000000"></div>`;
      default:
        return `<div class="f">${label}<input class="inp" id="${id}" data-key="${f.key}" value="${esc(v)}"${f.max ? ` maxlength="${f.max}"` : ''}>${help}</div>`;
    }
  }

  function groupHtml(g, open) {
    return `<details class="group" data-group="${g.id}"${open ? ' open' : ''}>
      <summary>${esc(g.title)}</summary>
      <div class="group-body">${g.fields.map((f) => fieldHtml(f, schema.values[f.key] ?? '')).join('')}
        <div class="save-bar"><button class="btn" type="button" data-save="${g.id}">Guardar cambios</button></div>
      </div></details>`;
  }

  function renderContent() {
    const groups = schema.groups.filter((g) => g.tab === 'content');
    $('#tab-content').innerHTML =
      `<p class="sub">Aquí puedes editar todos los textos, imágenes, títulos y ubicaciones. Abre una sección, cambia lo que quieras y pulsa <b>Guardar cambios</b>. Las imágenes y el audio se guardan solos al subirlos.</p>` +
      groups.map((g, i) => groupHtml(g, i === 0)).join('');
    bindEditors($('#tab-content'));
  }

  function renderMusic() {
    const g = schema.groups.find((x) => x.id === 'music');
    $('#tab-music').innerHTML =
      `<p class="sub">La canción se reproduce automáticamente cuando el invitado abre el sobre. Sube un archivo MP3 (máx. 50 MB).</p>` + groupHtml(g, true);
    bindEditors($('#tab-music'));
  }

  function bindEditors(root) {
    root.oninput = (e) => {
      const el = e.target;
      if (el.type === 'range') el.nextElementSibling.textContent = el.value + '%';
      if (el.dataset.key && el.closest('.media')) {
        const t = root.querySelector(`[data-thumb="${el.dataset.key}"]`);
        if (t) t.src = el.value;
      }
    };

    root.onclick = async (e) => {
      const save = e.target.closest('[data-save]');
      if (save) return saveGroup(root, save.dataset.save, save);
      const test = e.target.closest('[data-testmap]');
      if (test) return testMap(root, test.dataset.testmap);
    };

    root.onchange = async (e) => {
      const input = e.target.closest('input[data-upload]');
      if (!input || !input.files.length) return;
      const key = input.dataset.upload;
      const file = input.files[0];
      toast('Subiendo archivo…');
      try {
        const up = await api('POST', `/api/admin/upload?kind=${input.dataset.kind}`, file, true);
        const field = root.querySelector(`[data-key="${key}"]`);
        field.value = up.url;
        const t = root.querySelector(`[data-thumb="${key}"]`); if (t) t.src = up.url;
        const a = root.querySelector(`[data-audio="${key}"]`); if (a) { a.src = up.url; a.load(); }
        await api('PUT', '/api/admin/settings', { values: { [key]: up.url } });
        schema.values[key] = up.url;
        toast('Archivo subido y guardado ✔');
      } catch (ex) { toast(ex.message, true); }
      input.value = '';
    };
  }

  async function testMap(root, key) {
    const input = root.querySelector(`[data-key="${key}"]`);
    const status = root.querySelector(`[data-mapstatus="${key}"]`);
    status.className = 'map-status'; status.textContent = 'Buscando coordenadas…';
    try {
      const r = await api('POST', '/api/admin/resolve-map', { url: input.value });
      if (r.ok) { status.className = 'map-status ok'; status.textContent = `✔ Ubicación encontrada: ${r.lat.toFixed(5)}, ${r.lng.toFixed(5)}. Pulsa "Guardar cambios" para aplicarla.`; }
      else { status.className = 'map-status bad'; status.textContent = '✖ No pude sacar coordenadas de ese enlace. Prueba con el botón "Compartir" de Google Maps, o escribe la latitud y longitud a mano.'; }
    } catch (ex) { status.className = 'map-status bad'; status.textContent = ex.message; }
  }

  async function saveGroup(root, groupId, btn) {
    const g = schema.groups.find((x) => x.id === groupId);
    const values = {};
    for (const f of g.fields) {
      const el = root.querySelector(`[data-key="${f.key}"]`);
      if (el) values[f.key] = el.value;
    }
    btn.disabled = true;
    try {
      const r = await api('PUT', '/api/admin/settings', { values });
      for (const [k, v] of Object.entries(r.values)) {
        schema.values[k] = v;
        const el = root.querySelector(`[data-key="${k}"]`);
        if (el && el.value !== v) el.value = v;   // p. ej. coordenadas calculadas del enlace
      }
      if (r.warnings.length) toast(r.warnings.join(' '), true);
      else toast('Cambios guardados ✔');
    } catch (ex) { toast(ex.message, true); }
    finally { btn.disabled = false; }
  }

  /* ---------------- carrusel ---------------- */
  let carouselImgs = [];

  async function loadCarousel() {
    const r = await api('GET', '/api/admin/carousel');
    carouselImgs = r.images;
    renderCarousel();
  }

  function renderCarousel() {
    const pane = $('#tab-carousel');
    pane.innerHTML = `
      <div class="card">
        <h3>Fotos del carrusel</h3>
        <p class="sub">Giran automáticamente en círculo; la del centro se ve más grande. Puedes subir varias a la vez y ordenarlas con las flechas. Tienes ${carouselImgs.length} foto(s).</p>
        <div class="row"><label class="btn upl" style="display:inline-block;position:relative">Agregar fotos<input type="file" id="car-file" accept="image/*" multiple></label></div>
      </div>
      ${carouselImgs.length ? `<div class="grid">${carouselImgs.map((im, i) => `
        <div class="tile"><span class="n">${i + 1}</span><img src="${esc(im.url)}" alt="Foto ${i + 1}" loading="lazy">
          <div class="acts"><button data-mv="${i}" data-d="-1" ${i === 0 ? 'disabled' : ''} title="Mover antes">←</button><button class="del" data-del="${im.id}" title="Eliminar">✕</button><button data-mv="${i}" data-d="1" ${i === carouselImgs.length - 1 ? 'disabled' : ''} title="Mover después">→</button></div>
        </div>`).join('')}</div>` : '<div class="card empty">Aún no hay fotos. Agrega algunas arriba.</div>'}`;

    $('#car-file').addEventListener('change', async (e) => {
      const files = [...e.target.files];
      let ok = 0;
      for (const [i, f] of files.entries()) {
        toast(`Subiendo foto ${i + 1} de ${files.length}…`);
        try {
          const up = await api('POST', '/api/admin/upload?kind=image', f, true);
          await api('POST', '/api/admin/carousel', { url: up.url });
          ok++;
        } catch (ex) { toast(`${f.name}: ${ex.message}`, true); }
      }
      if (ok) toast(`${ok} foto(s) agregada(s) ✔`);
      loadCarousel();
    });

    pane.onclick = async (e) => {
      const del = e.target.closest('[data-del]');
      const mv = e.target.closest('[data-mv]');
      try {
        if (del && confirm('¿Eliminar esta foto del carrusel?')) {
          await api('DELETE', `/api/admin/carousel/${del.dataset.del}`);
          toast('Foto eliminada'); loadCarousel();
        } else if (mv) {
          const i = Number(mv.dataset.mv), j = i + Number(mv.dataset.d);
          if (j < 0 || j >= carouselImgs.length) return;
          [carouselImgs[i], carouselImgs[j]] = [carouselImgs[j], carouselImgs[i]];
          renderCarousel();
          await api('PUT', '/api/admin/carousel/order', { ids: carouselImgs.map((x) => x.id) });
        }
      } catch (ex) { toast(ex.message, true); }
    };
  }

  /* ---------------- confirmaciones ---------------- */
  async function loadRsvps() {
    const { rsvps } = await api('GET', '/api/admin/rsvps');
    const yes = rsvps.filter((r) => r.attending);
    const comp = yes.reduce((a, r) => a + r.companions, 0);
    const pane = $('#tab-rsvps');
    pane.innerHTML = `<div class="card">
      <h3>Confirmaciones recibidas</h3>
      <p class="sub">${yes.length} confirmado(s) + ${comp} acompañante(s) = <b>${yes.length + comp} personas</b> · ${rsvps.length - yes.length} no asistirá(n)</p>
      <div class="table-wrap"><table>
        <thead><tr><th>Nombre</th><th>Asistencia</th><th>Acompañantes</th><th>Fecha</th><th></th></tr></thead>
        <tbody>${rsvps.length ? rsvps.map((r) => `<tr><td>${esc(r.full_name)}</td><td>${r.attending ? '<span class="tag ok">Sí asistirá</span>' : '<span class="tag no">No asistirá</span>'}</td><td>${r.companions}</td><td>${esc(fmtDateTime(r.updated_at))}</td><td><button class="btn-sm danger" data-rdel="${r.id}">Eliminar</button></td></tr>`).join('') : '<tr><td colspan="5" class="empty">Aún no hay confirmaciones.</td></tr>'}</tbody>
      </table></div></div>`;
    pane.onclick = async (e) => {
      const b = e.target.closest('[data-rdel]');
      if (b && confirm('¿Eliminar esta confirmación?')) {
        try { await api('DELETE', `/api/admin/rsvps/${b.dataset.rdel}`); toast('Confirmación eliminada'); loadRsvps(); }
        catch (ex) { toast(ex.message, true); }
      }
    };
  }

  /* ---------------- seguridad ---------------- */
  function renderSecurity() {
    $('#tab-security').innerHTML = `<div class="card">
      <h3>Cambiar contraseña</h3>
      <p class="sub">La contraseña no distingue mayúsculas de minúsculas. Mínimo 6 caracteres.</p>
      <form id="pw-form" class="group-body" style="padding:0;max-width:380px" autocomplete="off">
        <div class="f"><label for="pw-cur">Contraseña actual</label><input class="inp" type="password" id="pw-cur" required></div>
        <div class="f"><label for="pw-new">Nueva contraseña</label><input class="inp" type="password" id="pw-new" minlength="6" required></div>
        <div><button class="btn" type="submit">Cambiar contraseña</button></div>
      </form></div>`;
    $('#pw-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await api('POST', '/api/admin/password', { current: $('#pw-cur').value, next: $('#pw-new').value });
        e.target.reset(); toast('Contraseña actualizada ✔');
      } catch (ex) { toast(ex.message, true); }
    });
  }

  /* ---------------- inicio ---------------- */
  (async () => {
    try {
      const me = await fetch('/api/admin/me', { credentials: 'same-origin' }).then((r) => r.json());
      if (me.admin) await showPanel(); else showLogin();
    } catch (_) { showLogin(); }
  })();
})();
