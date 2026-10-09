/* Plan Drawer — ระบบวาด polygon บนรูปแปลนโครงการบ้านจัดสรร */
(() => {
  'use strict';

  // ------------------------------------------------------------------ utils
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  const clone = o => JSON.parse(JSON.stringify(o));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ic = (n, s) => Icons.svg(n, s);
  const fmtNum = (n, d = 0) => Number(n).toLocaleString('th-TH', { maximumFractionDigits: d, minimumFractionDigits: d });
  const fmtTime = t => new Date(t).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const fmtDay = t => new Date(t).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
  const rtf = new Intl.RelativeTimeFormat('th', { numeric: 'auto' });
  function relTime(t) {
    const d = (t - Date.now()) / 1000;
    if (Math.abs(d) < 45) return 'เมื่อสักครู่';
    if (Math.abs(d) < 3600) return rtf.format(Math.round(d / 60), 'minute');
    if (Math.abs(d) < 86400) return rtf.format(Math.round(d / 3600), 'hour');
    return rtf.format(Math.round(d / 86400), 'day');
  }

  // --------------------------------------------------------------- constants
  const STATUSES = [
    { id: 'available', name: 'ว่าง', color: '#2e7d32' },
    { id: 'reserved', name: 'จองแล้ว', color: '#ef8f00' },
    { id: 'sold', name: 'ขายแล้ว', color: '#c62828' },
    { id: 'building', name: 'กำลังก่อสร้าง', color: '#1565c0' },
    { id: 'common', name: 'ส่วนกลาง', color: '#6d5f8a' },
  ];
  const STATUS = Object.fromEntries(STATUSES.map(s => [s.id, s]));
  const MARKERS = [
    { id: 'house', name: 'บ้านตัวอย่าง', color: '#7c3aed' },
    { id: 'entrance', name: 'ทางเข้า', color: '#0f766e' },
    { id: 'shield', name: 'ป้อมยาม', color: '#1d4ed8' },
    { id: 'car', name: 'ที่จอดรถ', color: '#475569' },
    { id: 'tree', name: 'สวน', color: '#15803d' },
    { id: 'pool', name: 'สระว่ายน้ำ', color: '#0284c7' },
    { id: 'store', name: 'ร้านค้า', color: '#c2410c' },
    { id: 'info', name: 'สำนักงานขาย', color: '#be185d' },
    { id: 'flag', name: 'จุดสังเกต', color: '#b91c1c' },
    { id: 'star', name: 'ไฮไลต์', color: '#ca8a04' },
    { id: 'trash', name: 'จุดทิ้งขยะ', color: '#57534e' },
    { id: 'pin', name: 'หมุดทั่วไป', color: '#e53935' },
  ];
  const MARKER = Object.fromEntries(MARKERS.map(m => [m.id, m]));
  const KINDS = {
    add: { color: '#188038', icon: 'plus', name: 'เพิ่ม' },
    edit: { color: '#1a73e8', icon: 'pencil', name: 'แก้ไข' },
    status: { color: '#00897b', icon: 'tag', name: 'สถานะ' },
    delete: { color: '#d93025', icon: 'trash', name: 'ลบ' },
    plan: { color: '#8e24aa', icon: 'image', name: 'แปลน' },
    rotate: { color: '#8e24aa', icon: 'rotr', name: 'หมุน' },
    undo: { color: '#5f6368', icon: 'undo', name: 'เลิกทำ' },
    redo: { color: '#5f6368', icon: 'redo', name: 'ทำซ้ำ' },
    restore: { color: '#e37400', icon: 'history', name: 'คืนค่า' },
    init: { color: '#9aa0a6', icon: 'flag', name: 'เริ่มต้น' },
  };
  const FLOORS = [4, 3, 2, 1];
  const TOOLS = {
    select: 'เลือก / แก้ไข', pan: 'เลื่อนแผนที่', rect: 'สี่เหลี่ยม', polygon: 'Polygon', marker: 'ปักไอคอน',
  };
  const LS_KEY = 'plan-drawer:v1';
  const MAX_TIMELINE = 150;

  // ------------------------------------------------------------------- state
  const S = {
    project: null,
    unit: null,
    floor: 1,
    tool: 'select',
    statusBrush: 'available',
    markerType: 'shield',
    sel: new Set(),
    view: { s: 1, tx: 0, ty: 0 },
    views: {},            // view ต่อแต่ละ unit:floor (ไม่บันทึก)
    settings: { labels: true, markers: true, imgOpacity: 1, fillOpacity: 0.38, showImage: true, panel: true, timeline: true, ribbon: true },
    preview: null,        // index ของ timeline entry ที่กำลังดูย้อนหลัง
    compare: false,
    draft: null,          // รูปที่กำลังวาด
    cursor: null,         // ตำแหน่งเมาส์ (screen)
    dismissedEmpty: {},
    listFilter: 'all',
  };
  const stacks = {};      // undo/redo ต่อ plan
  const imageCache = {};  // imageId -> url

  function defaultProject() {
    return {
      name: 'โครงการตัวอย่าง',
      units: [{ id: 'A', name: 'โซน A' }, { id: 'B', name: 'โซน B' }, { id: 'C', name: 'อาคารสโมสร' }],
      plans: {},
    };
  }

  // ------------------------------------------------------------- image store
  const ImageDB = (() => {
    let dbp;
    const open = () => dbp || (dbp = new Promise((res, rej) => {
      const r = indexedDB.open('plan-drawer', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('images');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    }));
    const tx = (mode, fn) => open().then(db => new Promise((res, rej) => {
      const t = db.transaction('images', mode); const req = fn(t.objectStore('images'));
      t.oncomplete = () => res(req && req.result); t.onerror = () => rej(t.error);
    }));
    return {
      put: (id, url) => tx('readwrite', s => s.put(url, id)),
      get: id => tx('readonly', s => s.get(id)),
      clear: () => tx('readwrite', s => s.clear()),
    };
  })();

  function sampleUrlFor(id) {
    const [, idx, floor, name] = id.split(':');
    return SamplePlan.make(decodeURIComponent(name), +idx, +floor).url;
  }
  function imageUrl(img) {
    if (!img) return null;
    if (imageCache[img.id]) return imageCache[img.id];
    if (img.id.startsWith('sample:')) return (imageCache[img.id] = sampleUrlFor(img.id));
    if (!imageCache['loading:' + img.id]) {
      imageCache['loading:' + img.id] = true;
      ImageDB.get(img.id).then(url => {
        if (url) { imageCache[img.id] = url; requestRender(); }
        else toast('ไม่พบไฟล์ภาพผังที่บันทึกไว้ กรุณาอัปโหลดใหม่', 'warn');
      }).catch(() => toast('อ่านภาพผังจากเบราว์เซอร์ไม่ได้', 'err'));
    }
    return null;
  }

  // ------------------------------------------------------------ plan / data
  const pkey = (u = S.unit, f = S.floor) => u + ':' + f;
  function hasPlan(u, f) { const p = S.project.plans[pkey(u, f)]; return !!(p && (p.image || p.shapes.length)); }
  function plan(u = S.unit, f = S.floor) {
    const k = pkey(u, f);
    let p = S.project.plans[k];
    if (!p) {
      p = S.project.plans[k] = { key: k, image: null, w: 1600, h: 1100, rotation: 0, ppm: 0, shapes: [], timeline: [] };
      addEntry(p, 'เริ่มต้นผังชั้นนี้', 'init', []);
    }
    return p;
  }
  const unitObj = (id = S.unit) => S.project.units.find(u => u.id === id);
  const unitName = (id = S.unit) => unitObj(id)?.name || id;
  const shapeById = (id, src = plan()) => src.shapes.find(s => s.id === id);
  const stack = (k = pkey()) => stacks[k] || (stacks[k] = { undo: [], redo: [] });

  function snap(p = plan()) { return clone({ shapes: p.shapes, rotation: p.rotation, image: p.image, w: p.w, h: p.h }); }
  function restoreSnap(p, s) { Object.assign(p, clone(s)); }

  function addEntry(p, label, kind, ids, coalesce) {
    const tl = p.timeline;
    const last = tl[tl.length - 1];
    if (coalesce && last && last.coalesce === coalesce && Date.now() - last.t < 4000) {
      last.t = Date.now(); last.snap = snap(p); last.label = label; return false;
    }
    tl.push({ id: uid(), t: Date.now(), label, kind, ids, snap: snap(p), coalesce });
    if (tl.length > MAX_TIMELINE) tl.splice(1, tl.length - MAX_TIMELINE);
    return true;
  }

  /** บันทึกการเปลี่ยนแปลง: before = snapshot ก่อนแก้ */
  function record(before, label, kind, ids = [], coalesce) {
    const p = plan();
    const isNew = addEntry(p, label, kind, ids, coalesce);
    if (isNew) {
      const st = stack();
      st.undo.push({ snap: before, label });
      if (st.undo.length > 100) st.undo.shift();
      st.redo.length = 0;
    }
    afterChange();
  }
  function change(label, kind, ids, fn, coalesce) {
    if (blockedByPreview()) return false;
    const before = snap();
    fn(plan());
    record(before, label, kind, ids, coalesce);
    return true;
  }
  function afterChange() {
    const p = plan();
    for (const id of [...S.sel]) if (!shapeById(id, p)) S.sel.delete(id);
    save(); renderAll();
  }

  function undo() {
    if (S.preview != null) exitPreview();
    if (S.draft) { S.draft = null; requestRender(); return; }
    const st = stack(); const it = st.undo.pop();
    if (!it) return toast('ไม่มีอะไรให้เลิกทำ');
    const p = plan();
    st.redo.push({ snap: snap(p), label: it.label });
    restoreSnap(p, it.snap);
    addEntry(p, 'เลิกทำ: ' + it.label, 'undo', []);
    toast('เลิกทำ: ' + it.label);
    afterChange();
  }
  function redo() {
    if (S.preview != null) exitPreview();
    const st = stack(); const it = st.redo.pop();
    if (!it) return toast('ไม่มีอะไรให้ทำซ้ำ');
    const p = plan();
    st.undo.push({ snap: snap(p), label: it.label });
    restoreSnap(p, it.snap);
    addEntry(p, 'ทำซ้ำ: ' + it.label, 'redo', []);
    afterChange();
  }

  function nextPlotName(p = plan()) {
    let max = 0;
    for (const s of p.shapes) if (s.type !== 'marker') { const m = /(\d+)\s*$/.exec(s.name || ''); if (m) max = Math.max(max, +m[1]); }
    const prefix = S.floor > 1 && !p.shapes.some(s => /^แปลง/.test(s.name)) ? 'ห้อง' : 'แปลง';
    return `${prefix} ${max + 1}`;
  }
  const label = s => s ? `“${s.name}”` : '';
  const describe = ids => ids.length === 1 ? label(shapeById(ids[0])) : `${ids.length} รายการ`;

  // ------------------------------------------------------------- geometry
  function area(pts) { let a = 0; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += (pts[j][0] + pts[i][0]) * (pts[j][1] - pts[i][1]); return Math.abs(a / 2); }
  function centroid(pts) {
    let a = 0, cx = 0, cy = 0;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const f = pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
      a += f; cx += (pts[j][0] + pts[i][0]) * f; cy += (pts[j][1] + pts[i][1]) * f;
    }
    if (Math.abs(a) < 1e-6) { const n = pts.length; return [pts.reduce((s, p) => s + p[0], 0) / n, pts.reduce((s, p) => s + p[1], 0) / n]; }
    return [cx / (3 * a), cy / (3 * a)];
  }
  function geom() { const src = viewSrc(); return { cx: src.w / 2, cy: src.h / 2, rad: src.rotation * Math.PI / 180, w: src.w, h: src.h }; }
  function toScreen(x, y, g = geom()) {
    const { s, tx, ty } = S.view, c = Math.cos(g.rad), sn = Math.sin(g.rad);
    const dx = x - g.cx, dy = y - g.cy;
    return [tx + s * (g.cx + dx * c - dy * sn), ty + s * (g.cy + dx * sn + dy * c)];
  }
  function toPlan(sx, sy, g = geom()) {
    const { s, tx, ty } = S.view, c = Math.cos(g.rad), sn = Math.sin(g.rad);
    const ux = (sx - tx) / s - g.cx, uy = (sy - ty) / s - g.cy;
    return [g.cx + ux * c + uy * sn, g.cy - ux * sn + uy * c];
  }
  function areaText(px2, ppm) {
    if (!ppm) return { main: `${fmtNum(px2)} px²`, sub: 'ตั้งมาตราส่วนในแท็บ “แปลน” เพื่อดูเป็น ตร.ม.' };
    const m2 = px2 / (ppm * ppm), wa = m2 / 4;
    const rai = Math.floor(wa / 400), ngan = Math.floor((wa % 400) / 100), w = wa % 100;
    const thai = (rai ? `${rai} ไร่ ` : '') + (ngan ? `${ngan} งาน ` : '') + `${fmtNum(w, 1)} ตร.วา`;
    return { main: `${fmtNum(m2, 1)} ตร.ม.`, sub: thai };
  }

  // ---------------------------------------------------------------- view
  const stageWrap = $('#stageWrap'), stage = $('#stage');
  const stageSize = () => { const r = stage.getBoundingClientRect(); return { w: r.width, h: r.height }; };

  function fit(animate) {
    const src = viewSrc(), g = geom();
    const { w, h } = stageSize();
    if (!w || !h) return;
    const saved = { ...S.view };
    S.view = { s: 1, tx: 0, ty: 0 };
    const pts = [[0, 0], [src.w, 0], [src.w, src.h], [0, src.h]].map(p => toScreen(p[0], p[1], g));
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const bw = Math.max(...xs) - Math.min(...xs), bh = Math.max(...ys) - Math.min(...ys);
    const padR = w > 700 ? 170 : 70;
    const s = clamp(Math.min((w - 40 - padR) / bw, (h - 90) / bh), 0.05, 8);
    const target = { s, tx: (w - padR + 10 - bw * s) / 2 - Math.min(...xs) * s, ty: (h - bh * s) / 2 - Math.min(...ys) * s + 8 };
    if (animate) { S.view = saved; animateView(target); } else { S.view = target; requestRender(); }
  }
  let animId;
  function animateView(target, ms = 260) {
    cancelAnimationFrame(animId);
    const from = { ...S.view }, t0 = performance.now();
    const step = now => {
      const k = clamp((now - t0) / ms, 0, 1), e = 1 - Math.pow(1 - k, 3);
      // interpolate scale in log space for a natural zoom
      const s = Math.exp(Math.log(from.s) + (Math.log(target.s) - Math.log(from.s)) * e);
      S.view = { s, tx: from.tx + (target.tx - from.tx) * e, ty: from.ty + (target.ty - from.ty) * e };
      renderStage();
      if (k < 1) animId = requestAnimationFrame(step); else { S.view = target; renderAll(); }
    };
    animId = requestAnimationFrame(step);
  }
  function zoomAt(px, py, factor) {
    const { s, tx, ty } = S.view;
    const ns = clamp(s * factor, 0.03, 30), k = ns / s;
    S.view = { s: ns, tx: px - (px - tx) * k, ty: py - (py - ty) * k };
    requestRender();
  }
  function zoomCenter(f) { const { w, h } = stageSize(); zoomAt(w / 2, h / 2, f); }
  function zoomTo100() { const { w, h } = stageSize(); zoomAt(w / 2, h / 2, 1 / S.view.s); }
  function zoomToShape(sh) {
    const pts = sh.type === 'marker' ? [sh.pos] : sh.points;
    const sp = pts.map(p => toScreen(p[0], p[1]));
    const xs = sp.map(p => p[0]), ys = sp.map(p => p[1]);
    const { w, h } = stageSize();
    const bw = Math.max(40, Math.max(...xs) - Math.min(...xs)), bh = Math.max(40, Math.max(...ys) - Math.min(...ys));
    const cx = (Math.max(...xs) + Math.min(...xs)) / 2, cy = (Math.max(...ys) + Math.min(...ys)) / 2;
    let f = Math.min((w * 0.45) / bw, (h * 0.45) / bh);
    f = clamp(S.view.s * f, 0.2, 6) / S.view.s;
    if (sh.type === 'marker') f = Math.max(1, 2 / S.view.s);
    const ns = S.view.s * f;
    const target = { s: ns, tx: w / 2 - ((cx - S.view.tx) * f) - 60, ty: h / 2 - ((cy - S.view.ty) * f) };
    animateView(target);
  }

  // ----------------------------------------------------------- persistence
  let saveT;
  function save() { setSaveState('saving'); clearTimeout(saveT); saveT = setTimeout(doSave, 350); }
  function serialize() {
    return JSON.stringify({ v: 1, project: S.project, unit: S.unit, floor: S.floor, statusBrush: S.statusBrush, markerType: S.markerType, settings: S.settings });
  }
  function doSave() {
    try { localStorage.setItem(LS_KEY, serialize()); setSaveState('saved'); return; } catch (e) { /* quota */ }
    // ลดประวัติเก่าลงแล้วลองใหม่
    for (const p of Object.values(S.project.plans)) if (p.timeline.length > 30) p.timeline.splice(1, p.timeline.length - 30);
    try { localStorage.setItem(LS_KEY, serialize()); setSaveState('saved'); toast('พื้นที่เก็บข้อมูลใกล้เต็ม ระบบได้ลดประวัติเก่าลง', 'warn'); renderTimeline(); }
    catch (e) { setSaveState('error'); toast('บันทึกอัตโนมัติไม่สำเร็จ แนะนำให้ “ส่งออกโปรเจกต์” เก็บไว้', 'err'); }
  }
  function setSaveState(st) {
    const el = $('#saveState'); el.className = 'save-state ' + st;
    $('.txt', el).textContent = st === 'saving' ? 'กำลังบันทึก…' : st === 'error' ? 'บันทึกไม่สำเร็จ' : 'บันทึกอัตโนมัติแล้ว';
  }
  function load() {
    let data = null;
    try { data = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch (e) { data = null; }
    if (data && data.project && Array.isArray(data.project.units) && data.project.units.length) {
      S.project = data.project;
      S.unit = data.unit; S.floor = data.floor || 1;
      S.statusBrush = data.statusBrush || S.statusBrush;
      S.markerType = data.markerType || S.markerType;
      Object.assign(S.settings, data.settings || {});
    } else {
      S.project = defaultProject();
    }
    if (!unitObj(S.unit)) S.unit = S.project.units[0].id;
    if (!FLOORS.includes(S.floor)) S.floor = 1;
    if (window.innerWidth < 900) S.settings.panel = false;
  }

  // --------------------------------------------------------------- render
  const worldG = $('#world'), imgEl = $('#planImg'), frameEl = $('#planFrame');
  const shapeLayer = $('#shapeLayer'), selLayer = $('#selLayer'), ghostLayer = $('#ghostLayer'), overlay = $('#overlay');
  let rafId = null;
  function requestRender() { if (!rafId) rafId = requestAnimationFrame(() => { rafId = null; renderStage(); }); }
  function renderAll() { renderStage(); renderChrome(); renderPanel(); renderTimeline(); }

  /** แหล่งข้อมูลที่จะวาด: ปัจจุบัน หรือ snapshot ขณะดูย้อนหลัง */
  function viewSrc() {
    const p = plan();
    if (S.preview != null && p.timeline[S.preview]) return p.timeline[S.preview].snap;
    return p;
  }

  function polyPts(pts) { return pts.map(p => p[0].toFixed(2) + ',' + p[1].toFixed(2)).join(' '); }

  function markerSvg(sh, sx, sy, cls = '') {
    const m = MARKER[sh.icon] || MARKER.pin;
    return `<g class="marker ${cls}" data-id="${sh.id}" transform="translate(${sx.toFixed(1)} ${sy.toFixed(1)})">
      <ellipse cx="0" cy="0" rx="7" ry="2.6" fill="rgba(0,0,0,.28)"/>
      <g class="pin-body">
        <path d="M0 0 C-3 -9 -15 -14 -15 -27 A15 15 0 1 1 15 -27 C15 -14 3 -9 0 0Z" fill="${m.color}" stroke="#fff" stroke-width="2"/>
        <g transform="translate(-9 -36) scale(.75)" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${Icons.paths[m.id] || Icons.paths.pin}</g>
      </g>
    </g>`;
  }

  function renderStage() {
    const p = plan(), src = viewSrc(), g = geom(), { s, tx, ty } = S.view;
    const previewing = S.preview != null;
    const entry = previewing ? p.timeline[S.preview] : null;
    const changed = new Set(entry ? entry.ids : []);
    worldG.setAttribute('transform', `translate(${tx} ${ty}) scale(${s}) rotate(${src.rotation} ${g.cx} ${g.cy})`);

    // image
    const url = S.settings.showImage ? imageUrl(src.image) : null;
    if (url) {
      if (imgEl.getAttribute('href') !== url) imgEl.setAttribute('href', url);
      imgEl.setAttribute('width', src.w); imgEl.setAttribute('height', src.h);
      imgEl.setAttribute('opacity', S.settings.imgOpacity);
      imgEl.style.display = '';
    } else imgEl.style.display = 'none';
    frameEl.setAttribute('width', src.w); frameEl.setAttribute('height', src.h);
    frameEl.setAttribute('fill', src.image ? 'none' : '#fff');

    // polygons
    const fo = S.settings.fillOpacity;
    let html = '';
    for (const sh of src.shapes) {
      if (sh.type === 'marker') continue;
      const st = STATUS[sh.status] || STATUS.available;
      html += `<polygon class="shape${changed.has(sh.id) ? ' changed' : ''}" data-id="${sh.id}" points="${polyPts(sh.points)}" fill="${st.color}" fill-opacity="${fo}" style="--fo:${fo}" stroke="${st.color}" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`;
    }
    shapeLayer.innerHTML = html;

    // ghost (compare with current)
    let gh = '';
    if (previewing && S.compare) {
      for (const sh of p.shapes) {
        if (sh.type === 'marker') continue;
        gh += `<polygon points="${polyPts(sh.points)}" fill="none" stroke="#5f6368" stroke-width="1.6" stroke-dasharray="5 4" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
      }
    }
    ghostLayer.innerHTML = gh;

    // selection outline
    let sl = '';
    if (!previewing) {
      for (const id of S.sel) {
        const sh = shapeById(id, src);
        if (sh && sh.type !== 'marker') sl += `<polygon points="${polyPts(sh.points)}" fill="none" stroke="#1a73e8" stroke-width="3" stroke-dasharray="9 5" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
      }
    }
    selLayer.innerHTML = sl;

    // overlay (screen space): labels, markers, handles, draft
    let ov = '';
    if (S.settings.labels) {
      for (const sh of src.shapes) {
        if (sh.type === 'marker' || !sh.name) continue;
        const size = Math.sqrt(area(sh.points)) * s;
        if (size < 34) continue;
        const [cx, cy] = centroid(sh.points), [x, y] = toScreen(cx, cy, g);
        const fs = clamp(size / 7, 11, 15);
        ov += `<text class="lbl" x="${x.toFixed(1)}" y="${(y + fs * 0.35).toFixed(1)}" text-anchor="middle" font-size="${fs.toFixed(1)}" fill="#202124">${esc(sh.name)}</text>`;
      }
    }
    if (S.settings.markers) {
      const marks = src.shapes.filter(x => x.type === 'marker');
      // ghost markers of current version
      if (previewing && S.compare) {
        for (const sh of p.shapes) if (sh.type === 'marker') { const [x, y] = toScreen(sh.pos[0], sh.pos[1], g); ov += `<circle cx="${x}" cy="${y - 27}" r="16" fill="none" stroke="#5f6368" stroke-dasharray="4 3" pointer-events="none"/>`; }
      }
      for (const sh of marks) {
        const [x, y] = toScreen(sh.pos[0], sh.pos[1], g);
        const sel = !previewing && S.sel.has(sh.id);
        if (sel) ov += `<circle cx="${x}" cy="${y - 27}" r="21" fill="rgba(26,115,232,.15)" stroke="#1a73e8" stroke-width="2.5" stroke-dasharray="6 4"/>`;
        ov += markerSvg(sh, x, y, changed.has(sh.id) ? 'changed' : '');
        if (S.settings.labels && sh.name && s > 0.25) ov += `<text class="lbl" x="${x}" y="${y + 15}" text-anchor="middle" font-size="11.5" fill="#3c4043">${esc(sh.name)}</text>`;
      }
    }
    // handles
    if (!previewing && S.tool === 'select' && S.sel.size === 1) {
      const sh = shapeById([...S.sel][0]);
      if (sh && sh.type !== 'marker') {
        const sp = sh.points.map(q => toScreen(q[0], q[1], g));
        sp.forEach((a, i) => {
          const b = sp[(i + 1) % sp.length];
          if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 26) ov += `<circle class="mid" data-mid="${i}" cx="${(a[0] + b[0]) / 2}" cy="${(a[1] + b[1]) / 2}" r="5" fill="#1a73e8" stroke="#fff" stroke-width="1.5"/>`;
        });
        sp.forEach((a, i) => { ov += `<circle class="vtx" data-vertex="${i}" cx="${a[0]}" cy="${a[1]}" r="6" fill="#fff" stroke="#1a73e8" stroke-width="2.2"/>`; });
      }
    }
    // draft
    const d = S.draft;
    if (d && d.type === 'rect') {
      const pts = rectPoints(d.a, d.b, d.square).map(q => toScreen(q[0], q[1], g));
      const st = STATUS[S.statusBrush];
      ov += `<polygon points="${polyPts(pts)}" fill="${st.color}" fill-opacity=".25" stroke="${st.color}" stroke-width="2" stroke-dasharray="6 4"/>`;
      const ar = areaText(area(rectPoints(d.a, d.b, d.square)), src.ppm || p.ppm);
      ov += `<g transform="translate(${d.b[0] + 14} ${d.b[1] + 18})"><rect x="0" y="-14" rx="5" width="${ar.main.length * 7 + 16}" height="22" fill="rgba(32,33,36,.85)"/><text x="8" y="2" font-size="12" fill="#fff" font-family="var(--font)">${esc(ar.main)}</text></g>`;
    }
    if (d && d.type === 'polygon' && d.points.length) {
      const st = STATUS[S.statusBrush];
      const sp = d.points.map(q => toScreen(q[0], q[1], g));
      const cur = S.cursor;
      const all = cur ? [...sp, [cur.x, cur.y]] : sp;
      if (all.length >= 3) ov += `<polygon points="${polyPts(all)}" fill="${st.color}" fill-opacity=".18" stroke="none"/>`;
      ov += `<polyline points="${polyPts(sp)}" fill="none" stroke="${st.color}" stroke-width="2.5"/>`;
      if (cur) ov += `<line x1="${sp[sp.length - 1][0]}" y1="${sp[sp.length - 1][1]}" x2="${cur.x}" y2="${cur.y}" stroke="${st.color}" stroke-width="2" stroke-dasharray="6 4"/>`;
      sp.forEach((a, i) => {
        const first = i === 0 && d.points.length >= 3;
        const near = first && d.nearFirst;
        ov += `<circle cx="${a[0]}" cy="${a[1]}" r="${near ? 9 : first ? 7 : 4.5}" fill="${near ? st.color : '#fff'}" stroke="${st.color}" stroke-width="2.2"/>`;
      });
    }
    if (!previewing && S.tool === 'marker' && S.cursor && !S.panning) {
      ov += `<g opacity=".55" pointer-events="none">${markerSvg({ id: '', icon: S.markerType }, S.cursor.x, S.cursor.y)}</g>`;
    }
    overlay.innerHTML = ov;

    // chrome bits that follow the view
    $('#sbZoom').textContent = Math.round(s * 100) + '%';
    $('#compassNeedle').style.transform = `rotate(${src.rotation}deg)`;
    renderHint();
  }

  function rectPoints(a, b, square) {
    // a, b: screen points -> rectangle aligned to the screen, stored in plan coords
    let bx = b[0], by = b[1];
    if (square) { const d = Math.max(Math.abs(bx - a[0]), Math.abs(by - a[1])); bx = a[0] + Math.sign(bx - a[0] || 1) * d; by = a[1] + Math.sign(by - a[1] || 1) * d; }
    return [[a[0], a[1]], [bx, a[1]], [bx, by], [a[0], by]].map(q => toPlan(q[0], q[1]));
  }

  function renderHint() {
    const h = $('#hint');
    if (S.preview != null) { h.textContent = ''; return; }
    const d = S.draft;
    let t = '';
    switch (S.tool) {
      case 'select': t = S.sel.size === 1 && shapeById([...S.sel][0])?.type !== 'marker'
        ? 'ลาก <kbd>จุดสีขาว</kbd> เพื่อปรับรูปร่าง · ลาก <kbd>จุดสีฟ้า</kbd> เพื่อเพิ่มจุด · ดับเบิลคลิกจุดเพื่อลบ'
        : 'คลิกเพื่อเลือก · ลากเพื่อย้าย · <kbd>Shift</kbd>+คลิก เลือกหลายรายการ · ลากพื้นที่ว่างเพื่อเลื่อน'; break;
      case 'pan': t = 'ลากเพื่อเลื่อนแผนที่ · หมุนล้อเมาส์เพื่อซูม'; break;
      case 'rect': t = d ? 'ปล่อยเมาส์เพื่อสร้าง · กด <kbd>Shift</kbd> ค้างให้เป็นจัตุรัส' : 'ลากเพื่อวาดสี่เหลี่ยม · หมุนแปลนให้ตรงก่อนจะวาดง่ายขึ้น'; break;
      case 'polygon': t = d ? `วางแล้ว ${d.points.length} จุด · คลิกจุดแรกหรือ <kbd>Enter</kbd> เพื่อจบ · <kbd>Backspace</kbd> ลบจุดล่าสุด · <kbd>Esc</kbd> ยกเลิก` : 'คลิกเพื่อวางจุดแรกของ Polygon'; break;
      case 'marker': t = `คลิกบนแปลนเพื่อปัก “${MARKER[S.markerType].name}” · เปลี่ยนชนิดได้ที่ลูกศรใต้ปุ่ม “ปักไอคอน”`; break;
    }
    t = `<b>${TOOLS[S.tool]}</b> · ` + t + ` · สถานะใหม่: <b style="color:${lighten(STATUS[S.statusBrush].color)}">${STATUS[S.statusBrush].name}</b>`;
    if (S.tool === 'pan' || S.tool === 'marker') t = t.replace(/ · สถานะใหม่.*$/, '');
    if (h.innerHTML !== t) h.innerHTML = t;
  }
  const lighten = c => `color-mix(in srgb, ${c} 45%, white)`;

  // -------------------------------------------------------- chrome (ribbon etc.)
  function renderChrome() {
    const p = plan(), previewing = S.preview != null;
    // tools
    $$('[data-cmd^="tool:"]').forEach(b => b.classList.toggle('active', b.dataset.cmd === 'tool:' + S.tool));
    $('#markerSplit').classList.toggle('active-tool', S.tool === 'marker');
    $('#markerSplit .split-main').classList.remove('active');
    $('#markerIcon').innerHTML = `<span style="color:${MARKER[S.markerType].color}">${ic(MARKER[S.markerType].id, 30)}</span>`;
    stageWrap.dataset.tool = S.tool;
    stageWrap.classList.toggle('preview', previewing);
    // edit state
    const hasSel = S.sel.size > 0;
    $$('[data-cmd="delete"], [data-cmd="duplicate"]').forEach(b => b.disabled = !hasSel || previewing);
    $$('[data-cmd="undo"]').forEach(b => b.disabled = !stack().undo.length && !S.draft);
    $$('[data-cmd="redo"]').forEach(b => b.disabled = !stack().redo.length);
    $$('[data-cmd="image:remove"]').forEach(b => b.disabled = !p.image || previewing);
    // toggles
    const tg = { labels: S.settings.labels, markers: S.settings.markers, showImage: S.settings.showImage, panel: S.settings.panel, timeline: S.settings.timeline };
    $$('[data-cmd^="toggle:"]').forEach(b => { const k = b.dataset.cmd.slice(7); if (k in tg && b.classList.contains('rb')) b.classList.toggle('on', tg[k]); });
    $('.main').classList.toggle('no-side', !S.settings.panel);
    $('#app').classList.toggle('no-timeline', !S.settings.timeline);
    $('#ribbon').classList.toggle('collapsed', !S.settings.ribbon);
    $('#ribbonToggle').innerHTML = ic(S.settings.ribbon ? 'chevUp' : 'chevDown', 18);
    // status gallery
    $$('#statusGallery .swatch').forEach(b => b.classList.toggle('on', b.dataset.status === S.statusBrush));
    // rotation + sliders
    const rot = viewSrc().rotation;
    if (document.activeElement !== $('#rotNum')) $('#rotNum').value = Math.round(rot * 10) / 10;
    $('#rotRange').value = rot; $('#rotOut').textContent = Math.round(rot) + '°';
    $('#imgOpacity').value = S.settings.imgOpacity; $('#imgOpacityOut').textContent = Math.round(S.settings.imgOpacity * 100) + '%';
    $('#fillOpacity').value = S.settings.fillOpacity; $('#fillOpacityOut').textContent = Math.round(S.settings.fillOpacity * 100) + '%';
    if (document.activeElement !== $('#ppm')) $('#ppm').value = p.ppm || '';
    // location
    $('#locChip').innerHTML = `${ic('building', 14)}<b>${esc(unitName())}</b> · ชั้น ${S.floor}`;
    $('#unitName').textContent = unitName();
    $('#floors').innerHTML = FLOORS.map(f => `<button class="floor-btn${f === S.floor ? ' on' : ''}" data-floor="${f}" title="ชั้น ${f}${hasPlan(S.unit, f) ? ' (มีข้อมูล)' : ''}"><small>ชั้น</small>${f}${hasPlan(S.unit, f) ? '<i class="fdot"></i>' : ''}</button>`).join('');
    // empty state
    const showEmpty = !p.image && !p.shapes.length && !S.dismissedEmpty[pkey()] && !previewing;
    $('#empty').hidden = !showEmpty;
    $('#emptyLoc').textContent = `${unitName()} · ชั้น ${S.floor}`;
    // preview banner
    $('#previewBanner').hidden = !previewing;
    if (previewing) { const e = p.timeline[S.preview]; $('#pbWhen').textContent = `#${S.preview + 1} · ${e.label} · ${fmtTime(e.t)}`; }
    $('#sbTool').textContent = previewing ? 'ดูย้อนหลัง' : TOOLS[S.tool];
    renderHint();
  }

  // --------------------------------------------------------------- side panel
  let ptab = 'props';
  function renderPanel() {
    if (!S.settings.panel) return;
    const src = viewSrc();
    const shapes = src.shapes;
    $('#listCount').textContent = shapes.length;
    if (ptab === 'list') renderList();
    const el = $('#panelProps');
    if (ptab !== 'props') return;
    if (el.contains(document.activeElement) && document.activeElement.matches('input,textarea')) return;
    const previewing = S.preview != null;
    let h = previewing ? `<div class="notice">${ic('history', 16)} กำลังดูข้อมูลย้อนหลัง — แก้ไขไม่ได้ กด “กลับสู่ปัจจุบัน” เพื่อแก้ไขต่อ</div>` : '';
    const sel = previewing ? [] : [...S.sel].map(id => shapeById(id)).filter(Boolean);

    if (sel.length === 1) h += propsSingle(sel[0]);
    else if (sel.length > 1) h += propsMulti(sel);
    else h += summary(src);
    el.innerHTML = h;
  }

  function summary(src) {
    const polys = src.shapes.filter(s => s.type !== 'marker'), marks = src.shapes.filter(s => s.type === 'marker');
    const p = plan();
    let tot = 0; polys.forEach(s => tot += area(s.points));
    const ar = areaText(tot, p.ppm);
    let h = `<div class="sec"><div class="sec-title">${ic('building', 14)} สรุป ${esc(unitName())} · ชั้น ${S.floor}</div>
      <div class="big-num"><div><b>${polys.length}</b><span>แปลง / พื้นที่</span></div><div><b>${marks.length}</b><span>ไอคอน</span></div></div>`;
    for (const st of STATUSES) {
      const n = polys.filter(s => s.status === st.id).length;
      h += `<div class="stat-row" style="--c:${st.color}" data-filter="${st.id}" title="ดูรายการสถานะนี้"><i></i><span>${st.name}</span><b>${n}</b><div class="stat-bar"><span style="width:${polys.length ? n / polys.length * 100 : 0}%"></span></div></div>`;
    }
    h += `<div class="meta" style="margin-top:8px">พื้นที่รวม: <b>${ar.main}</b>${p.ppm ? ' · ' + ar.sub : ''}</div></div>`;
    h += `<div class="sec"><div class="sec-title">${ic('info', 14)} เริ่มต้นใช้งาน</div><ol class="steps">
      <li><span>อัปโหลดภาพผัง หรือกด “ใช้ภาพตัวอย่าง”</span></li>
      <li><span>ถ้าผังเอียง ใช้ “หมุนแปลน” ให้ตรงก่อน</span></li>
      <li><span>เลือกสถานะในแถบ “สถานะแปลง” แล้ววาดด้วย <b>สี่เหลี่ยม</b> หรือ <b>Polygon</b></span></li>
      <li><span>ปักไอคอน เช่น ป้อมยาม สวน ที่จอดรถ</span></li>
      <li><span>เลือก Unit / ชั้น ได้ที่มุมขวาล่าง และย้อนดูประวัติได้ที่แถบล่างสุด</span></li></ol></div>`;
    return h;
  }

  function statusChips(cur) {
    return `<div class="chips">${STATUSES.map(st => `<button class="chip-btn${cur === st.id ? ' on' : ''}" style="--c:${st.color}" data-setstatus="${st.id}"><i></i>${st.name}</button>`).join('')}</div>`;
  }

  function propsSingle(sh) {
    const p = plan();
    if (sh.type === 'marker') {
      const m = MARKER[sh.icon] || MARKER.pin;
      return `<div class="prop-head"><div class="bub" style="background:${m.color}">${ic(m.id, 20)}</div><input class="title-input" data-prop="name" value="${esc(sh.name)}" placeholder="ตั้งชื่อ"></div>
        <div class="field"><span>ชนิดไอคอน</span><div class="icon-pick">${MARKERS.map(x => `<button data-seticon="${x.id}" class="${x.id === sh.icon ? 'on' : ''}"><span class="bub" style="background:${x.color}">${ic(x.id, 15)}</span>${x.name}</button>`).join('')}</div></div>
        <label class="field"><span>หมายเหตุ</span><textarea data-prop="note" placeholder="รายละเอียดเพิ่มเติม">${esc(sh.note)}</textarea></label>
        <div class="meta">ตำแหน่ง: ${fmtNum(sh.pos[0])}, ${fmtNum(sh.pos[1])} px<br>สร้างเมื่อ ${sh.created ? fmtTime(sh.created) : '—'}</div>
        <div class="actions"><button class="btn" data-cmd="zoomSel">${ic('fit', 16)}ซูมไปที่</button><button class="btn" data-cmd="duplicate">${ic('copy', 16)}ทำสำเนา</button><button class="btn danger" data-cmd="delete">${ic('trash', 16)}ลบ</button></div>`;
    }
    const st = STATUS[sh.status] || STATUS.available;
    const ar = areaText(area(sh.points), p.ppm);
    return `<div class="prop-head"><div class="bub" style="background:${st.color}">${ic(sh.kind === 'rect' ? 'square' : 'polygon', 20)}</div><input class="title-input" data-prop="name" value="${esc(sh.name)}" placeholder="ตั้งชื่อแปลง"></div>
      <div class="field"><span>สถานะ</span>${statusChips(sh.status)}</div>
      <div class="grid2">
        <label class="field"><span>ราคา (บาท)</span><input data-prop="price" inputmode="numeric" value="${sh.price ? fmtNum(sh.price) : ''}" placeholder="เช่น 3,500,000"></label>
        <div class="field"><span>พื้นที่</span><div class="readonly">${ar.main}<small>${ar.sub}</small></div></div>
      </div>
      <label class="field"><span>หมายเหตุ</span><textarea data-prop="note" placeholder="เช่น ชื่อผู้จอง เบอร์ติดต่อ">${esc(sh.note)}</textarea></label>
      <div class="meta">รูปทรง: ${sh.kind === 'rect' ? 'สี่เหลี่ยม' : 'Polygon'} · ${sh.points.length} จุด<br>สร้างเมื่อ ${sh.created ? fmtTime(sh.created) : '—'}</div>
      <div class="actions"><button class="btn" data-cmd="zoomSel">${ic('fit', 16)}ซูมไปที่</button><button class="btn" data-cmd="duplicate">${ic('copy', 16)}ทำสำเนา</button><button class="btn danger" data-cmd="delete">${ic('trash', 16)}ลบ</button></div>`;
  }

  function propsMulti(sel) {
    const polys = sel.filter(s => s.type !== 'marker');
    const cur = polys.length && polys.every(s => s.status === polys[0].status) ? polys[0].status : null;
    return `<div class="prop-head"><div class="bub" style="background:#1a73e8">${ic('selectAll', 20)}</div><div style="font-size:16px;font-weight:600">เลือก ${sel.length} รายการ</div></div>
      ${polys.length ? `<div class="field"><span>ตั้งสถานะให้ทั้งหมด (${polys.length} แปลง)</span>${statusChips(cur)}</div>` : ''}
      <div class="meta">${sel.map(s => esc(s.name)).join(', ')}</div>
      <div class="actions"><button class="btn" data-cmd="duplicate">${ic('copy', 16)}ทำสำเนา</button><button class="btn danger" data-cmd="delete">${ic('trash', 16)}ลบทั้งหมด</button></div>`;
  }

  function renderList() {
    const src = viewSrc(), q = $('#listSearch').value.trim().toLowerCase();
    const f = S.listFilter;
    $('#listFilter').innerHTML = [{ id: 'all', name: 'ทั้งหมด', color: '#5f6368' }, ...STATUSES, { id: 'marker', name: 'ไอคอน', color: '#e37400' }]
      .map(x => `<button class="chip-btn${f === x.id ? ' on' : ''}" style="--c:${x.color}" data-lfilter="${x.id}"><i></i>${x.name}</button>`).join('');
    const items = src.shapes.filter(s => {
      if (q && !(s.name || '').toLowerCase().includes(q) && !(s.note || '').toLowerCase().includes(q)) return false;
      if (f === 'all') return true;
      if (f === 'marker') return s.type === 'marker';
      return s.type !== 'marker' && s.status === f;
    }).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'th', { numeric: true }));
    $('#listItems').innerHTML = items.length ? items.map(s => {
      if (s.type === 'marker') { const m = MARKER[s.icon] || MARKER.pin; return `<div class="li${S.sel.has(s.id) ? ' on' : ''}" data-li="${s.id}" style="--c:${m.color}"><span class="mk">${ic(m.id, 12)}</span><span class="nm">${esc(s.name)}</span><span class="st">${m.name}</span></div>`; }
      const st = STATUS[s.status] || STATUS.available;
      return `<div class="li${S.sel.has(s.id) ? ' on' : ''}" data-li="${s.id}" style="--c:${st.color}"><span class="sw"></span><span class="nm">${esc(s.name)}</span><span class="st">${st.name}</span></div>`;
    }).join('') : `<div class="empty-list">${src.shapes.length ? 'ไม่พบรายการที่ตรงกับการค้นหา' : 'ยังไม่มีแปลงในชั้นนี้<br>เริ่มวาดด้วยเครื่องมือ “สี่เหลี่ยม” หรือ “Polygon”'}</div>`;
  }

  // --------------------------------------------------------------- timeline
  const NODE_GAP = 40, NODE_PAD = 26;
  function renderTimeline() {
    const p = plan(), tl = p.timeline;
    const cur = S.preview ?? tl.length - 1;
    $('#tlSub').textContent = `${unitName()} · ชั้น ${S.floor} · ${tl.length} รายการ`;
    const inner = $('#tlInner'), track = $('#tlTrack');
    const width = Math.max(track.clientWidth, NODE_PAD * 2 + (tl.length - 1) * NODE_GAP);
    inner.style.width = width + 'px';
    let h = `<div class="tl-rail"><div class="fill" style="width:${NODE_PAD + cur * NODE_GAP}px"></div></div>`;
    let lastDay = '';
    tl.forEach((e, i) => {
      const x = NODE_PAD + i * NODE_GAP, day = fmtDay(e.t), k = KINDS[e.kind] || KINDS.edit;
      const newDay = day !== lastDay;
      if (newDay) { h += `<div class="tl-day" style="left:${x - 4}px">${day}</div>`; lastDay = day; }
      const cls = ['tl-node', i === cur && S.preview != null ? 'on' : '', i > cur ? 'future' : '', i === tl.length - 1 ? 'latest' : '', newDay ? 'has-day' : ''].join(' ');
      h += `<button class="${cls}" style="left:${x}px;--k:${k.color}" data-tl="${i}" data-tip="${esc(e.label)}||${esc(fmtTime(e.t))} · ${k.name}">${ic(k.icon, 12)}</button>`;
    });
    inner.innerHTML = h;
    // info
    const e = tl[cur], k = KINDS[e.kind] || KINDS.edit;
    $('#tlInfo').innerHTML = S.preview != null
      ? `<div class="t1" style="--k:${k.color}"><i></i>#${cur + 1} / ${tl.length} · ${esc(e.label)}</div><div class="t2">${fmtTime(e.t)} · ${relTime(e.t)}</div>
         <div class="tl-actions"><button class="btn" data-cmd="tl:restore">${ic('reset', 14)}คืนค่าเวอร์ชันนี้</button><button class="btn primary" data-cmd="tl:exit">กลับสู่ปัจจุบัน</button></div>`
      : `<div class="t1" style="--k:${k.color}"><i></i>ล่าสุด: ${esc(e.label)}</div><div class="t2">${relTime(e.t)} · คลิกจุดบนเส้นเวลาเพื่อดูย้อนหลัง</div>`;
    $('#tlPlay').innerHTML = ic(playTimer ? 'pause' : 'play', 16);
    // keep the active node in view
    const x = NODE_PAD + cur * NODE_GAP;
    if (x < track.scrollLeft + 30 || x > track.scrollLeft + track.clientWidth - 30) track.scrollLeft = x - track.clientWidth / 2;
  }

  function setPreview(i) {
    const tl = plan().timeline;
    i = clamp(i, 0, tl.length - 1);
    S.draft = null;
    if (i === tl.length - 1) { exitPreview(); return; }
    S.preview = i;
    renderAll();
  }
  function exitPreview() {
    stopPlay();
    if (S.preview == null) return;
    S.preview = null;
    renderAll();
  }
  function restorePreview() {
    if (S.preview == null) return;
    const i = S.preview, e = plan().timeline[i];
    S.preview = null; stopPlay();
    change(`คืนค่าเป็นเวอร์ชัน #${i + 1} (${e.label})`, 'restore', [], p => restoreSnap(p, e.snap));
    toast(`คืนค่าเป็นเวอร์ชัน #${i + 1} แล้ว (เลิกทำได้ด้วย Ctrl+Z)`);
  }
  let playTimer = null;
  function play() {
    if (playTimer) { stopPlay(); renderTimeline(); return; }
    const tl = plan().timeline;
    if (tl.length < 2) return toast('ยังไม่มีประวัติให้เล่น');
    let i = S.preview != null && S.preview < tl.length - 2 ? S.preview : 0;
    S.preview = i; renderAll();
    playTimer = setInterval(() => {
      i++;
      if (i >= tl.length - 1) { stopPlay(); exitPreview(); toast('เล่นจนถึงปัจจุบันแล้ว'); return; }
      S.preview = i; renderAll();
    }, 750);
    renderTimeline();
  }
  function stopPlay() { if (playTimer) { clearInterval(playTimer); playTimer = null; } }
  function blockedByPreview() {
    if (S.preview == null) return false;
    toast('กำลังดูย้อนหลังอยู่ — กด “กลับสู่ปัจจุบัน” ก่อนแก้ไข', 'warn');
    return true;
  }

  // ------------------------------------------------------------- actions
  function setTool(t) {
    if (S.preview != null && t !== 'pan') { exitPreview(); }
    if (S.draft && S.draft.type === 'polygon' && t !== 'polygon') finishPolygon();
    S.tool = t; S.draft = null;
    if (t !== 'select') { /* keep selection visible but handles hidden */ }
    renderChrome(); requestRender();
  }

  function newShapeBase(kind) {
    return { id: uid(), type: 'area', kind, name: nextPlotName(), status: S.statusBrush, price: 0, note: '', created: Date.now() };
  }
  function createRect(a, b, square) {
    const pts = rectPoints(a, b, square);
    if (area(pts) * S.view.s * S.view.s < 60) return;
    const sh = { ...newShapeBase('rect'), points: pts };
    change(`เพิ่ม ${label(sh)} (สี่เหลี่ยม)`, 'add', [sh.id], p => p.shapes.push(sh));
    S.sel = new Set([sh.id]); renderAll();
  }
  function finishPolygon() {
    const d = S.draft;
    if (!d || d.type !== 'polygon') return;
    S.draft = null;
    if (d.points.length < 3) { if (d.points.length) toast('Polygon ต้องมีอย่างน้อย 3 จุด', 'warn'); requestRender(); return; }
    const sh = { ...newShapeBase('polygon'), points: d.points };
    change(`เพิ่ม ${label(sh)} (Polygon ${d.points.length} จุด)`, 'add', [sh.id], p => p.shapes.push(sh));
    S.sel = new Set([sh.id]); renderAll();
  }
  function placeMarker(sx, sy) {
    const m = MARKER[S.markerType];
    const sh = { id: uid(), type: 'marker', icon: m.id, name: m.name, note: '', pos: toPlan(sx, sy), created: Date.now() };
    change(`ปักไอคอน ${label(sh)}`, 'add', [sh.id], p => p.shapes.push(sh));
    S.sel = new Set([sh.id]); renderAll();
  }
  function deleteSel() {
    if (!S.sel.size) return toast('ยังไม่ได้เลือกรายการที่จะลบ');
    const ids = [...S.sel], txt = describe(ids);
    if (change(`ลบ ${txt}`, 'delete', ids, p => { p.shapes = p.shapes.filter(s => !S.sel.has(s.id)); })) {
      S.sel.clear(); renderAll();
      toast(`ลบ ${txt} แล้ว`, '', { text: 'เลิกทำ', fn: undo });
    }
  }
  function duplicateSel() {
    if (!S.sel.size) return;
    const off = 24 / S.view.s;
    const copies = [];
    const p = plan();
    for (const id of S.sel) {
      const sh = clone(shapeById(id)); sh.id = uid(); sh.created = Date.now();
      if (sh.type === 'marker') sh.pos = [sh.pos[0] + off, sh.pos[1] + off];
      else { sh.points = sh.points.map(q => [q[0] + off, q[1] + off]); }
      copies.push(sh);
    }
    change(`ทำสำเนา ${describe([...S.sel])}`, 'add', copies.map(c => c.id), pl => {
      for (const c of copies) { if (c.type !== 'marker') c.name = nextPlotName(pl); pl.shapes.push(c); }
    });
    S.sel = new Set(copies.map(c => c.id)); renderAll(); void p;
  }
  function setStatus(id) {
    S.statusBrush = id;
    const polys = [...S.sel].map(x => shapeById(x)).filter(s => s && s.type !== 'marker');
    if (polys.length && S.preview == null) {
      const ids = polys.map(s => s.id);
      change(`ตั้งสถานะ “${STATUS[id].name}” ให้ ${describe(ids)}`, 'status', ids, p => { for (const s of p.shapes) if (ids.includes(s.id)) s.status = id; });
    } else { save(); renderAll(); toast(`รูปที่วาดใหม่จะมีสถานะ “${STATUS[id].name}”`); }
  }
  function rotate(delta, abs) {
    const p = plan();
    const target = abs != null ? abs : ((((p.rotation + delta) + 180) % 360) + 360) % 360 - 180;
    if (Math.abs(target - p.rotation) < 1e-6) return;
    change(abs != null ? `ตั้งมุมแปลนเป็น ${fmtNum(target, 1)}°` : `หมุนแปลน ${delta > 0 ? 'ขวา' : 'ซ้าย'} ${Math.abs(delta)}°`, 'rotate', [], pl => { pl.rotation = Math.round(target * 10) / 10; }, abs != null ? 'rot-abs' : null);
  }
  function nudge(dx, dy) {
    if (!S.sel.size || blockedByPreview()) return;
    // convert screen direction to plan direction
    const a = toPlan(0, 0), b = toPlan(dx, dy), vx = b[0] - a[0], vy = b[1] - a[1];
    const ids = [...S.sel];
    change(`ขยับ ${describe(ids)}`, 'edit', ids, p => {
      for (const s of p.shapes) if (S.sel.has(s.id)) {
        if (s.type === 'marker') s.pos = [s.pos[0] + vx, s.pos[1] + vy];
        else s.points = s.points.map(q => [q[0] + vx, q[1] + vy]);
      }
    }, 'nudge:' + ids.join(','));
  }

  async function loadImageFile(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast('กรุณาเลือกไฟล์ภาพ (JPG, PNG, SVG)', 'err');
    if (blockedByPreview()) return;
    const url = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
    const dim = await new Promise(res => { const im = new Image(); im.onload = () => res([im.naturalWidth || 1600, im.naturalHeight || 1100]); im.onerror = () => res(null); im.src = url; });
    if (!dim) return toast('เปิดไฟล์ภาพนี้ไม่ได้', 'err');
    const id = 'img_' + uid();
    imageCache[id] = url;
    try { await ImageDB.put(id, url); } catch (e) { toast('เก็บภาพในเบราว์เซอร์ไม่ได้ ภาพจะหายเมื่อรีเฟรช — ใช้ “ส่งออกโปรเจกต์” เพื่อเก็บไว้', 'warn'); }
    setImage({ id, w: dim[0], h: dim[1], name: file.name }, `เปลี่ยนภาพผังเป็น “${file.name}”`);
  }
  function useSample() {
    if (blockedByPreview()) return;
    const idx = Math.max(0, S.project.units.findIndex(u => u.id === S.unit));
    const id = `sample:${idx}:${S.floor}:${encodeURIComponent(unitName())}`;
    setImage({ id, w: SamplePlan.W, h: SamplePlan.H, name: 'ผังตัวอย่าง' }, 'ใช้ภาพผังตัวอย่าง');
  }
  function setImage(img, lbl) {
    const p = plan(), first = !p.image && !p.shapes.length;
    change(lbl, 'plan', [], pl => { pl.image = img; pl.w = img.w; pl.h = img.h; });
    fit(!first);
    toast('โหลดภาพผังแล้ว · ' + (first ? 'เริ่มวาดได้เลย' : 'รูปที่วาดไว้ยังอยู่ครบ'));
  }
  function removeImage() {
    const p = plan(); if (!p.image) return;
    change('นำภาพผังออก', 'plan', [], pl => { pl.image = null; });
  }

  function switchTo(unit, floor) {
    if (S.draft) finishPolygon();
    exitPreview();
    S.views[pkey()] = { ...S.view };
    S.unit = unit; S.floor = floor; S.sel.clear(); S.draft = null;
    const v = S.views[pkey()];
    plan();
    if (v) S.view = { ...v }; else fit();
    save(); renderAll();
    if (!S.views[pkey()]) fit();
  }

  function exportProject() {
    const images = {};
    const jobs = Object.values(S.project.plans).flatMap(p => [p.image, ...p.timeline.map(e => e.snap.image)])
      .filter(im => im && !im.id.startsWith('sample:') && !images[im.id])
      .map(im => { images[im.id] = null; return (imageCache[im.id] ? Promise.resolve(imageCache[im.id]) : ImageDB.get(im.id).catch(() => null)).then(u => { images[im.id] = u; }); });
    Promise.all(jobs).then(() => {
      const data = { app: 'plan-drawer', v: 1, exported: new Date().toISOString(), project: S.project, images };
      download(new Blob([JSON.stringify(data)], { type: 'application/json' }), `${S.project.name || 'project'}-${new Date().toISOString().slice(0, 10)}.json`);
      toast('ส่งออกโปรเจกต์แล้ว');
    });
  }
  async function importProject(file) {
    try {
      const data = JSON.parse(await file.text());
      if (!data.project || !Array.isArray(data.project.units)) throw new Error('bad');
      for (const [id, url] of Object.entries(data.images || {})) if (url) { imageCache[id] = url; try { await ImageDB.put(id, url); } catch (e) { /* memory only */ } }
      S.project = data.project;
      for (const k of Object.keys(stacks)) delete stacks[k];
      S.views = {}; S.sel.clear(); S.preview = null;
      S.unit = S.project.units[0].id; S.floor = 1;
      save(); fit(); renderAll();
      toast('เปิดโปรเจกต์เรียบร้อย');
    } catch (e) { toast('ไฟล์นี้ไม่ใช่โปรเจกต์ที่ถูกต้อง', 'err'); }
  }
  function download(blob, name) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function exportPng() {
    const src = viewSrc();
    const url = imageUrl(src.image);
    const pad = 0, W = src.w, H = src.h;
    const fo = S.settings.fillOpacity;
    let body = url ? `<image href="${url}" width="${W}" height="${H}" opacity="${S.settings.imgOpacity}"/>` : `<rect width="${W}" height="${H}" fill="#fff"/>`;
    for (const sh of src.shapes) {
      if (sh.type === 'marker') continue;
      const st = STATUS[sh.status] || STATUS.available;
      body += `<polygon points="${polyPts(sh.points)}" fill="${st.color}" fill-opacity="${fo}" stroke="${st.color}" stroke-width="3"/>`;
      if (S.settings.labels && sh.name) { const [cx, cy] = centroid(sh.points); body += `<text x="${cx}" y="${cy + 6}" text-anchor="middle" font-size="18" font-weight="700" font-family="Tahoma, sans-serif" fill="#202124" stroke="#fff" stroke-width="4" paint-order="stroke">${esc(sh.name)}</text>`; }
    }
    if (S.settings.markers) for (const sh of src.shapes) if (sh.type === 'marker') body += markerSvg(sh, sh.pos[0], sh.pos[1]).replace(/class="[^"]*"/g, '');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W + pad * 2}" height="${H + pad * 2}" viewBox="0 0 ${W} ${H}">${body}</svg>`;
    const im = new Image();
    im.onload = () => {
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      c.getContext('2d').drawImage(im, 0, 0);
      c.toBlob(b => { if (b) { download(b, `${unitName()}-ชั้น${S.floor}.png`); toast('บันทึกภาพ PNG แล้ว'); } else toast('สร้างภาพไม่สำเร็จ', 'err'); });
    };
    im.onerror = () => toast('สร้างภาพไม่สำเร็จ', 'err');
    im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  // ------------------------------------------------------- unit menu & marker menu
  function openUnitMenu() {
    const m = $('#unitMenu');
    if (!m.hidden) { m.hidden = true; return; }
    closeMenus();
    m.innerHTML = `<div class="mtitle">เลือก Unit / โซน</div>` + S.project.units.map(u => {
      const n = FLOORS.filter(f => hasPlan(u.id, f)).length;
      return `<button class="unit-item${u.id === S.unit ? ' on' : ''}" data-unit="${esc(u.id)}">${ic('building', 15)}<span class="n">${esc(u.name)}</span><span class="meta">${n ? n + ' ชั้น' : ''}</span><span class="ed" data-rename="${esc(u.id)}" title="เปลี่ยนชื่อ">${ic('pencil', 13)}</span></button>`;
    }).join('') + `<hr><button class="unit-item" data-unit-add>${ic('plus', 15)}<span class="n">เพิ่ม Unit ใหม่</span></button>`;
    m.hidden = false;
  }
  function buildMarkerMenu() {
    $('#markerMenu').innerHTML = `<div class="gtitle">เลือกไอคอนที่จะปัก</div>` + MARKERS.map(m => `<button class="gal-item${m.id === S.markerType ? ' on' : ''}" data-marker="${m.id}"><span class="bub" style="background:${m.color}">${ic(m.id, 18)}</span>${m.name}</button>`).join('');
  }
  function closeMenus() { $$('.menu').forEach(m => m.hidden = true); }

  // --------------------------------------------------------------- commands
  function cmd(c, el) {
    const [a, b] = c.split(':');
    switch (a) {
      case 'tool': setTool(b); break;
      case 'undo': undo(); break;
      case 'redo': redo(); break;
      case 'delete': deleteSel(); break;
      case 'duplicate': duplicateSel(); break;
      case 'rotate': if (b === 'reset') rotate(0, 0); else rotate(+b); break;
      case 'upload': if (!blockedByPreview()) $('#fileImage').click(); break;
      case 'sample': useSample(); break;
      case 'import': $('#fileProject').click(); break;
      case 'export': exportProject(); break;
      case 'png': exportPng(); break;
      case 'image': if (b === 'remove') removeImage(); break;
      case 'fit': fit(true); break;
      case 'zoom': if (b === 'in') zoomCenter(1.3); else if (b === 'out') zoomCenter(1 / 1.3); else zoomTo100(); break;
      case 'zoomSel': { const sh = shapeById([...S.sel][0]); if (sh) zoomToShape(sh); break; }
      case 'help': $('#helpDlg').showModal(); break;
      case 'ribbon': S.settings.ribbon = !S.settings.ribbon; save(); renderChrome(); setTimeout(() => { requestRender(); renderTimeline(); }, 0); break;
      case 'toggle': S.settings[b] = !S.settings[b]; save(); renderAll(); if (b === 'panel' || b === 'timeline') requestAnimationFrame(() => { renderTimeline(); requestRender(); }); break;
      case 'markerMenu': { const m = $('#markerMenu'); const open = m.hidden; closeMenus(); if (open) {
          buildMarkerMenu(); m.hidden = false;
          // วางเมนูแบบ fixed เพื่อไม่ให้ถูกตัดโดยแถบ ribbon ที่เลื่อนได้
          const r = $('#markerSplit').getBoundingClientRect();
          m.style.left = clamp(r.left, 8, innerWidth - m.offsetWidth - 8) + 'px'; m.style.top = (r.bottom + 4) + 'px';
        } break; }
      case 'unitMenu': openUnitMenu(); break;
      case 'dismissEmpty': S.dismissedEmpty[pkey()] = true; renderChrome(); break;
      case 'tl': {
        const tl = plan().timeline, cur = S.preview ?? tl.length - 1;
        if (b === 'first') setPreview(0);
        else if (b === 'prev') setPreview(cur - 1);
        else if (b === 'next') setPreview(cur + 1);
        else if (b === 'exit') exitPreview();
        else if (b === 'play') play();
        else if (b === 'restore') restorePreview();
        break;
      }
      case 'resetAll':
        if (confirm('ลบข้อมูลทุก Unit / ชั้น รวมถึงประวัติทั้งหมดในเบราว์เซอร์นี้?\n(แนะนำให้ “ส่งออกโปรเจกต์” เก็บไว้ก่อน)')) {
          try { localStorage.removeItem(LS_KEY); } catch (e) { /* ignore */ }
          ImageDB.clear().catch(() => {});
          S.project = defaultProject(); S.unit = 'A'; S.floor = 1; S.sel.clear(); S.preview = null; S.views = {}; S.dismissedEmpty = {};
          for (const k of Object.keys(stacks)) delete stacks[k];
          plan(); fit(); save(); renderAll(); toast('ล้างข้อมูลแล้ว');
        }
        break;
    }
    void el;
  }

  document.addEventListener('click', e => {
    const t = e.target;
    const c = t.closest('[data-cmd]');
    if (c && !c.disabled) { cmd(c.dataset.cmd, c); if (!c.closest('.menu') && c.dataset.cmd !== 'markerMenu' && c.dataset.cmd !== 'unitMenu') closeMenus(); return; }
    const tab = t.closest('.rb-tab');
    if (tab) {
      $$('.rb-tab').forEach(x => x.classList.toggle('active', x === tab));
      $$('.rb-panel').forEach(x => x.classList.toggle('active', x.dataset.panel === tab.dataset.tab));
      if (!S.settings.ribbon) { S.settings.ribbon = true; renderChrome(); requestRender(); }
      return;
    }
    const sw = t.closest('[data-status]'); if (sw) { setStatus(sw.dataset.status); return; }
    const mk = t.closest('[data-marker]');
    if (mk) { S.markerType = mk.dataset.marker; closeMenus(); setTool('marker'); save(); return; }
    const fl = t.closest('[data-floor]'); if (fl) { switchTo(S.unit, +fl.dataset.floor); return; }
    const rn = t.closest('[data-rename]');
    if (rn) {
      e.stopPropagation();
      const u = unitObj(rn.dataset.rename), name = prompt('ชื่อ Unit / โซน', u.name);
      if (name && name.trim()) { u.name = name.trim(); save(); renderAll(); openUnitMenu(); openUnitMenu(); }
      return;
    }
    const un = t.closest('[data-unit]'); if (un) { closeMenus(); switchTo(un.dataset.unit, S.floor); return; }
    if (t.closest('[data-unit-add]')) {
      closeMenus();
      const name = prompt('ชื่อ Unit / โซนใหม่', `โซน ${String.fromCharCode(65 + S.project.units.length)}`);
      if (name && name.trim()) { const id = 'U' + uid(); S.project.units.push({ id, name: name.trim() }); switchTo(id, 1); toast(`เพิ่ม “${name.trim()}” แล้ว`); }
      return;
    }
    const tlNode = t.closest('[data-tl]'); if (tlNode) { stopPlay(); setPreview(+tlNode.dataset.tl); return; }
    const ss = t.closest('[data-setstatus]'); if (ss) { setStatus(ss.dataset.setstatus); return; }
    const si = t.closest('[data-seticon]');
    if (si) { const id = [...S.sel][0], m = MARKER[si.dataset.seticon]; change(`เปลี่ยนไอคอนเป็น “${m.name}”`, 'edit', [id], p => { const s = shapeById(id, p); const wasDefault = MARKERS.some(x => x.name === s.name); s.icon = m.id; if (wasDefault) s.name = m.name; }); return; }
    const pt = t.closest('[data-ptab]');
    if (pt) { ptab = pt.dataset.ptab; $$('.side-tab').forEach(x => x.classList.toggle('active', x === pt)); $('#panelProps').hidden = ptab !== 'props'; $('#panelList').hidden = ptab !== 'list'; renderPanel(); return; }
    const lf = t.closest('[data-lfilter]'); if (lf) { S.listFilter = lf.dataset.lfilter; renderList(); return; }
    const sf = t.closest('[data-filter]');
    if (sf) { S.listFilter = sf.dataset.filter; $('[data-ptab="list"]').click(); return; }
    const li = t.closest('[data-li]');
    if (li) {
      const id = li.dataset.li;
      if (S.preview == null) { if (e.shiftKey) { S.sel.has(id) ? S.sel.delete(id) : S.sel.add(id); } else S.sel = new Set([id]); }
      const sh = shapeById(id, viewSrc()); if (sh) zoomToShape(sh);
      renderAll(); return;
    }
    if (!t.closest('.menu')) closeMenus();
  });

  // property edits (live + record on change)
  let propBefore = null;
  $('#panelProps').addEventListener('focusin', e => { if (e.target.dataset.prop) propBefore = snap(); });
  $('#panelProps').addEventListener('input', e => {
    const k = e.target.dataset.prop; if (!k || S.preview != null) return;
    const sh = shapeById([...S.sel][0]); if (!sh) return;
    if (k === 'name') { sh.name = e.target.value; requestRender(); }
  });
  $('#panelProps').addEventListener('change', e => {
    const k = e.target.dataset.prop; if (!k || S.preview != null) return;
    const sh = shapeById([...S.sel][0]); if (!sh) return;
    const v = e.target.value;
    if (k === 'price') { const n = +v.replace(/[^\d.]/g, ''); sh.price = isFinite(n) ? n : 0; }
    else sh[k] = v.trim();
    const names = { name: 'ชื่อ', price: 'ราคา', note: 'หมายเหตุ' };
    record(propBefore || snap(), `แก้ไข${names[k]} ${label(sh)}`, 'edit', [sh.id]);
    propBefore = null;
  });
  $('#panelProps').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('input')) e.target.blur(); });
  $('#listSearch').addEventListener('input', renderList);
  $('#ribbon').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('input')) e.target.blur(); });

  // ribbon inputs
  let rotBefore = null;
  $('#rotRange').addEventListener('input', e => {
    if (blockedByPreview()) return;
    if (!rotBefore) rotBefore = snap();
    plan().rotation = +e.target.value; $('#rotOut').textContent = Math.round(+e.target.value) + '°';
    requestRender();
  });
  $('#rotRange').addEventListener('change', () => {
    if (!rotBefore) return;
    record(rotBefore, `ตั้งมุมแปลนเป็น ${fmtNum(plan().rotation, 1)}°`, 'rotate', [], 'rot-abs'); rotBefore = null;
  });
  $('#rotNum').addEventListener('change', e => { const v = clamp(+e.target.value || 0, -180, 180); rotate(0, v); });
  $('#imgOpacity').addEventListener('input', e => { S.settings.imgOpacity = +e.target.value; $('#imgOpacityOut').textContent = Math.round(e.target.value * 100) + '%'; requestRender(); save(); });
  $('#fillOpacity').addEventListener('input', e => { S.settings.fillOpacity = +e.target.value; $('#fillOpacityOut').textContent = Math.round(e.target.value * 100) + '%'; requestRender(); save(); });
  $('#ppm').addEventListener('change', e => { const v = Math.max(0, +e.target.value || 0); if (S.preview == null) { plan().ppm = v; save(); renderPanel(); toast(v ? `ตั้งมาตราส่วน 1 ม. = ${v} px แล้ว` : 'ยกเลิกมาตราส่วนแล้ว'); } });
  $('#tlCompare').addEventListener('change', e => { S.compare = e.target.checked; requestRender(); });
  $('#fileImage').addEventListener('change', e => { loadImageFile(e.target.files[0]); e.target.value = ''; });
  $('#fileProject').addEventListener('change', e => { if (e.target.files[0]) importProject(e.target.files[0]); e.target.value = ''; });
  $('#helpDlg').addEventListener('click', e => { if (e.target.closest('[data-close]') || e.target === e.currentTarget) $('#helpDlg').close(); });

  // ------------------------------------------------------------ pointer input
  let drag = null, spaceDown = false;
  const pointers = new Map();
  const local = e => { const r = stage.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

  function startPan(pt) { drag = { mode: 'pan', start: pt, v0: { ...S.view } }; S.panning = true; stageWrap.classList.add('panning'); }

  stage.addEventListener('pointerdown', e => {
    closeMenus(); hideTip();
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    stage.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, local(e));
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      drag = { mode: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y), m0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, v0: { ...S.view } };
      return;
    }
    const pt = local(e);
    if (e.button === 1 || e.button === 2 || spaceDown || S.tool === 'pan' || S.preview != null) { e.preventDefault(); startPan(pt); return; }
    if (e.button !== 0) return;
    const tgt = e.target.closest('[data-id],[data-vertex],[data-mid]');
    switch (S.tool) {
      case 'select': {
        if (tgt && tgt.dataset.vertex != null) {
          const id = [...S.sel][0];
          drag = { mode: 'vertex', id, i: +tgt.dataset.vertex, before: snap(), moved: false };
        } else if (tgt && tgt.dataset.mid != null) {
          const id = [...S.sel][0], sh = shapeById(id), i = +tgt.dataset.mid;
          const before = snap();
          const a = sh.points[i], b = sh.points[(i + 1) % sh.points.length];
          sh.points.splice(i + 1, 0, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
          if (sh.kind === 'rect') sh.kind = 'polygon';
          drag = { mode: 'vertex', id, i: i + 1, before, moved: true, inserted: true };
          requestRender();
        } else if (tgt && tgt.dataset.id) {
          const id = tgt.dataset.id;
          if (e.shiftKey || e.ctrlKey || e.metaKey) { S.sel.has(id) ? S.sel.delete(id) : S.sel.add(id); }
          else if (!S.sel.has(id)) S.sel = new Set([id]);
          const orig = {};
          for (const sid of S.sel) { const s = shapeById(sid); if (s) orig[sid] = clone(s.type === 'marker' ? s.pos : s.points); }
          drag = { mode: 'move', start: toPlan(pt.x, pt.y), startScr: pt, before: snap(), orig, moved: false };
          renderAll();
        } else {
          if (!e.shiftKey && S.sel.size) { S.sel.clear(); renderAll(); }
          startPan(pt);
        }
        break;
      }
      case 'rect':
        drag = { mode: 'rect' };
        S.draft = { type: 'rect', a: [pt.x, pt.y], b: [pt.x, pt.y], square: e.shiftKey };
        break;
      case 'polygon': case 'marker':
        drag = { mode: 'click', start: pt, v0: { ...S.view } };
        break;
    }
  });

  stage.addEventListener('pointermove', e => {
    const pt = local(e);
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, pt);
    S.cursor = pt;
    const pp = toPlan(pt.x, pt.y);
    $('#sbPos').textContent = `x ${fmtNum(pp[0])} · y ${fmtNum(pp[1])}`;
    if (!drag) {
      if (S.draft && S.draft.type === 'polygon') {
        const f = S.draft.points[0], fs = toScreen(f[0], f[1]);
        S.draft.nearFirst = S.draft.points.length >= 3 && Math.hypot(fs[0] - pt.x, fs[1] - pt.y) < 12;
      }
      if (S.tool === 'polygon' || S.tool === 'marker') requestRender();
      return;
    }
    switch (drag.mode) {
      case 'pinch': {
        if (pointers.size < 2) break;
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y), m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const k = clamp(drag.v0.s * d / drag.d0, 0.03, 30) / drag.v0.s;
        S.view = { s: drag.v0.s * k, tx: m.x - (drag.m0.x - drag.v0.tx) * k, ty: m.y - (drag.m0.y - drag.v0.ty) * k };
        requestRender(); break;
      }
      case 'pan':
        S.view = { ...drag.v0, tx: drag.v0.tx + pt.x - drag.start.x, ty: drag.v0.ty + pt.y - drag.start.y };
        requestRender(); break;
      case 'click':
        if (Math.hypot(pt.x - drag.start.x, pt.y - drag.start.y) > 6) startPan(drag.start);
        break;
      case 'vertex': {
        const sh = shapeById(drag.id); if (!sh) break;
        sh.points[drag.i] = pp; drag.moved = true;
        if (sh.kind === 'rect') sh.kind = 'polygon';
        requestRender(); break;
      }
      case 'move': {
        if (!drag.moved && Math.hypot(pt.x - drag.startScr.x, pt.y - drag.startScr.y) < 3) break;
        drag.moved = true;
        const dx = pp[0] - drag.start[0], dy = pp[1] - drag.start[1];
        for (const [id, o] of Object.entries(drag.orig)) {
          const s = shapeById(id); if (!s) continue;
          if (s.type === 'marker') s.pos = [o[0] + dx, o[1] + dy];
          else s.points = o.map(q => [q[0] + dx, q[1] + dy]);
        }
        requestRender(); break;
      }
      case 'rect':
        S.draft.b = [pt.x, pt.y]; S.draft.square = e.shiftKey; requestRender(); break;
    }
  });

  function endPointer(e) {
    pointers.delete(e.pointerId);
    if (!drag) return;
    const d = drag, pt = local(e);
    if (d.mode === 'pinch') { if (pointers.size < 2) drag = null; return; }
    drag = null;
    S.panning = false; stageWrap.classList.remove('panning');
    if (e.type === 'pointercancel') { if (d.mode === 'rect') S.draft = null; requestRender(); return; }
    switch (d.mode) {
      case 'pan':
        S.views[pkey()] = { ...S.view }; break;
      case 'vertex': if (d.moved) record(d.before, `${d.inserted ? 'เพิ่มจุดยอดให้' : 'แก้ไขรูปร่าง'} ${label(shapeById(d.id))}`, 'edit', [d.id]); break;
      case 'move': if (d.moved) record(d.before, `ย้าย ${describe(Object.keys(d.orig))}`, 'edit', Object.keys(d.orig)); break;
      case 'rect': { const r = S.draft; S.draft = null; createRect(r.a, r.b, r.square); requestRender(); break; }
      case 'click':
        if (S.tool === 'marker') placeMarker(pt.x, pt.y);
        else if (S.tool === 'polygon') addPolyPoint(pt);
        break;
    }
  }
  stage.addEventListener('pointerup', endPointer);
  stage.addEventListener('pointercancel', endPointer);
  stage.addEventListener('pointerleave', () => { if (!drag) { S.cursor = null; requestRender(); } });
  stage.addEventListener('contextmenu', e => e.preventDefault());

  function addPolyPoint(pt) {
    if (S.preview != null) return;
    let d = S.draft;
    if (!d || d.type !== 'polygon') d = S.draft = { type: 'polygon', points: [] };
    if (d.points.length >= 3) {
      const f = toScreen(d.points[0][0], d.points[0][1]);
      if (Math.hypot(f[0] - pt.x, f[1] - pt.y) < 12) { finishPolygon(); return; }
    }
    const last = d.points[d.points.length - 1];
    if (last) { const ls = toScreen(last[0], last[1]); if (Math.hypot(ls[0] - pt.x, ls[1] - pt.y) < 3) return; }
    d.points.push(toPlan(pt.x, pt.y));
    renderChrome(); requestRender();
  }

  stage.addEventListener('dblclick', e => {
    if (S.preview != null) return;
    if (S.tool === 'polygon' && S.draft) { finishPolygon(); return; }
    if (S.tool === 'select') {
      const v = e.target.closest('[data-vertex]');
      if (v) {
        const id = [...S.sel][0], sh = shapeById(id), i = +v.dataset.vertex;
        if (sh.points.length <= 3) return toast('Polygon ต้องมีอย่างน้อย 3 จุด', 'warn');
        change(`ลบจุดยอดของ ${label(sh)}`, 'edit', [id], p => { const s = shapeById(id, p); s.points.splice(i, 1); s.kind = 'polygon'; });
        return;
      }
      const t = e.target.closest('[data-id]');
      if (t) {
        if (!S.settings.panel) { S.settings.panel = true; renderAll(); }
        ptab = 'props'; $('[data-ptab="props"]').click();
        setTimeout(() => { const n = $('#panelProps [data-prop="name"]'); if (n) { n.focus(); n.select(); } }, 30);
      }
    }
  });

  stage.addEventListener('wheel', e => {
    e.preventDefault();
    const pt = local(e);
    if (e.ctrlKey || Math.abs(e.deltaY) >= Math.abs(e.deltaX)) {
      const dy = e.deltaMode === 1 ? e.deltaY * 30 : e.deltaY;
      zoomAt(pt.x, pt.y, Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0018)));
    } else {
      S.view = { ...S.view, tx: S.view.tx - e.deltaX, ty: S.view.ty - e.deltaY }; requestRender();
    }
  }, { passive: false });

  // drag & drop images
  let dragDepth = 0;
  stageWrap.addEventListener('dragenter', e => { if ([...e.dataTransfer.types].includes('Files')) { dragDepth++; $('#dropzone').hidden = false; e.preventDefault(); } });
  stageWrap.addEventListener('dragover', e => { if ([...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
  stageWrap.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; $('#dropzone').hidden = true; } });
  stageWrap.addEventListener('drop', e => {
    e.preventDefault(); dragDepth = 0; $('#dropzone').hidden = true;
    const f = [...e.dataTransfer.files][0];
    if (f && /json$/i.test(f.name)) importProject(f); else loadImageFile(f);
  });

  // ------------------------------------------------------------ keyboard
  document.addEventListener('keydown', e => {
    const typing = e.target.matches('input, textarea, select, [contenteditable]');
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); exportProject(); return; }
    if (mod && e.key === 'F1') { e.preventDefault(); cmd('ribbon'); return; }
    if (typing) { if (e.key === 'Escape') e.target.blur(); return; }
    if ($('#helpDlg').open) return;
    const k = e.key;
    if (mod && k.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (mod && k.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
    if (mod && k.toLowerCase() === 'd') { e.preventDefault(); duplicateSel(); return; }
    if (mod && k.toLowerCase() === 'a') { e.preventDefault(); if (S.preview == null) { S.sel = new Set(plan().shapes.map(s => s.id)); setTool('select'); renderAll(); } return; }
    if (e.altKey && (k === 'ArrowLeft' || k === 'ArrowRight')) { e.preventDefault(); cmd(k === 'ArrowLeft' ? 'tl:prev' : 'tl:next'); return; }
    if (mod || e.altKey) return;
    if (k === ' ') { e.preventDefault(); if (!spaceDown) { spaceDown = true; stageWrap.classList.add('space'); } return; }
    if (S.draft && S.draft.type === 'polygon') {
      if (k === 'Enter') { finishPolygon(); return; }
      if (k === 'Backspace') { e.preventDefault(); S.draft.points.pop(); if (!S.draft.points.length) S.draft = null; renderChrome(); requestRender(); return; }
    }
    if (k === 'Escape') {
      if (S.draft) { S.draft = null; requestRender(); renderChrome(); }
      else if (S.preview != null) exitPreview();
      else if (S.sel.size) { S.sel.clear(); renderAll(); }
      else if (S.tool !== 'select') setTool('select');
      closeMenus(); return;
    }
    if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); deleteSel(); return; }
    if (k.startsWith('Arrow') && S.sel.size) {
      e.preventDefault(); const st = e.shiftKey ? 10 : 1;
      nudge(k === 'ArrowLeft' ? -st : k === 'ArrowRight' ? st : 0, k === 'ArrowUp' ? -st : k === 'ArrowDown' ? st : 0); return;
    }
    const map = { v: 'select', h: 'pan', r: 'rect', p: 'polygon', i: 'marker' };
    const lk = k.toLowerCase();
    if (map[lk]) { setTool(map[lk]); return; }
    if (k === '[') return rotate(-90);
    if (k === ']') return rotate(90);
    if (k === '+' || k === '=') return zoomCenter(1.3);
    if (k === '-') return zoomCenter(1 / 1.3);
    if (k === '0') return fit(true);
    if (k === '?') return $('#helpDlg').showModal();
    if (k === 'Home') return cmd('tl:first');
    if (k === 'End') return cmd('tl:exit');
    if (/^[1-4]$/.test(k)) return switchTo(S.unit, +k);
  });
  document.addEventListener('keyup', e => { if (e.key === ' ') { spaceDown = false; stageWrap.classList.remove('space'); } });
  window.addEventListener('blur', () => { spaceDown = false; stageWrap.classList.remove('space'); });

  // ------------------------------------------------------------ tooltip
  const tipEl = $('#tooltip'); let tipT = null, tipFor = null;
  function hideTip() { clearTimeout(tipT); tipEl.hidden = true; tipFor = null; }
  document.addEventListener('pointerover', e => {
    const el = e.target.closest('[data-tip]');
    if (el === tipFor) return;
    hideTip();
    if (!el || e.pointerType === 'touch') return;
    tipFor = el;
    tipT = setTimeout(() => {
      const [title, key, desc] = el.dataset.tip.split('|');
      tipEl.innerHTML = `<b>${esc(title)}</b>${key ? `<kbd>${esc(key)}</kbd>` : ''}${desc ? `<p>${esc(desc)}</p>` : ''}`;
      tipEl.hidden = false;
      const r = el.getBoundingClientRect(), tr = tipEl.getBoundingClientRect();
      let x = r.left + r.width / 2 - tr.width / 2, y = r.bottom + 8;
      if (y + tr.height > innerHeight - 8) y = r.top - tr.height - 8;
      tipEl.style.left = clamp(x, 8, innerWidth - tr.width - 8) + 'px';
      tipEl.style.top = y + 'px';
    }, 450);
  });
  document.addEventListener('pointerdown', hideTip, true);

  // ------------------------------------------------------------ toast
  function toast(msg, type = '', action) {
    const t = document.createElement('div');
    t.className = 'toast ' + type; t.textContent = msg;
    if (action) { const b = document.createElement('button'); b.textContent = action.text; b.onclick = () => { action.fn(); t.remove(); }; t.appendChild(b); }
    const box = $('#toasts');
    box.appendChild(t);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => t.remove(), action ? 5000 : 2600);
  }

  // ------------------------------------------------------------ init
  function init() {
    $$('[data-icon]').forEach(el => { el.insertAdjacentHTML('afterbegin', ic(el.dataset.icon, 20)); });
    $('#statusGallery').innerHTML = STATUSES.map(s => `<button class="swatch" style="--c:${s.color}" data-status="${s.id}" data-tip="สถานะ: ${s.name}||คลิกเพื่อใช้กับแปลงที่เลือก และเป็นสถานะเริ่มต้นของรูปที่วาดใหม่"><span class="chip"></span>${s.name}</button>`).join('');
    load();
    plan();
    renderAll();
    fit();
    renderAll();
    window.addEventListener('resize', () => { requestRender(); renderTimeline(); });
    setInterval(() => { if (S.preview == null) renderTimeline(); }, 60000);
  }
  init();

  // สำหรับดีบัก / ทดสอบ
  window.PlanDrawer = { S, plan, toScreen, toPlan, setTool, undo, redo, switchTo };
})();
