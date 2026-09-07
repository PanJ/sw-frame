/* ---------------------------------------------------------------
   #สั่งฟ้องสว. — ตัวสร้างภาพโปรไฟล์
   ทำงานในเบราว์เซอร์ทั้งหมด ไม่มีการอัปโหลดหรือเก็บข้อมูลใด ๆ

   เฟรมถูกแยกเป็นชิ้นส่วน (มือ / โลโก้) เพื่อให้ลากจัดตำแหน่งแยกกันได้
   ทุกชิ้นวางในระบบพิกัด 1200×1200 ขนาดเท่าไฟล์จริง จึงวาดแบบ 1:1
---------------------------------------------------------------- */
(() => {
  'use strict';

  const SIZE = 1200;              // ขนาดภาพที่บันทึกจริง (px)

  const FRAMES = [
    {
      id: 'PF-03', label: 'นิ้วชี้ + ข้อความด้านขวา', thumb: 'frames/thumb-PF-03.png',
      parts: [
        { key: 'hand', label: 'มือ', src: 'frames/hand-lg.png', x: 132, y: 390, w: 417, h: 357 },
        { key: 'logo', label: 'โลโก้', src: 'frames/logo-tall.png', x: 623, y: 192, w: 455, h: 821 }
      ]
    },
    {
      id: 'PF-04', label: 'ข้อความด้านขวา', thumb: 'frames/thumb-PF-04.png',
      parts: [
        { key: 'logo', label: 'โลโก้', src: 'frames/logo-tall.png', x: 623, y: 192, w: 455, h: 821 }
      ]
    },
    {
      id: 'PF-05', label: 'นิ้วชี้ + ข้อความด้านล่าง', thumb: 'frames/thumb-PF-05.png',
      parts: [
        { key: 'hand', label: 'มือ', src: 'frames/hand-sm.png', x: 95, y: 317, w: 376, h: 322 },
        { key: 'logo', label: 'โลโก้', src: 'frames/logo-wide.png', x: 176, y: 753, w: 884, h: 314 }
      ]
    },
    {
      id: 'PF-06', label: 'ข้อความด้านล่าง', thumb: 'frames/thumb-PF-06.png',
      parts: [
        { key: 'logo', label: 'โลโก้', src: 'frames/logo-wide.png', x: 176, y: 753, w: 884, h: 314 }
      ]
    }
  ];

  const $ = (id) => document.getElementById(id);
  const stage = $('stage');
  const canvas = $('canvas');
  const ctx = canvas.getContext('2d');
  const fileInput = $('file');
  const zoomInput = $('zoom');
  const controls = $('controls');
  const targetsEl = $('targets');
  const saveBtn = $('saveBtn');
  const shareBtn = $('shareBtn');
  const saveNote = $('saveNote');
  const sheet = $('sheet');

  /* ---------------- state ---------------- */

  const view = { scale: 1, x: SIZE / 2, y: SIZE / 2, rot: 0 }; // rot = จำนวนควอเตอร์เทิร์น
  let photo = null;             // ImageBitmap | HTMLImageElement
  let parts = [];               // ชิ้นส่วนของเฟรมที่เลือกอยู่ { def, res, dx, dy }
  let frameIndex = 0;
  let target = 'photo';         // สิ่งที่ปุ่มลูกศรจะขยับ: 'photo' หรือ key ของชิ้นส่วน
  let noteTimer = 0;

  /* ---------------- helpers ---------------- */

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const swapped = () => view.rot % 2 === 1;
  const photoW = () => (photo ? (swapped() ? photo.height : photo.width) : SIZE);
  const photoH = () => (photo ? (swapped() ? photo.width : photo.height) : SIZE);

  const containScale = () => Math.min(SIZE / photoW(), SIZE / photoH());
  const coverScale = () => Math.max(SIZE / photoW(), SIZE / photoH());
  const minScale = () => containScale() * 0.5;
  const maxScale = () => containScale() * 12;

  /** จำกัดการเลื่อนรูป: ถ้ารูปใหญ่กว่ากรอบจะไม่ยอมให้เกิดขอบว่าง
      ถ้าเล็กกว่ากรอบจะไม่ยอมให้รูปหลุดออกนอกกรอบ */
  function clampView() {
    const hw = (photoW() * view.scale) / 2;
    const hh = (photoH() * view.scale) / 2;
    view.x = hw >= SIZE / 2 ? clamp(view.x, SIZE - hw, hw) : clamp(view.x, hw, SIZE - hw);
    view.y = hh >= SIZE / 2 ? clamp(view.y, SIZE - hh, hh) : clamp(view.y, hh, SIZE - hh);
  }

  /** ชิ้นส่วนของเฟรมขยับได้อย่างเดียว (ไม่ย่อ/ขยาย) และต้องอยู่ในกรอบเสมอ */
  function clampPart(p) {
    p.dx = clamp(p.dx, -p.def.x, SIZE - p.def.x - p.def.w);
    p.dy = clamp(p.dy, -p.def.y, SIZE - p.def.y - p.def.h);
  }

  function setScale(next, anchor) {
    const prev = view.scale;
    view.scale = clamp(next, minScale(), maxScale());
    if (anchor) {
      const k = view.scale / prev;
      view.x = anchor.x + (view.x - anchor.x) * k;
      view.y = anchor.y + (view.y - anchor.y) * k;
    }
    clampView();
    syncZoomInput();
    render();
  }

  function syncZoomInput() {
    const lo = Math.log(minScale());
    const hi = Math.log(maxScale());
    zoomInput.value = String(Math.round(((Math.log(view.scale) - lo) / (hi - lo)) * 1000));
  }

  function fitPhoto() {
    if (!photo) return;
    view.rot = 0;
    view.scale = coverScale();
    view.x = SIZE / 2;
    view.y = SIZE / 2;
    clampView();
    syncZoomInput();
  }

  /* ---------------- frame parts ---------------- */

  // แคชรูปชิ้นส่วน พร้อมแคนวาสสำรองไว้อ่านค่า alpha สำหรับทดสอบการคลิก
  const partCache = new Map();

  function loadPart(src) {
    if (partCache.has(src)) return partCache.get(src);
    const res = { img: new Image(), ready: false, hit: null };
    res.img.decoding = 'async';
    res.img.onload = () => {
      res.ready = true;
      const off = document.createElement('canvas');
      off.width = res.img.naturalWidth;
      off.height = res.img.naturalHeight;
      const hx = off.getContext('2d', { willReadFrequently: true });
      hx.drawImage(res.img, 0, 0);
      res.hit = hx;
      render();
    };
    res.img.src = src;
    partCache.set(src, res);
    return res;
  }

  function alphaAt(p, lx, ly) {
    if (!p.res.hit) return 0;
    return p.res.hit.getImageData(lx, ly, 1, 1).data[3];
  }

  /** ชิ้นส่วนบนสุดที่มีเนื้อภาพอยู่ตรงจุดนั้น (ไล่จากชิ้นที่วาดทีหลังก่อน) */
  function hitPart(pt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      if (!p.res.ready) continue;
      const lx = Math.floor(pt.x - (p.def.x + p.dx));
      const ly = Math.floor(pt.y - (p.def.y + p.dy));
      if (lx < 0 || ly < 0 || lx >= p.def.w || ly >= p.def.h) continue;
      if (alphaAt(p, lx, ly) > 20) return p;
    }
    return null;
  }

  const activePart = () => parts.find((p) => p.def.key === target) || null;

  /* ---------------- drawing ---------------- */

  function paint(out, size, guides) {
    const k = size / SIZE;
    out.save();
    out.fillStyle = '#ffffff';
    out.fillRect(0, 0, size, size);

    if (photo) {
      out.save();
      out.translate(view.x * k, view.y * k);
      out.rotate((view.rot * Math.PI) / 2);
      out.imageSmoothingEnabled = true;
      out.imageSmoothingQuality = 'high';
      const w = photo.width * view.scale * k;
      const h = photo.height * view.scale * k;
      out.drawImage(photo, -w / 2, -h / 2, w, h);
      out.restore();
    }

    for (const p of parts) {
      if (!p.res.ready) continue;
      out.drawImage(p.res.img, (p.def.x + p.dx) * k, (p.def.y + p.dy) * k, p.def.w * k, p.def.h * k);
    }

    // เส้นประบอกว่าปุ่มลูกศรกำลังขยับชิ้นไหน — วาดเฉพาะบนจอ ไม่ติดไปในไฟล์ที่บันทึก
    if (guides && photo) {
      const p = activePart();
      if (p) {
        out.save();
        out.setLineDash([16, 12]);
        out.lineWidth = 5;
        out.strokeStyle = 'rgba(36, 0, 165, .9)';
        out.strokeRect((p.def.x + p.dx) * k, (p.def.y + p.dy) * k, p.def.w * k, p.def.h * k);
        out.restore();
      }
    }
    out.restore();
  }

  let queued = false;
  function render() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      paint(ctx, SIZE, true);
    });
  }

  /* ---------------- frame picker ---------------- */

  function loadFrame(index) {
    frameIndex = index;
    parts = FRAMES[index].parts.map((def) => ({ def, res: loadPart(def.src), dx: 0, dy: 0 }));
    setTarget('photo');
    buildTargets();
    [...$('frameList').querySelectorAll('button')].forEach((b, i) => {
      b.setAttribute('aria-checked', String(i === index));
      b.tabIndex = i === index ? 0 : -1;
    });
    render();
  }

  function buildFrameList() {
    const list = $('frameList');
    FRAMES.forEach((f, i) => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-checked', String(i === 0));
      btn.title = f.label;
      btn.innerHTML = `<img src="${f.thumb}" alt="${f.label}" width="320" height="320" loading="lazy">`;
      btn.addEventListener('click', () => loadFrame(i));
      btn.addEventListener('keydown', (e) => {
        const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1
          : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
        if (!dir) return;
        e.preventDefault();
        const next = (i + dir + FRAMES.length) % FRAMES.length;
        loadFrame(next);
        list.querySelectorAll('button')[next].focus();
      });
      li.appendChild(btn);
      list.appendChild(li);
    });
  }

  /* ---------------- ตัวเลือกว่าปุ่มลูกศรจะขยับอะไร ---------------- */

  function buildTargets() {
    const group = targetsEl.querySelector('.targets__group');
    group.innerHTML = '';
    const options = [{ key: 'photo', label: 'รูปภาพ' }]
      .concat(FRAMES[frameIndex].parts.map((d) => ({ key: d.key, label: d.label })));
    options.forEach((o) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.setAttribute('role', 'radio');
      b.dataset.key = o.key;
      b.textContent = o.label;
      b.addEventListener('click', () => setTarget(o.key));
      group.appendChild(b);
    });
    syncTargets();
  }

  function setTarget(key) {
    target = key;
    syncTargets();
    render();
  }

  function syncTargets() {
    targetsEl.querySelectorAll('.chip').forEach((b) => {
      b.setAttribute('aria-checked', String(b.dataset.key === target));
    });
  }

  /* ---------------- photo input ---------------- */

  async function usePhoto(file) {
    if (!file || !file.type.startsWith('image/')) {
      note('ไฟล์นี้ไม่ใช่รูปภาพ ลองเลือกไฟล์ใหม่อีกครั้ง');
      return;
    }
    try {
      const next = await decode(file);
      if (photo && typeof photo.close === 'function') photo.close(); // คืนหน่วยความจำของรูปเดิม
      photo = next;
    } catch (err) {
      note('เปิดรูปนี้ไม่ได้ ลองบันทึกเป็น JPG หรือ PNG แล้วลองใหม่');
      return;
    }
    stage.classList.remove('is-empty');
    controls.hidden = false;
    saveBtn.disabled = false;
    if (shareCapable()) shareBtn.hidden = false;
    fitPhoto();
    render();
    note('');
  }

  function decode(file) {
    if ('createImageBitmap' in window) {
      // imageOrientation: 'from-image' = หมุนตาม EXIF ให้อัตโนมัติ
      return createImageBitmap(file, { imageOrientation: 'from-image' })
        .catch(() => createImageBitmap(file))
        .catch(() => decodeViaElement(file));
    }
    return decodeViaElement(file);
  }

  function decodeViaElement(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { resolve(img); setTimeout(() => URL.revokeObjectURL(url), 0); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode failed')); };
      img.src = url;
    });
  }

  /* ---------------- pointer interaction ---------------- */

  const pointers = new Map();
  let pinchStart = null;
  let dragPart = null;          // ชิ้นส่วนที่กำลังลาก (null = ลากรูปภาพ)

  const toDesign = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * SIZE, y: ((e.clientY - r.top) / r.height) * SIZE };
  };
  const designPerPx = () => SIZE / canvas.getBoundingClientRect().width;

  canvas.addEventListener('pointerdown', (e) => {
    if (!photo) return;
    // จับ pointer ไว้กับแคนวาส เพื่อให้ลากออกนอกกรอบแล้วยังตามต่อได้
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ไม่จับก็ยังลากได้ */ }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      dragPart = hitPart(toDesign(e));
      setTarget(dragPart ? dragPart.def.key : 'photo');
    } else if (pointers.size === 2) {
      dragPart = null;          // สองนิ้ว = ซูมรูปภาพเสมอ
      startPinch();
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!photo) return;
    if (!pointers.has(e.pointerId)) { updateCursor(e); return; }

    const prev = pointers.get(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size === 1) {
      const s = designPerPx();
      const dx = (e.clientX - prev.x) * s;
      const dy = (e.clientY - prev.y) * s;
      if (dragPart) {
        dragPart.dx += dx;
        dragPart.dy += dy;
        clampPart(dragPart);
      } else {
        view.x += dx;
        view.y += dy;
        clampView();
      }
      render();
    } else if (pointers.size === 2 && pinchStart) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = midpointDesign(a, b);
      const k = dist / pinchStart.dist;
      // เลื่อนตามจุดกึ่งกลางสองนิ้ว แล้วค่อยซูมรอบจุดนั้น
      view.x += mid.x - pinchStart.mid.x;
      view.y += mid.y - pinchStart.mid.y;
      pinchStart.mid = mid;
      pinchStart.dist = dist;
      setScale(view.scale * k, mid);
    }
  });

  const endPointer = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchStart = null;
    if (pointers.size === 0) dragPart = null;
    if (pointers.size === 2) startPinch();
  };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('lostpointercapture', endPointer);

  function updateCursor(e) {
    canvas.style.cursor = hitPart(toDesign(e)) ? 'move' : 'grab';
  }

  function startPinch() {
    const [a, b] = [...pointers.values()];
    pinchStart = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, mid: midpointDesign(a, b) };
    return pinchStart;
  }

  function midpointDesign(a, b) {
    const r = canvas.getBoundingClientRect();
    return {
      x: (((a.x + b.x) / 2 - r.left) / r.width) * SIZE,
      y: (((a.y + b.y) / 2 - r.top) / r.height) * SIZE
    };
  }

  canvas.addEventListener('wheel', (e) => {
    if (!photo) return;
    e.preventDefault();
    const step = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    setScale(view.scale * Math.exp(-step * 0.0015), toDesign(e));
  }, { passive: false });

  canvas.addEventListener('dblclick', () => { if (photo) resetAll(); });

  canvas.addEventListener('keydown', (e) => {
    if (!photo) return;
    const step = e.shiftKey ? 60 : 15;
    const moves = {
      ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step]
    };
    if (moves[e.key]) {
      e.preventDefault();
      const [dx, dy] = moves[e.key];
      const p = activePart();
      if (p) {
        p.dx += dx; p.dy += dy;
        clampPart(p);
      } else {
        view.x += dx; view.y += dy;
        clampView();
      }
      render();
    } else if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      setScale(view.scale * 1.12, null);
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      setScale(view.scale / 1.12, null);
    }
  });

  /* ---------------- drag & drop / paste ---------------- */

  ['dragenter', 'dragover'].forEach((t) =>
    stage.addEventListener(t, (e) => { e.preventDefault(); stage.classList.add('is-drag'); }));
  ['dragleave', 'drop'].forEach((t) =>
    stage.addEventListener(t, (e) => { e.preventDefault(); stage.classList.remove('is-drag'); }));
  stage.addEventListener('drop', (e) => {
    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) usePhoto(file);
  });

  window.addEventListener('paste', (e) => {
    const files = e.clipboardData && e.clipboardData.files;
    if (files && files.length) usePhoto(files[0]);
  });

  /* ---------------- controls ---------------- */

  $('pickBtn').addEventListener('click', () => fileInput.click());
  $('changeBtn').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    usePhoto(fileInput.files[0]);
    fileInput.value = '';
  });

  zoomInput.addEventListener('input', () => {
    if (!photo) return;
    const lo = Math.log(minScale());
    const hi = Math.log(maxScale());
    const next = Math.exp(lo + (Number(zoomInput.value) / 1000) * (hi - lo));
    const prev = view.scale;
    view.scale = clamp(next, minScale(), maxScale());
    const k = view.scale / prev;
    const c = SIZE / 2;
    view.x = c + (view.x - c) * k;
    view.y = c + (view.y - c) * k;
    clampView();
    render();
  });

  $('zoomIn').addEventListener('click', () => setScale(view.scale * 1.15, null));
  $('zoomOut').addEventListener('click', () => setScale(view.scale / 1.15, null));
  $('resetBtn').addEventListener('click', resetAll);
  $('rotateBtn').addEventListener('click', () => {
    if (!photo) return;
    view.rot = (view.rot + 1) % 4;
    view.scale = clamp(view.scale, minScale(), maxScale());
    clampView();
    syncZoomInput();
    render();
  });

  /** คืนค่าทั้งรูปภาพและตำแหน่งชิ้นส่วนของเฟรม */
  function resetAll() {
    parts.forEach((p) => { p.dx = 0; p.dy = 0; });
    setTarget('photo');
    fitPhoto();
    render();
  }

  /* ---------------- export ---------------- */

  function exportCanvas() {
    const out = document.createElement('canvas');
    out.width = out.height = SIZE;
    paint(out.getContext('2d'), SIZE, false);
    return out;
  }

  const toBlob = (cv) => new Promise((resolve) => cv.toBlob(resolve, 'image/png'));
  const filename = () => `sang-fong-sw-${FRAMES[frameIndex].id}.png`;

  /** ปุ่มจะถูกล็อกระหว่างเรนเดอร์ไฟล์ เพราะภาพ 1200×1200 ใช้เวลาสักครู่บนเครื่องช้า */
  async function withBusy(btn, label, fn) {
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = label;
    try {
      await fn();
    } finally {
      btn.textContent = original;
      btn.disabled = false;
    }
  }

  saveBtn.addEventListener('click', () => withBusy(saveBtn, 'กำลังสร้างไฟล์…', async () => {
    const blob = await toBlob(exportCanvas());
    if (!blob) { note('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง'); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename();
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    note('บันทึกภาพแล้ว ถ้าไม่พบไฟล์ ลองดูในโฟลเดอร์ดาวน์โหลด');
    if (isIOS()) openSheet(blob);
  }));

  function shareCapable() {
    return typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [new File([new Blob()], 'x.png', { type: 'image/png' })] });
  }

  shareBtn.addEventListener('click', () => withBusy(shareBtn, 'กำลังสร้างไฟล์…', async () => {
    const blob = await toBlob(exportCanvas());
    if (!blob) return;
    const file = new File([blob], filename(), { type: 'image/png' });
    try {
      await navigator.share({ files: [file], text: '#สั่งฟ้องสว.' });
    } catch (err) {
      if (err && err.name !== 'AbortError') openSheet(blob);
    }
  }));

  function openSheet(blob) {
    const url = URL.createObjectURL(blob);
    const img = $('sheetImg');
    img.src = url;
    img.onload = () => setTimeout(() => URL.revokeObjectURL(url), 60000);
    if (typeof sheet.showModal === 'function') sheet.showModal();
  }
  $('sheetClose').addEventListener('click', () => sheet.close());

  const isIOS = () =>
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  function note(msg) {
    saveNote.textContent = msg;
    clearTimeout(noteTimer);
    if (msg) noteTimer = setTimeout(() => { saveNote.textContent = ''; }, 6000);
  }

  $('copyTag').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText('#สั่งฟ้องสว.');
      note('คัดลอกแฮชแท็ก #สั่งฟ้องสว. แล้ว');
    } catch (err) {
      note('คัดลอกไม่สำเร็จ พิมพ์ #สั่งฟ้องสว. ได้เลย');
    }
  });

  /* ---------------- boot ---------------- */

  stage.classList.add('is-empty');
  buildFrameList();
  loadFrame(0);
  render();
})();
