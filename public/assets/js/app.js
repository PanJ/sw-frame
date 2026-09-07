/* ---------------------------------------------------------------
   #สั่งฟ้องสว. — ตัวสร้างภาพโปรไฟล์
   ทำงานในเบราว์เซอร์ทั้งหมด ไม่มีการอัปโหลดหรือเก็บข้อมูลใด ๆ
---------------------------------------------------------------- */
(() => {
  'use strict';

  const SIZE = 1200;              // ขนาดภาพที่บันทึกจริง (px)
  const FRAMES = [
    { id: 'PF-03', src: 'frames/PF-03.png', label: 'นิ้วชี้ + ข้อความด้านขวา' },
    { id: 'PF-04', src: 'frames/PF-04.png', label: 'ข้อความด้านขวา' },
    { id: 'PF-05', src: 'frames/PF-05.png', label: 'นิ้วชี้ + ข้อความด้านล่าง' },
    { id: 'PF-06', src: 'frames/PF-06.png', label: 'ข้อความด้านล่าง' }
  ];

  const $ = (id) => document.getElementById(id);
  const stage = $('stage');
  const canvas = $('canvas');
  const ctx = canvas.getContext('2d');
  const fileInput = $('file');
  const zoomInput = $('zoom');
  const controls = $('controls');
  const saveBtn = $('saveBtn');
  const shareBtn = $('shareBtn');
  const saveNote = $('saveNote');
  const sheet = $('sheet');

  /* ---------------- state ---------------- */

  const view = { scale: 1, x: SIZE / 2, y: SIZE / 2, rot: 0 }; // rot = จำนวนควอเตอร์เทิร์น
  let photo = null;             // ImageBitmap | HTMLImageElement
  let frameImg = null;
  let frameIndex = 0;
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

  /** จำกัดการเลื่อน: ถ้ารูปใหญ่กว่ากรอบจะไม่ยอมให้เกิดขอบว่าง
      ถ้าเล็กกว่ากรอบจะไม่ยอมให้รูปหลุดออกนอกกรอบ */
  function clampView() {
    const hw = (photoW() * view.scale) / 2;
    const hh = (photoH() * view.scale) / 2;
    view.x = hw >= SIZE / 2 ? clamp(view.x, SIZE - hw, hw) : clamp(view.x, hw, SIZE - hw);
    view.y = hh >= SIZE / 2 ? clamp(view.y, SIZE - hh, hh) : clamp(view.y, hh, SIZE - hh);
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

  /* ---------------- drawing ---------------- */

  function paint(target, size) {
    const k = size / SIZE;
    target.save();
    target.fillStyle = '#ffffff';
    target.fillRect(0, 0, size, size);
    if (photo) {
      target.save();
      target.translate(view.x * k, view.y * k);
      target.rotate((view.rot * Math.PI) / 2);
      target.imageSmoothingEnabled = true;
      target.imageSmoothingQuality = 'high';
      const w = photo.width * view.scale * k;
      const h = photo.height * view.scale * k;
      target.drawImage(photo, -w / 2, -h / 2, w, h);
      target.restore();
    }
    if (frameImg) target.drawImage(frameImg, 0, 0, size, size);
    target.restore();
  }

  let queued = false;
  function render() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      paint(ctx, SIZE);
    });
  }

  /* ---------------- frames ---------------- */

  function loadFrame(index) {
    frameIndex = index;
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => { frameImg = img; render(); };
    img.src = FRAMES[index].src;
    [...$('frameList').querySelectorAll('button')].forEach((b, i) => {
      b.setAttribute('aria-checked', String(i === index));
      b.tabIndex = i === index ? 0 : -1;
    });
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
      btn.innerHTML = `<img src="${f.src}" alt="${f.label}" width="1200" height="1200" loading="lazy">`;
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

  const toDesign = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * SIZE, y: ((e.clientY - r.top) / r.height) * SIZE };
  };
  const designPerPx = () => SIZE / canvas.getBoundingClientRect().width;

  canvas.addEventListener('pointerdown', (e) => {
    if (!photo) return;
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) startPinch();
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!photo || !pointers.has(e.pointerId)) return;
    const prev = pointers.get(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size === 1) {
      const s = designPerPx();
      view.x += (e.clientX - prev.x) * s;
      view.y += (e.clientY - prev.y) * s;
      clampView();
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
    pinchStart = pointers.size === 2 ? startPinch() : null;
  };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('lostpointercapture', endPointer);

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

  canvas.addEventListener('dblclick', () => { if (photo) { fitPhoto(); render(); } });

  canvas.addEventListener('keydown', (e) => {
    if (!photo) return;
    const step = e.shiftKey ? 60 : 15;
    const moves = {
      ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step]
    };
    if (moves[e.key]) {
      e.preventDefault();
      view.x += moves[e.key][0];
      view.y += moves[e.key][1];
      clampView();
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
  $('resetBtn').addEventListener('click', () => { fitPhoto(); render(); });
  $('rotateBtn').addEventListener('click', () => {
    if (!photo) return;
    view.rot = (view.rot + 1) % 4;
    view.scale = clamp(view.scale, minScale(), maxScale());
    clampView();
    syncZoomInput();
    render();
  });

  /* ---------------- export ---------------- */

  function exportCanvas() {
    const out = document.createElement('canvas');
    out.width = out.height = SIZE;
    paint(out.getContext('2d'), SIZE);
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
