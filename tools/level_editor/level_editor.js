// Level Editor v2 — Map tiles + Traps + Script
(function(){
  const mapWidth = 32, mapHeight = 16;

  // === DOM refs ===
  const canvas = document.getElementById('mapCanvas');
  const ctx = canvas.getContext('2d');
  const statusBar = document.getElementById('statusBar');
  const baseSelect = document.getElementById('baseSelect');
  const tileSizeInput = document.getElementById('tileSizeInput');
  const instrList = document.getElementById('instrList');
  const mType = document.getElementById('mType');
  const mSX = document.getElementById('mSX');
  const mSY = document.getElementById('mSY');
  const mEX = document.getElementById('mEX');
  const mEY = document.getElementById('mEY');
  const addInstrBtn = document.getElementById('addInstrBtn');
  const updateInstrBtn = document.getElementById('updateInstrBtn');
  const deleteInstrBtn = document.getElementById('deleteInstrBtn');
  const trapPalette = document.getElementById('trapPalette');

  // === Theme system ===
  function getTheme() { return localStorage.getItem('theme') || 'light'; }
  function setTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('theme', t);
    const btn = document.getElementById('themeToggleBtn');
    if (btn) btn.textContent = t === 'dark' ? '☀️' : '🌙';
  }
  function toggleTheme() { setTheme(getTheme() === 'dark' ? 'light' : 'dark'); }
  // Apply saved theme on load
  setTheme(getTheme());
  // Listen for toggle button
  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('themeToggleBtn');
    if (btn) btn.addEventListener('click', toggleTheme);
  });
  // Also try immediately if DOM already ready
  const themeBtn = document.getElementById('themeToggleBtn');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);
  const objForm = document.getElementById('objForm');
  const objTypeLabel = document.getElementById('objTypeLabel');
  const objX = document.getElementById('objX');
  const objY = document.getElementById('objY');
  const objW = document.getElementById('objW');
  const objH = document.getElementById('objH');
  const objWLabel = document.getElementById('objWLabel');
  const objHLabel = document.getElementById('objHLabel');
  const objHidden = document.getElementById('objHidden');
  const objNoCollision = document.getElementById('objNoCollision');
  const addObjBtn = document.getElementById('addObjBtn');
  const updateObjBtn = document.getElementById('updateObjBtn');
  const deleteObjBtn = document.getElementById('deleteObjBtn');
  const objList = document.getElementById('objList');
  const scriptArea = document.getElementById('scriptArea');
  const canvasHint = document.getElementById('canvasHint');

  // === 文件菜单 DOM 引用 ===
  const fileMenuBtn = document.getElementById('fileMenuBtn');
  const fileDropdown = document.getElementById('fileDropdown');
  const saveQuickBtn = document.getElementById('saveQuickBtn');
  const loadQuickBtn = document.getElementById('loadQuickBtn');
  const currentFileLabel = document.getElementById('currentFileLabel');

  // === State ===
  let tileSize = 24;
  let currentFilename = null;       // 当前已保存的文件名（不含 .txt）
  let mapData = { base: '0', instructions: [] };
  let mapArray = [];
  let objects = [];
  let mouseTile = {x:-1,y:-1};
  let selInstr = -1, hovInstr = -1;
  let selObj = -1, hovObj = -1;
  let isDragging = false, dragStart = null, dragCurrent = null, wasDragging = false, dragType = '1';
  let isObjDrag = false, objDragIndex = -1, objDragPending = null; // 左键拖拽物体
  let isPlaceDrag = false, placeDragStart = null, placeDragSize = null, placeDragHandled = false;
  let selectedTrapType = null;

  // Trap definitions
  const TRAP_DEFS = {
    blackhole:  { label:'BlackHole', color:'#ef4444', hasW:false, hasH:false, icon:'🕳️' },
    floatrect:  { label:'Float', color:'#3b82f6', hasW:true, hasH:true, icon:'▭' },
    button:     { label:'Button', color:'#f59e0b', hasW:false, hasH:false, icon:'◉' },
    bounce:     { label:'Bounce', color:'#10b981', hasW:false, hasH:false, icon:'⬆' },
    destination:{ label:'Dest', color:'#8b5cf6', hasW:false, hasH:false, icon:'★' },
    oneway:     { label:'OneWay', color:'#06b6d4', hasW:true, hasH:false, icon:'⇧' },
  };

  function makeObjId(type) {
    const prefixMap = { blackhole:'bh', floatrect:'fr', button:'btn', bounce:'bn', destination:'dest', oneway:'ow' };
    const prefix = prefixMap[type] || type;
    // 收集当前已用的编号
    const used = new Set();
    for (const o of objects) {
      if (o.type === type) {
        const num = parseInt(o.id.replace(prefix, ''), 10);
        if (!isNaN(num)) used.add(num);
      }
    }
    // 找最小的空闲编号
    let n = 1;
    while (used.has(n)) n++;
    return prefix + n;
  }

  // === Map generation ===
  function genMap() {
    mapArray = [];
    for (let y = 0; y < mapHeight; y++) {
      const row = [];
      for (let x = 0; x < mapWidth; x++) row.push(mapData.base);
      mapArray.push(row);
    }
    for (const inst of mapData.instructions) {
      for (let y = inst.startY; y <= inst.endY; y++)
        for (let x = inst.startX; x <= inst.endX; x++)
          mapArray[y][x] = inst.type;
    }
  }

  // === Render ===
  function render() {
    tileSize = parseInt(tileSizeInput.value, 10) || 24;
    canvas.width = tileSize * mapWidth + 1;
    canvas.height = tileSize * mapHeight + 1;

    // Tiles — read theme-aware colors from CSS variables
    const cs = getComputedStyle(document.documentElement);
    const canvasBg = cs.getPropertyValue('--canvas-bg').trim() || '#e2e8f0';
    const canvasSolid = cs.getPropertyValue('--canvas-solid').trim() || '#475569';
    const canvasGrid = cs.getPropertyValue('--canvas-grid').trim() || 'rgba(0,0,0,0.06)';
    const textTertiary = cs.getPropertyValue('--text-tertiary').trim() || '#94a3b8';
    for (let y = 0; y < mapHeight; y++)
      for (let x = 0; x < mapWidth; x++) {
        ctx.fillStyle = mapArray[y][x] === '1' ? canvasSolid : canvasBg;
        ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
      }

    // Grid
    ctx.strokeStyle = canvasGrid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= mapWidth; x++) { ctx.moveTo(x * tileSize + 0.5, 0); ctx.lineTo(x * tileSize + 0.5, mapHeight * tileSize); }
    for (let y = 0; y <= mapHeight; y++) { ctx.moveTo(0, y * tileSize + 0.5); ctx.lineTo(mapWidth * tileSize, y * tileSize + 0.5); }
    ctx.stroke();

    // Objects
    for (let i = 0; i < objects.length; i++) {
      const o = objects[i];
      const def = TRAP_DEFS[o.type];
      const px = o.x * tileSize;
      const py = o.y * tileSize;
      const pw = (o.width || 1) * tileSize;
      const ph = (o.height || 1) * tileSize;

      // 基础填充 (hidden 对象降低不透明度)
      const alpha = o.hidden ? '12' : '30';
      ctx.fillStyle = def ? def.color + alpha : `rgba(100,100,100,${o.hidden ? 0.08 : 0.2})`;
      ctx.fillRect(px, py, pw, ph);

      // 边框: hidden →虚线, noCollision→不同颜色+虚线
      if (o.hidden || o.noCollision) {
        ctx.setLineDash([4, 3]);
      } else {
        ctx.setLineDash([]);
      }
      let borderColor = def ? def.color : '#666';
      if (o.hidden && o.noCollision) {
        borderColor = '#a855f7'; // 紫色 = 隐藏 + 无碰撞
      } else if (o.hidden) {
        borderColor = '#f59e0b'; // 琥珀色 = 隐藏
      } else if (o.noCollision) {
        borderColor = '#10b981'; // 绿色 = 无碰撞
      }
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = hovObj === i || selObj === i ? 2 : 1.5;
      ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);
      ctx.setLineDash([]);
      ctx.lineWidth = 1;

      // hidden 标志: 在对象上画 X 图案
      if (o.hidden) {
        ctx.strokeStyle = 'rgba(245,158,11,0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px + 3, py + 3);
        ctx.lineTo(px + pw - 3, py + ph - 3);
        ctx.moveTo(px + pw - 3, py + 3);
        ctx.lineTo(px + 3, py + ph - 3);
        ctx.stroke();
        ctx.lineWidth = 1;
      }

      // noCollision 标志: 在左上角显示 ⛔ 小图标
      if (o.noCollision) {
        ctx.fillStyle = 'rgba(16,185,129,0.7)';
        const iconSize = Math.max(8, Math.min(tileSize * 0.35, 14));
        ctx.font = `${iconSize}px Arial`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText('⛔', px + pw - 2, py + ph - 2);
      }

      // Label
      ctx.fillStyle = def ? def.color : '#666';
      const labelSize = Math.max(9, Math.min(tileSize * 0.45, 14));
      ctx.font = `bold ${labelSize}px Arial`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      const label = o.id || (def ? def.label : '?');
      ctx.fillText(label, px + 2, py + 2);
      if (tileSize >= 18) {
        ctx.font = `${Math.max(7, labelSize - 3)}px Arial`;
        ctx.fillStyle = textTertiary;
        ctx.fillText(`(${o.x},${o.y})`, px + 2, py + labelSize + 2);
      }
    }

    // Selected/hovered object highlight edge
    if (selObj >= 0 && objects[selObj]) {
      const o = objects[selObj];
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(o.x * tileSize + 1, o.y * tileSize + 1, (o.width || 1) * tileSize - 2, (o.height || 1) * tileSize - 2);
      ctx.lineWidth = 1;
    }
    if (hovObj >= 0 && hovObj !== selObj && objects[hovObj]) {
      const o = objects[hovObj];
      ctx.strokeStyle = '#888';
      ctx.lineWidth = 2;
      ctx.strokeRect(o.x * tileSize + 1, o.y * tileSize + 1, (o.width || 1) * tileSize - 2, (o.height || 1) * tileSize - 2);
      ctx.lineWidth = 1;
    }

    // Hovered map instruction highlight
    if (hovInstr >= 0 && mapData.instructions[hovInstr]) {
      const inst = mapData.instructions[hovInstr];
      ctx.strokeStyle = '#888';
      ctx.lineWidth = 2;
      ctx.strokeRect(inst.startX * tileSize + 1, inst.startY * tileSize + 1, (inst.endX - inst.startX + 1) * tileSize - 2, (inst.endY - inst.startY + 1) * tileSize - 2);
      ctx.lineWidth = 1;
    }
    if (selInstr >= 0 && mapData.instructions[selInstr]) {
      const inst = mapData.instructions[selInstr];
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.strokeRect(inst.startX * tileSize + 1, inst.startY * tileSize + 1, (inst.endX - inst.startX + 1) * tileSize - 2, (inst.endY - inst.startY + 1) * tileSize - 2);
      ctx.lineWidth = 1;
    }

    // Mouse tile highlight
    if (mouseTile.x >= 0 && mouseTile.y >= 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.1)';
      ctx.fillRect(mouseTile.x * tileSize, mouseTile.y * tileSize, tileSize, tileSize);
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.strokeRect(mouseTile.x * tileSize + 0.5, mouseTile.y * tileSize + 0.5, tileSize - 1, tileSize - 1);
      ctx.fillStyle = '#444';
      ctx.font = `bold ${Math.max(8, Math.min(tileSize * 0.3, 12))}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${mouseTile.x},${mouseTile.y}`, mouseTile.x * tileSize + tileSize / 2, mouseTile.y * tileSize + tileSize / 2);
    }

    // Drag preview (map tiles)
    if (isDragging && dragStart && dragCurrent) {
      const sx = Math.min(dragStart.x, dragCurrent.x);
      const sy = Math.min(dragStart.y, dragCurrent.y);
      const ex = Math.max(dragStart.x, dragCurrent.x);
      const ey = Math.max(dragStart.y, dragCurrent.y);
      ctx.fillStyle = dragType === '1' ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.06)';
      ctx.strokeStyle = dragType === '1' ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 2;
      ctx.strokeRect(sx * tileSize + 0.5, sy * tileSize + 0.5, (ex - sx + 1) * tileSize - 1, (ey - sy + 1) * tileSize - 1);
      ctx.lineWidth = 1;
    }

    // Place drag preview (right-drag new object size)
    if (isPlaceDrag && placeDragSize) {
      const s = placeDragSize;
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(s.x * tileSize + 0.5, s.y * tileSize + 0.5, s.w * tileSize - 1, s.h * tileSize - 1);
      ctx.setLineDash([]);
      ctx.lineWidth = 1;
      // Size label
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.font = 'bold 11px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`${s.w}×${s.h}`, s.x * tileSize + s.w * tileSize / 2, s.y * tileSize - 2);
    }
  }

  function updateStatus() {
    const tc = (mouseTile.x >= 0 && mouseTile.y >= 0) ? `(${mouseTile.x},${mouseTile.y})` : '(-,-)';
    const tv = (mouseTile.x >= 0 && mouseTile.y >= 0) ? mapArray[mouseTile.y][mouseTile.x] : '-';
    const si = selInstr >= 0 ? `#${selInstr}` : '-';
    const so = selObj >= 0 ? objects[selObj]?.id || `#${selObj}` : '-';
    const tool = selectedTrapType ? `[放置: ${TRAP_DEFS[selectedTrapType]?.label || selectedTrapType}]` : '[Shift+拖拽编辑地图]';
    statusBar.textContent = `${tc} val=${tv} instr=${si} obj=${so} ${tool}`;
  }

  function refreshAll() {
    genMap();
    render();
    updateInstrList();
    updateObjList();
    updateStatus();
    updateCurrentFileLabel();
  }

  function updateCurrentFileLabel() {
    if (currentFilename) {
      currentFileLabel.textContent = `${currentFilename}.txt`;
    } else {
      currentFileLabel.textContent = '';
    }
  }

  // === Map Instructions UI ===
  function updateInstrList() {
    instrList.innerHTML = '';
    mapData.instructions.forEach((ins, i) => {
      const row = document.createElement('div');
      row.className = 'obj-row';
      row.onmouseenter = () => { hovInstr = i; render(); };
      row.onmouseleave = () => { hovInstr = -1; render(); };
      row.onclick = () => selectInstr(i);
      const label = document.createElement('span');
      label.textContent = `#${i} ${ins.type === '1' ? 'solid' : 'empty'} [${ins.startX},${ins.startY}]→[${ins.endX},${ins.endY}]`;
      const del = document.createElement('button');
      del.className = 'del-btn';
      del.textContent = '×';
      del.onclick = (e) => { e.stopPropagation(); mapData.instructions.splice(i,1); selInstr = -1; hovInstr = -1; refreshAll(); };
      row.appendChild(label); row.appendChild(del);
      instrList.appendChild(row);
    });
  }

  function selectInstr(i) {
    selInstr = i; selObj = -1;
    const ins = mapData.instructions[i];
    if (!ins) return;
    mType.value = ins.type;
    mSX.value = ins.startX; mSY.value = ins.startY; mEX.value = ins.endX; mEY.value = ins.endY;
    updateInstrBtn.disabled = false; deleteInstrBtn.disabled = false;
    refreshAll();
  }

  addInstrBtn.addEventListener('click', () => {
    const sx = Math.max(0, Math.min(31, parseInt(mSX.value, 10) || 0));
    const sy = Math.max(0, Math.min(15, parseInt(mSY.value, 10) || 0));
    const ex = Math.max(0, Math.min(31, parseInt(mEX.value, 10) || 0));
    const ey = Math.max(0, Math.min(15, parseInt(mEY.value, 10) || 0));
    const ins = { type: String(mType.value), startX: Math.min(sx, ex), startY: Math.min(sy, ey), endX: Math.max(sx, ex), endY: Math.max(sy, ey) };
    mapData.instructions.push(ins);
    refreshAll();
  });

  updateInstrBtn.addEventListener('click', () => {
    if (selInstr < 0) return;
    const ins = mapData.instructions[selInstr];
    ins.type = String(mType.value);
    ins.startX = Math.max(0, Math.min(31, parseInt(mSX.value, 10) || 0));
    ins.startY = Math.max(0, Math.min(15, parseInt(mSY.value, 10) || 0));
    ins.endX = Math.max(0, Math.min(31, parseInt(mEX.value, 10) || 0));
    ins.endY = Math.max(0, Math.min(15, parseInt(mEY.value, 10) || 0));
    if (ins.endX < ins.startX) { const t = ins.endX; ins.endX = ins.startX; ins.startX = t; }
    if (ins.endY < ins.startY) { const t = ins.endY; ins.endY = ins.startY; ins.startY = t; }
    refreshAll();
  });

  deleteInstrBtn.addEventListener('click', () => {
    if (selInstr < 0) return;
    mapData.instructions.splice(selInstr, 1);
    selInstr = -1; hovInstr = -1;
    refreshAll();
  });

  baseSelect.addEventListener('change', () => { mapData.base = String(baseSelect.value); refreshAll(); });
  tileSizeInput.addEventListener('change', () => { tileSize = parseInt(tileSizeInput.value, 10) || 24; refreshAll(); });

  // === Trap Palette ===
  Object.keys(TRAP_DEFS).forEach((type, idx) => {
    const def = TRAP_DEFS[type];
    const btn = document.createElement('div');
    btn.className = 'trap-btn';
    btn.style.borderColor = 'transparent';
    btn.style.background = def.color + '18';
    btn.innerHTML = `${def.icon} ${def.label} <span style="font-size:10px;opacity:0.5;margin-left:2px;">${idx + 1}</span>`;
    btn.title = type;
    btn.onclick = () => {
      selectedTrapType = type;
      document.querySelectorAll('.trap-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      objForm.style.display = 'block';
      objTypeLabel.textContent = `${def.icon} ${def.label} (${type})`;
      objWLabel.style.display = def.hasW ? '' : 'none';
      objHLabel.style.display = def.hasH ? '' : 'none';
      canvasHint.textContent = `点击地图放置 ${def.label}`;
      updateStatus();
    };
    trapPalette.appendChild(btn);
  });

  // === Objects UI ===
  function updateObjList() {
    objList.innerHTML = '';
    objects.forEach((o, i) => {
      const def = TRAP_DEFS[o.type];
      const row = document.createElement('div');
      row.className = 'obj-row';
      row.onmouseenter = () => { hovObj = i; render(); };
      row.onmouseleave = () => { hovObj = -1; render(); };
      row.onclick = () => selectObj(i);
      row.oncontextmenu = (e) => { e.preventDefault(); selectObj(i); };
      const label = document.createElement('span');
      let info = `${def ? def.icon : '?'} ${o.id || '?'} (${o.x},${o.y})`;
      if (o.width) info += ` w:${o.width}`;
      if (o.height) info += ` h:${o.height}`;
      if (o.hidden) info += ' 🔇';
      if (o.noCollision) info += ' ⛔';
      label.textContent = info;
      const del = document.createElement('button');
      del.className = 'del-btn';
      del.textContent = '×';
      del.onclick = (e) => { e.stopPropagation(); objects.splice(i,1); selObj = -1; hovObj = -1; refreshAll(); };
      row.appendChild(label); row.appendChild(del);
      objList.appendChild(row);
    });
  }

  function selectObj(i) {
    selObj = i; selInstr = -1;
    updateInstrBtn.disabled = true; deleteInstrBtn.disabled = true;
    const o = objects[i];
    if (!o) return;
    selectedTrapType = o.type;
    const def = TRAP_DEFS[o.type];
    objForm.style.display = 'block';
    objTypeLabel.textContent = `${def.icon} ${def.label} (${o.type})`;
    objX.value = o.x; objY.value = o.y;
    objW.value = o.width || 1; objH.value = o.height || 1;
    objWLabel.style.display = def.hasW ? '' : 'none';
    objHLabel.style.display = def.hasH ? '' : 'none';
    objHidden.checked = !!o.hidden;
    objNoCollision.checked = !!o.noCollision;
    updateObjBtn.disabled = false; deleteObjBtn.disabled = false;
    refreshAll();
  }

  function getObjFormValues() {
    const x = Math.max(0, Math.min(31, parseInt(objX.value, 10) || 0));
    const y = Math.max(0, Math.min(15, parseInt(objY.value, 10) || 0));
    const w = Math.max(1, Math.min(32, parseInt(objW.value, 10) || 1));
    const h = Math.max(1, Math.min(16, parseInt(objH.value, 10) || 1));
    const hidden = objHidden.checked;
    const noCollision = objNoCollision.checked;
    return { x, y, w, h, hidden, noCollision };
  }

  addObjBtn.addEventListener('click', () => {
    if (!selectedTrapType) { alert('请先在陷阱面板中选择一种类型'); return; }
    const def = TRAP_DEFS[selectedTrapType];
    const { x, y, w, h, hidden, noCollision } = getObjFormValues();
    const id = makeObjId(selectedTrapType);
    const obj = { id, type: selectedTrapType, x, y, hidden, noCollision };
    if (def.hasW) obj.width = w;
    if (def.hasH) obj.height = h;
    objects.push(obj);
    refreshAll();
  });

  updateObjBtn.addEventListener('click', () => {
    if (selObj < 0) return;
    const o = objects[selObj];
    const def = TRAP_DEFS[o.type];
    const { x, y, w, h, hidden, noCollision } = getObjFormValues();
    o.x = x; o.y = y;
    if (def.hasW) o.width = w;
    if (def.hasH) o.height = h;
    o.hidden = hidden;
    o.noCollision = noCollision;
    refreshAll();
  });

  deleteObjBtn.addEventListener('click', () => {
    if (selObj < 0) return;
    objects.splice(selObj, 1);
    selObj = -1; hovObj = -1;
    refreshAll();
  });

  // 勾选框即时更新: 切换后立即应用到选中的物体并重绘
  objHidden.addEventListener('change', () => {
    if (selObj >= 0 && objects[selObj]) {
      objects[selObj].hidden = objHidden.checked;
      render();
      updateObjList();
    }
  });
  objNoCollision.addEventListener('change', () => {
    if (selObj >= 0 && objects[selObj]) {
      objects[selObj].noCollision = objNoCollision.checked;
      render();
      updateObjList();
    }
  });

  // === Canvas mouse events ===
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const tx = Math.floor(mx / tileSize), ty = Math.floor(my / tileSize);
    const cx = Math.max(0, Math.min(mapWidth - 1, tx));
    const cy = Math.max(0, Math.min(mapHeight - 1, ty));
    if (cx !== mouseTile.x || cy !== mouseTile.y) {
      mouseTile.x = cx; mouseTile.y = cy;
      updateStatus(); render();
    }
    // 地图拖拽预览
    if (isDragging && dragStart) {
      dragCurrent = { x: cx, y: cy };
      render();
    }
    // 左键拖拽物体
    if (isObjDrag && objDragIndex >= 0 && objects[objDragIndex]) {
      objects[objDragIndex].x = cx;
      objects[objDragIndex].y = cy;
      render();
    }
    // 左键拖拽检测：移出起始格 → 正式进入
    if (objDragPending && (objDragPending.tx !== cx || objDragPending.ty !== cy)) {
      isObjDrag = true;
      objDragIndex = objDragPending.index;
      objDragPending = null;
    }
    // 右键拖拽新建预览
    if (isPlaceDrag && placeDragStart) {
      const sx = Math.min(placeDragStart.x, cx);
      const sy = Math.min(placeDragStart.y, cy);
      const ex = Math.max(placeDragStart.x, cx);
      const ey = Math.max(placeDragStart.y, cy);
      placeDragSize = { x: sx, y: sy, w: ex - sx + 1, h: ey - sy + 1 };
      render();
    }
  });

  canvas.addEventListener('mouseleave', () => {
    mouseTile.x = -1; mouseTile.y = -1;
    updateStatus(); render();
    if (isObjDrag) { isObjDrag = false; objDragIndex = -1; }
    objDragPending = null;
    isPlaceDrag = false; placeDragStart = null; placeDragSize = null; placeDragHandled = false;
  });

  // ============ mousedown ============
  canvas.addEventListener('mousedown', (e) => {
    // Shift：地图拖拽（不变）
    if (e.shiftKey) {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const tx = Math.floor((e.clientX - rect.left) / tileSize);
      const ty = Math.floor((e.clientY - rect.top) / tileSize);
      if (e.button === 0) dragType = '1';
      else if (e.button === 2) dragType = '0';
      else return;
      isDragging = true;
      dragStart = { x: Math.max(0, Math.min(mapWidth - 1, tx)), y: Math.max(0, Math.min(mapHeight - 1, ty)) };
      dragCurrent = { ...dragStart };
      render();
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const tx = Math.floor((e.clientX - rect.left) / tileSize);
    const ty = Math.floor((e.clientY - rect.top) / tileSize);

    // 左键（button 0）：选中或拖拽物体
    if (e.button === 0) {
      for (let i = objects.length - 1; i >= 0; i--) {
        const o = objects[i];
        const ow = o.width || 1, oh = o.height || 1;
        if (tx >= o.x && tx < o.x + ow && ty >= o.y && ty < o.y + oh) {
          objDragPending = { tx, ty, index: i };
          return;
        }
      }
      // 没点中物体 → 清除选中
      selObj = -1; selInstr = -1;
      updateInstrBtn.disabled = true; deleteInstrBtn.disabled = true;
      updateObjBtn.disabled = true; deleteObjBtn.disabled = true;
      refreshAll();
    }

    // 右键（button 2）：放置物体（如果已选中陷阱类型）
    if (e.button === 2 && selectedTrapType) {
      e.preventDefault();
      isPlaceDrag = true;
      placeDragStart = { x: tx, y: ty };
      placeDragSize = { x: tx, y: ty, w: 1, h: 1 };
      render();
    }
  });

  // ============ click (左键点击 - 选物体/指令) ============
  canvas.addEventListener('click', (e) => {
    if (wasDragging) { wasDragging = false; return; }
    if (mouseTile.x < 0 || mouseTile.y < 0) return;
    // 左键点在物体上 → 选中
    let foundObj = -1;
    for (let i = objects.length - 1; i >= 0; i--) {
      const o = objects[i];
      const ow = o.width || 1, oh = o.height || 1;
      if (mouseTile.x >= o.x && mouseTile.x < o.x + ow && mouseTile.y >= o.y && mouseTile.y < o.y + oh) {
        foundObj = i; break;
      }
    }
    if (foundObj >= 0) { selectObj(foundObj); return; }
    // 尝试选中地图指令
    let found = -1;
    for (let i = mapData.instructions.length - 1; i >= 0; i--) {
      const ins = mapData.instructions[i];
      if (mouseTile.x >= ins.startX && mouseTile.x <= ins.endX && mouseTile.y >= ins.startY && mouseTile.y <= ins.endY) {
        found = i; break;
      }
    }
    if (found >= 0) { selectInstr(found); } else {
      selInstr = -1; selObj = -1;
      updateInstrBtn.disabled = true; deleteInstrBtn.disabled = true;
      updateObjBtn.disabled = true; deleteObjBtn.disabled = true;
      refreshAll();
    }
  });

  // ============ contextmenu (右键松手 - 放置物体) ============
  canvas.addEventListener('contextmenu', (e) => {
    if (e.shiftKey) return;
    e.preventDefault();
    // mouseup 已经处理了拖拽放置 → 跳过
    if (placeDragHandled) {
      placeDragHandled = false;
      return;
    }
    if (!selectedTrapType) return;
    if (mouseTile.x < 0 || mouseTile.y < 0) return;
    // 右键点击（无拖拽）→ 放一个物体（尺寸用面板中的值）
    isPlaceDrag = false; placeDragStart = null; placeDragSize = null; placeDragHandled = false;
    const def = TRAP_DEFS[selectedTrapType];
    const id = makeObjId(selectedTrapType);
    const obj = { id, type: selectedTrapType, x: mouseTile.x, y: mouseTile.y, hidden: objHidden.checked, noCollision: objNoCollision.checked };
    if (def.hasW) obj.width = parseInt(objW.value, 10) || 1;
    if (def.hasH) obj.height = parseInt(objH.value, 10) || 1;
    objects.push(obj);
    refreshAll();
  });

  // ============ mouseup ============
  window.addEventListener('mouseup', (e) => {
    // 地图拖拽结束（Shift）
    if (isDragging) {
      isDragging = false;
      if (dragStart && dragCurrent) {
        const sx = Math.min(dragStart.x, dragCurrent.x);
        const sy = Math.min(dragStart.y, dragCurrent.y);
        const ex = Math.max(dragStart.x, dragCurrent.x);
        const ey = Math.max(dragStart.y, dragCurrent.y);
        mapData.instructions.push({ type: dragType, startX: sx, startY: sy, endX: ex, endY: ey });
        refreshAll();
        wasDragging = true;
        setTimeout(() => { wasDragging = false; }, 50);
      }
      dragStart = null; dragCurrent = null;
      render();
      return;
    }
    // 左键拖动物体结束
    if (isObjDrag) {
      isObjDrag = false;
      if (objDragIndex >= 0 && objects[objDragIndex]) {
        if (selObj === objDragIndex) {
          const o = objects[objDragIndex];
          objX.value = o.x; objY.value = o.y;
        }
        refreshAll();
      }
      objDragIndex = -1;
    }
    objDragPending = null;
    // 右键放置拖拽结束 → 创建物体
    if (isPlaceDrag && placeDragSize) {
      isPlaceDrag = false;
      const s = placeDragSize;
      const def = TRAP_DEFS[selectedTrapType];
      const id = makeObjId(selectedTrapType);
      const obj = { id, type: selectedTrapType, x: s.x, y: s.y, hidden: objHidden.checked, noCollision: objNoCollision.checked };
      if (def.hasW) obj.width = s.w;
      if (def.hasH) obj.height = s.h;
      objects.push(obj);
      refreshAll();
      placeDragStart = null; placeDragSize = null;
      placeDragHandled = true; // 标记已处理，阻止 contextmenu 重复放置
    }
  });

  // === Tab switching ===
  window.switchTab = function(name) {
    document.querySelectorAll('.tab-bar .tab').forEach(t => t.classList.remove('active'));
    const tabId = 'tab' + name.charAt(0).toUpperCase() + name.slice(1);
    const tabEl = document.getElementById(tabId);
    if (tabEl) tabEl.classList.add('active');
    document.getElementById('panelMap').style.display = name === 'map' ? 'block' : 'none';
    document.getElementById('panelObj').style.display = name === 'obj' ? 'block' : 'none';
    document.getElementById('panelScript').style.display = name === 'script' ? 'block' : 'none';

    // 切到地图标签时取消陷阱放置模式
    if (name === 'map') {
      selectedTrapType = null;
      document.querySelectorAll('.trap-btn').forEach(b => b.classList.remove('active'));
      objForm.style.display = 'none';
      canvasHint.textContent = 'Shift+拖拽=地图编辑 | 选物体后点击画布放置';
      updateStatus();
    }
    // 切到脚本标签时触发语法检查
    if (name === 'script') {
      checkScriptSyntax();
    }
  };

  // === 脚本语法检测器 ===
  // 构建可用物体ID查找表
  function buildObjectIdMap() {
    const map = {};
    for (const o of objects) {
      map[o.id] = o;
    }
    return map;
  }

  /**
   * 检查小数是否满足半步精度（仅允许 .0 或 .5）
   */
  function checkHalfStep(numStr) {
    const num = parseFloat(numStr);
    if (isNaN(num)) return false;
    const frac = num - Math.floor(num);
    return frac === 0 || Math.abs(frac - 0.5) < 0.001;
  }

  /**
   * 检查小数是否满足四分之一步精度（仅允许 .0 .25 .5 .75）
   */
  function checkQuarterStep(numStr) {
    const num = parseFloat(numStr);
    if (isNaN(num)) return false;
    const frac = num - Math.floor(num);
    const allowed = [0, 0.25, 0.5, 0.75];
    return allowed.some(a => Math.abs(frac - a) < 0.001);
  }

  /**
   * 解析一行脚本并返回错误列表
   * @param {string} line 原始行文本
   * @param {number} lineNum 行号（1-based）
   * @param {object} objIdMap 物体ID→物体的映射表
   * @returns {Array<{line:number, text:string, severity:'error'|'warning'}>}
   */
  function checkScriptLine(line, lineNum, objIdMap) {
    const errors = [];
    const trimmed = line.trim();

    // 跳过空行和注释行
    if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('//')) return errors;

    const parts = trimmed.split(/\s+/);
    const cmd = parts[0].toLowerCase();

    if (cmd === 'move') {
      // move <id> <x> <y> [duration] [-block]
      if (parts.length < 4) {
        errors.push({ line: lineNum, text: 'move 缺少必要参数: move <id> <x> <y> [duration] [-block]', severity: 'error' });
        return errors;
      }

      // 检查物体ID
      const objId = parts[1];
      if (!objIdMap[objId]) {
        // ID可能还没在物体列表中，至少检查格式
        if (!/^[a-zA-Z_]\w*$/.test(objId)) {
          errors.push({ line: lineNum, text: `无效物体ID「${objId}」: 应以字母开头`, severity: 'error' });
        } else {
          errors.push({ line: lineNum, text: `未找到物体「${objId}」, 请先在物体面板中添加`, severity: 'warning' });
        }
      }

      // 检查 x
      const xStr = parts[2];
      const xVal = parseFloat(xStr);
      if (isNaN(xVal)) {
        errors.push({ line: lineNum, text: `x「${xStr}」不是有效数字`, severity: 'error' });
      } else {
        if (xVal < 0 || xVal > 31.5) {
          errors.push({ line: lineNum, text: `x=${xVal} 超出范围 0~31.5`, severity: 'error' });
        } else if (!checkHalfStep(xStr)) {
          errors.push({ line: lineNum, text: `x=${xVal} 精度错误: 需为半步精度（整数或 +0.5）`, severity: 'error' });
        }
      }

      // 检查 y
      const yStr = parts[3];
      const yVal = parseFloat(yStr);
      if (isNaN(yVal)) {
        errors.push({ line: lineNum, text: `y「${yStr}」不是有效数字`, severity: 'error' });
      } else {
        if (yVal < 0 || yVal > 15.5) {
          errors.push({ line: lineNum, text: `y=${yVal} 超出范围 0~15.5`, severity: 'error' });
        } else if (!checkHalfStep(yStr)) {
          errors.push({ line: lineNum, text: `y=${yVal} 精度错误: 需为半步精度（整数或 +0.5）`, severity: 'error' });
        }
      }

      // 检查 duration（可选，第5个参数）
      if (parts.length >= 5 && !parts[4].startsWith('-')) {
        const dStr = parts[4];
        const dVal = parseFloat(dStr);
        if (isNaN(dVal)) {
          errors.push({ line: lineNum, text: `duration「${dStr}」不是有效数字`, severity: 'error' });
        } else {
          if (dVal < 0 || dVal > 15.75) {
            errors.push({ line: lineNum, text: `duration=${dVal} 超出范围 0~15.75`, severity: 'error' });
          } else if (!checkQuarterStep(dStr)) {
            errors.push({ line: lineNum, text: `duration=${dVal} 精度错误: 需为四分之一精度（0/.25/.5/.75）`, severity: 'error' });
          }
        }
      }

      // 检查 -block 标志
      const blockIdx = parts.indexOf('-block');
      if (blockIdx !== -1 && blockIdx < 4) {
        errors.push({ line: lineNum, text: '参数顺序错误: -block 应放在最后', severity: 'error' });
      }

      // 检查未知标志
      for (let i = 4; i < parts.length; i++) {
        if (parts[i].startsWith('-')) {
          if (parts[i] !== '-block') {
            errors.push({ line: lineNum, text: `未知标志「${parts[i]}」`, severity: 'warning' });
          }
        }
      }

      // 检查多余参数
      const numericCount = parts.filter((p, i) => i > 0 && !p.startsWith('-')).length;
      if (numericCount > 4) {
        errors.push({ line: lineNum, text: `参数过多: 应有 3~4 个数值参数, 实际 ${numericCount} 个`, severity: 'error' });
      }

    } else if (cmd === 'wait') {
      // wait <event-type> <params...>
      if (parts.length < 2) {
        errors.push({ line: lineNum, text: 'wait 缺少事件类型', severity: 'error' });
        return errors;
      }

      const event = parts[1];

      if (event === 'player-in-area') {
        // wait player-in-area <x1> <y1> <width> <height>
        if (parts.length < 6) {
          errors.push({ line: lineNum, text: 'player-in-area 需要4个参数: <x1> <y1> <width> <height>', severity: 'error' });
        } else {
          const coords = ['x1', 'y1', 'width', 'height'];
          for (let i = 0; i < 4; i++) {
            const val = parseInt(parts[2 + i], 10);
            if (isNaN(val)) {
              errors.push({ line: lineNum, text: `${coords[i]}「${parts[2 + i]}」不是有效整数`, severity: 'error' });
            } else {
              if (coords[i] === 'x1') {
                if (val < 0 || val > 31) {
                  errors.push({ line: lineNum, text: `${coords[i]}=${val} 超出范围 0~31`, severity: 'error' });
                }
              } else if (coords[i] === 'y1') {
                if (val < 0 || val > 15) {
                  errors.push({ line: lineNum, text: `${coords[i]}=${val} 超出范围 0~15`, severity: 'error' });
                }
              } else {
                // width / height: 1~7
                if (val < 1 || val > 7) {
                  errors.push({ line: lineNum, text: `${coords[i]}=${val} 超出范围 1~7`, severity: 'error' });
                }
              }
            }
          }
          // 检查额外数值参数
          if (parts.length > 6) {
            // 看看多出来的有没有标志位
            const extra = parts.slice(6).filter(p => !p.startsWith('-'));
            if (extra.length > 0) {
              errors.push({ line: lineNum, text: `参数过多: player-in-area 只需要4个参数`, severity: 'error' });
            }
          }
        }

      } else if (event === 'button-press') {
        // wait button-press <id>
        if (parts.length < 3) {
          errors.push({ line: lineNum, text: 'button-press 缺少物体ID', severity: 'error' });
        } else {
          const btnId = parts[2];
          if (!objIdMap[btnId]) {
            if (!/^[a-zA-Z_]\w*$/.test(btnId)) {
              errors.push({ line: lineNum, text: `无效物体ID「${btnId}」: 应以字母开头`, severity: 'error' });
            } else {
              errors.push({ line: lineNum, text: `未找到按钮物体「${btnId}」`, severity: 'warning' });
            }
          } else if (objIdMap[btnId].type !== 'button') {
            errors.push({ line: lineNum, text: `「${btnId}」类型是 ${objIdMap[btnId].type}，不是按钮`, severity: 'warning' });
          }
          if (parts.length > 3) {
            const extra = parts.slice(3).filter(p => !p.startsWith('-'));
            if (extra.length > 0) {
              errors.push({ line: lineNum, text: `参数过多: button-press 只需要1个ID`, severity: 'error' });
            }
          }
        }

      } else if (event === 'for-seconds') {
        // wait for-seconds <n>
        if (parts.length < 3) {
          errors.push({ line: lineNum, text: 'for-seconds 缺少秒数参数', severity: 'error' });
        } else {
          const sStr = parts[2];
          const sVal = parseFloat(sStr);
          if (isNaN(sVal)) {
            errors.push({ line: lineNum, text: `秒数「${sStr}」不是有效数字`, severity: 'error' });
          } else {
            if (sVal < 0 || sVal > 31.5) {
              errors.push({ line: lineNum, text: `秒数=${sVal} 超出范围 0~31.5`, severity: 'error' });
            } else if (!checkHalfStep(sStr)) {
              errors.push({ line: lineNum, text: `秒数=${sVal} 精度错误: 需为半步精度（整数或 +0.5）`, severity: 'error' });
            }
          }
          if (parts.length > 3) {
            const extra = parts.slice(3).filter(p => !p.startsWith('-'));
            if (extra.length > 0) {
              errors.push({ line: lineNum, text: `参数过多: for-seconds 只需要1个秒数`, severity: 'error' });
            }
          }
        }

      } else {
        errors.push({ line: lineNum, text: `未知事件类型「${event}」, 应为 player-in-area / button-press / for-seconds 之一`, severity: 'error' });
      }

    } else if (cmd.startsWith(':')) {
      // 区块标记（:map/:object/:script/:end）在脚本区里不处理
      errors.push({ line: lineNum, text: `区块标记「${cmd}」不应出现在脚本区块中`, severity: 'warning' });

    } else {
      errors.push({ line: lineNum, text: `未知命令「${cmd}」, 应为 move 或 wait`, severity: 'error' });
    }

    return errors;
  }

  /** 执行完整的脚本语法检查 */
  function checkScriptSyntax() {
    const errBar = document.getElementById('scriptErrorBar');
    const errList = document.getElementById('scriptErrorList');
    const errSummary = document.getElementById('scriptErrSummary');

    const text = scriptArea.value;
    const lines = text.split('\n');
    const objIdMap = buildObjectIdMap();

    let allErrors = [];
    for (let i = 0; i < lines.length; i++) {
      const lineErrors = checkScriptLine(lines[i], i + 1, objIdMap);
      allErrors = allErrors.concat(lineErrors);
    }

    if (allErrors.length === 0) {
      errBar.style.display = 'none';
      errList.innerHTML = '';
      return;
    }

    const errCount = allErrors.filter(e => e.severity === 'error').length;
    const warnCount = allErrors.filter(e => e.severity === 'warning').length;
    errSummary.textContent = `⚠️ 发现 ${errCount} 个错误, ${warnCount} 个警告`;

    errList.innerHTML = '';
    for (const err of allErrors) {
      const row = document.createElement('div');
      row.className = 'script-error-row ' + (err.severity === 'error' ? 'err' : 'warn');
      const badge = document.createElement('span');
      badge.textContent = err.severity === 'error' ? '✖' : '⚠';
      badge.style.fontWeight = 'bold';
      const msg = document.createElement('span');
      const prefix = `L${err.line}: `;
      const prefixSpan = document.createElement('span');
      prefixSpan.style.fontWeight = '600';
      prefixSpan.textContent = prefix;
      const textSpan = document.createElement('span');
      textSpan.textContent = err.text;
      msg.appendChild(prefixSpan);
      msg.appendChild(textSpan);
      row.appendChild(badge);
      row.appendChild(msg);
      // 点击行号定位到对应行
      row.style.cursor = 'pointer';
      row.onclick = () => {
        const lineNum = err.line;
        const textarea = scriptArea;
        const lines_arr = textarea.value.split('\n');
        let charPos = 0;
        for (let j = 0; j < lineNum - 1; j++) {
          charPos += lines_arr[j].length + 1;
        }
        textarea.focus();
        textarea.setSelectionRange(charPos, charPos);
        textarea.scrollTop = Math.max(0, (lineNum - 4)) * 18;
      };
      row.title = '点击定位到该行';
      errList.appendChild(row);
    }

    errBar.style.display = 'block';
  }

  // 脚本输入实时语法检测（防抖）
  let scriptCheckTimer = null;
  scriptArea.addEventListener('input', () => {
    clearTimeout(scriptCheckTimer);
    scriptCheckTimer = setTimeout(checkScriptSyntax, 400);
  });

  // 清除错误按钮
  document.getElementById('scriptErrClearBtn').addEventListener('click', () => {
    document.getElementById('scriptErrorBar').style.display = 'none';
  });

  // === Full text export ===
  function generateFullLevelText() {
    let lines = [];
    // Map section
    lines.push(':map');
    lines.push('base ' + (mapData.base === '0' ? 'empty' : 'solid'));
    for (const ins of mapData.instructions) {
      lines.push((ins.type === '0' ? 'empty' : 'solid') + ' ' + ins.startX + ' ' + ins.startY + ' ' + ins.endX + ' ' + ins.endY);
    }
    // Object section
    lines.push('');
    lines.push(':object');
    for (const o of objects) {
      const def = TRAP_DEFS[o.type];
      let line = o.type + ' ' + (o.id || '?') + ' ' + o.x + ' ' + o.y;
      if (def && def.hasW) line += ' ' + (o.width || 1);
      if (def && def.hasH) line += ' ' + (o.height || 1);
      if (o.hidden) line += ' -hidden';
      if (o.noCollision) line += ' -no-collision';
      lines.push(line);
    }
    // Script section
    const script = scriptArea.value.trim();
    lines.push('');
    lines.push(':script');
    if (script) {
      const scriptLines = script.split('\n');
      lines.push(...scriptLines);
    }
    lines.push('');
    lines.push(':end');
    return lines.join('\n');
  }

  function parseFullLevelText(text) {
    const sections = { map: [], object: [], script: [] };
    let current = null;
    const lines = text.split('\n').map(l => l.trim());
    for (const line of lines) {
      if (line.startsWith(':')) {
        const sec = line.slice(1).toLowerCase();
        if (sec === 'end') break;
        if (sec in sections) { current = sec; continue; }
      }
      if (current) {
        // 脚本区块保留空行和注释；地图和物体区块跳过空行
        if (line.length > 0 || current === 'script') {
          sections[current].push(line);
        }
      }
    }

    // Parse map - 过滤掉注释行
    const mapLines = sections.map.filter(l => !l.startsWith(';') && !l.startsWith('//'));
    if (mapLines.length === 0) throw new Error('缺少 :map 区块');
    const baseCmd = mapLines.find(l => l.startsWith('base'));
    if (!baseCmd) throw new Error('缺少 base 指令');
    const baseParts = baseCmd.split(/\s+/);
    const base = baseParts[1] === 'solid' ? '1' : '0';
    const instrs = mapLines.filter(l => !l.startsWith('base')).map(l => {
      const p = l.split(/\s+/);
      if (p.length !== 5) throw new Error('地图指令格式错误: ' + l);
      return { type: p[0] === 'solid' ? '1' : '0', startX: +p[1], startY: +p[2], endX: +p[3], endY: +p[4] };
    });

    // Parse objects - 过滤掉注释行
    const objLines = sections.object.filter(l => !l.startsWith(';') && !l.startsWith('//'));
    const objs = objLines.map(l => {
      const p = l.split(/\s+/);
      if (p.length < 4) throw new Error('物体格式错误: ' + l);
      const type = p[0];
      const def = TRAP_DEFS[type];
      if (!def) throw new Error('未知物体类型: ' + type);
      const obj = { id: p[1], type, x: +p[2], y: +p[3], hidden: false, noCollision: false };
      // 解析标志位
      if (p.includes('-hidden')) obj.hidden = true;
      if (p.includes('-no-collision')) obj.noCollision = true;
      // 过滤标志位后取数值参数
      const numericParts = p.filter(t => !t.startsWith('-'));
      let idx = 4; // numericParts中前4个是 type, id, x, y
      if (def.hasW) { obj.width = +(numericParts[idx] || 1); idx++; }
      if (def.hasH) { obj.height = +(numericParts[idx] || 1); idx++; }
      return obj;
    });
    return { base, instructions: instrs, objects: objs, scriptLines: sections.script };
  }

  // (已迁移至文件下拉菜单)

  // === Toast notification ===
  const toastEl = document.getElementById('toast');
  let toastTimer = null;

  function showToast(msg, isError) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.style.background = isError ? 'var(--danger)' : 'var(--bg-toolbar)';
    toastEl.style.display = 'block';
    toastEl.style.opacity = '1';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.style.opacity = '0';
      setTimeout(() => { toastEl.style.display = 'none'; }, 300);
    }, 3000);
  }

  // === Save level to backend ===
  async function saveLevelToBackend(filename, content) {
    const resp = await fetch(`/api/levels?name=${encodeURIComponent(filename)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      body: content,
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: resp.statusText }));
      throw new Error(err.error || '保存失败');
    }
    return resp.json();
  }

  async function fetchLevelList() {
    const resp = await fetch('/api/levels');
    if (!resp.ok) throw new Error('获取关卡列表失败');
    const data = await resp.json();
    return data.levels || [];
  }

  async function fetchLevelContent(name) {
    const resp = await fetch(`/api/levels?name=${encodeURIComponent(name)}`);
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: resp.statusText }));
      throw new Error(err.error || '加载失败');
    }
    const data = await resp.json();
    return data.content || '';
  }

  // === Load modal ===
  const loadModal = document.getElementById('loadModal');
  const loadModalList = document.getElementById('loadModalList');
  const loadModalCancelBtn = document.getElementById('loadModalCancelBtn');

  loadModalCancelBtn.addEventListener('click', () => {
    loadModal.style.display = 'none';
  });

  // 点击背景关闭模态框
  loadModal.addEventListener('click', (e) => {
    if (e.target === loadModal) loadModal.style.display = 'none';
  });

  // === 文件下拉菜单 ===
  fileMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = fileDropdown.style.display === 'block';
    fileDropdown.style.display = isOpen ? 'none' : 'block';
  });

  // 点击页面其它地方关闭下拉菜单
  document.addEventListener('click', () => {
    fileDropdown.style.display = 'none';
  });

  // 下拉菜单项点击
  fileDropdown.addEventListener('click', (e) => {
    const item = e.target.closest('.dropdown-item');
    if (!item) return;
    const action = item.dataset.action;
    fileDropdown.style.display = 'none';
    switch (action) {
      case 'new': handleNew(); break;
      case 'open': handleOpen(); break;
      case 'save': handleSave(); break;
      case 'saveas': handleSaveAs(); break;
      case 'export': handleExportText(); break;
      case 'import': handleImportText(); break;
      case 'rename': handleRename(); break;
      case 'delete': handleDelete(); break;
    }
  });

  // 快捷按钮
  saveQuickBtn.addEventListener('click', handleSave);
  loadQuickBtn.addEventListener('click', handleOpen);

  // === 判断当前焦点是否在输入控件中 ===
  function isInputFocused() {
    const tag = document.activeElement?.tagName || '';
    const editable = document.activeElement?.isContentEditable;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || editable;
  }

  // === 键盘快捷键 ===
  document.addEventListener('keydown', (e) => {
    // ---- 文件操作（全局） ----
    // Ctrl+N 新建
    if (e.ctrlKey && e.key === 'n') {
      e.preventDefault();
      handleNew();
      return;
    }
    // Ctrl+O 打开
    if (e.ctrlKey && e.key === 'o') {
      e.preventDefault();
      handleOpen();
      return;
    }
    // Ctrl+S 保存
    if (e.ctrlKey && e.key === 's' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
      return;
    }
    // Ctrl+Shift+S 另存为
    if (e.ctrlKey && e.shiftKey && e.key === 's') {
      e.preventDefault();
      handleSaveAs();
      return;
    }
    // Ctrl+E 导出文本
    if (e.ctrlKey && e.key === 'e') {
      e.preventDefault();
      handleExportText();
      return;
    }
    // Ctrl+Shift+I 从文本导入
    if (e.ctrlKey && e.shiftKey && e.key === 'i') {
      e.preventDefault();
      handleImportText();
      return;
    }

    // ---- 以下快捷键在输入控件中不触发 ----
    if (isInputFocused()) return;

    // ---- 模态框相关 ----
    // Escape: 关闭加载模态框 / 取消选中
    if (e.key === 'Escape') {
      if (loadModal.style.display === 'flex') {
        loadModal.style.display = 'none';
        return;
      }
      selInstr = -1; selObj = -1; hovInstr = -1; hovObj = -1;
      updateInstrBtn.disabled = true; deleteInstrBtn.disabled = true;
      updateObjBtn.disabled = true; deleteObjBtn.disabled = true;
      refreshAll();
      return;
    }

    // Delete / Backspace: 删除选中的指令或物体
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selInstr >= 0) {
        deleteInstrBtn.click();
        return;
      }
      if (selObj >= 0) {
        deleteObjBtn.click();
        return;
      }
    }

    // ---- Tab 切换 ----
    if (e.key === 'Tab') {
      e.preventDefault();
      const tabs = ['map', 'obj', 'script'];
      const currentTab = document.querySelector('.tab.active');
      let idx = tabs.findIndex(t => currentTab && currentTab.id === 'tab' + t.charAt(0).toUpperCase() + t.slice(1));
      if (idx < 0) idx = 0;
      if (e.shiftKey) {
        idx = (idx - 1 + tabs.length) % tabs.length;
      } else {
        idx = (idx + 1) % tabs.length;
      }
      switchTab(tabs[idx]);
      return;
    }

    // ---- 方向键: 微调选中的物体位置 ----
    if ((e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') && selObj >= 0) {
      e.preventDefault();
      const o = objects[selObj];
      const step = e.shiftKey ? 5 : 1; // Shift+方向键大步移动
      if (e.key === 'ArrowUp')    o.y = Math.max(0, o.y - step);
      if (e.key === 'ArrowDown')  o.y = Math.min(15, o.y + step);
      if (e.key === 'ArrowLeft')  o.x = Math.max(0, o.x - step);
      if (e.key === 'ArrowRight') o.x = Math.min(31, o.x + step);
      objX.value = o.x; objY.value = o.y;
      refreshAll();
      return;
    }

    // ---- Ctrl+D: 复制选中的物体 ----
    if (e.ctrlKey && e.key === 'd' && selObj >= 0) {
      e.preventDefault();
      const src = objects[selObj];
      const copy = JSON.parse(JSON.stringify(src));
      copy.id = makeObjId(src.type);
      copy.x = Math.min(31, copy.x + 1); // 偏移一格避免完全重叠
      objects.push(copy);
      selObj = objects.length - 1;
      selectObj(selObj);
      refreshAll();
      showToast(`📋 已复制物体: ${src.id} → ${copy.id}`);
      return;
    }

    // ---- 数字键 1-6: 快速选择陷阱类型 ----
    if (/^[1-6]$/.test(e.key) && document.getElementById('panelObj').style.display !== 'none') {
      const types = Object.keys(TRAP_DEFS); // blackhole, floatrect, button, bounce, destination, oneway
      const idx = parseInt(e.key, 10) - 1;
      if (idx < types.length) {
        const type = types[idx];
        const btns = document.querySelectorAll('.trap-btn');
        if (btns[idx]) btns[idx].click();
      }
    }
  });

  // === 文件操作函数 ===
  function handleNew() {
    if (!confirm('新建将清除当前所有内容，继续？')) return;
    mapData = { base: '0', instructions: [] };
    baseSelect.value = '0';
    objects.length = 0;
    scriptArea.value = '';
    currentFilename = null;
    selInstr = -1; selObj = -1; hovInstr = -1; hovObj = -1;
    selectedTrapType = null;
    objForm.style.display = 'none';
    document.querySelectorAll('.trap-btn').forEach(b => b.classList.remove('active'));
    updateInstrBtn.disabled = true; deleteInstrBtn.disabled = true;
    updateObjBtn.disabled = true; deleteObjBtn.disabled = true;
    refreshAll();
    showToast('🆕 已新建空白关卡');
  }

  async function handleOpen() {
    // 调用加载弹窗（复用已有的 loadBtn 逻辑）
    loadModal.style.display = 'flex'; // modal-overlay uses flex
    loadModalList.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-tertiary);">正在加载关卡列表...</div>';
    try {
      const levels = await fetchLevelList();
      if (levels.length === 0) {
        loadModalList.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-tertiary);">📭 没有找到关卡文件</div>';
        return;
      }
      loadModalList.innerHTML = '';
      levels.forEach(lv => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-bottom:1px solid var(--border-light);cursor:pointer;border-radius:4px;';
        row.onmouseenter = () => { row.style.background = 'var(--hover-bg)'; };
        row.onmouseleave = () => { row.style.background = ''; };
        row.onclick = async () => {
          try {
            loadModalList.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-tertiary);">⏳ 加载中...</div>';
            const content = await fetchLevelContent(lv.name);
            const parsed = parseFullLevelText(content);
            mapData = { base: parsed.base, instructions: parsed.instructions };
            baseSelect.value = parsed.base;
            objects.length = 0;
            parsed.objects.forEach(o => objects.push(o));
            scriptArea.value = parsed.scriptLines.join('\n');
            currentFilename = lv.name;
            selInstr = -1; selObj = -1; hovInstr = -1; hovObj = -1;
            updateInstrBtn.disabled = true; deleteInstrBtn.disabled = true;
            updateObjBtn.disabled = true; deleteObjBtn.disabled = true;
            refreshAll();
            loadModal.style.display = 'none';
            showToast(`📂 已加载: ${lv.name}`);
          } catch (err) {
            showToast(`❌ 加载失败: ${err.message}`, true);
            loadModal.style.display = 'none';
          }
        };
        const nameSpan = document.createElement('span');
        nameSpan.textContent = `${lv.name}.txt`;
        nameSpan.style.fontWeight = '500';
        const metaSpan = document.createElement('span');
        const date = new Date(lv.mtime * 1000);
        metaSpan.textContent = `${Math.round(lv.size / 10) / 100}KB · ${date.toLocaleDateString()}`;
        metaSpan.style.cssText = 'font-size:11px;color:var(--text-tertiary);';
        row.appendChild(nameSpan);
        row.appendChild(metaSpan);
        loadModalList.appendChild(row);
      });
    } catch (err) {
      loadModalList.innerHTML = `<div style="padding:20px;text-align:center;color:var(--danger);">❌ ${err.message}</div>`;
    }
  }

  async function handleSave() {
    if (currentFilename) {
      // 已有文件名 → 直接保存
      try {
        const text = generateFullLevelText();
        const result = await saveLevelToBackend(currentFilename, text);
        showToast(`💾 已保存: ${result.filename}`);
      } catch (err) {
        showToast(`❌ 保存失败: ${err.message}`, true);
      }
    } else {
      // 没有文件名 → 转为另存为
      handleSaveAs();
    }
  }

  async function handleSaveAs() {
    const filename = prompt('请输入关卡文件名（不需要 .txt 后缀）：', currentFilename || '');
    if (!filename) return;
    try {
      const text = generateFullLevelText();
      const result = await saveLevelToBackend(filename, text);
      currentFilename = filename;
      refreshAll();
      showToast(`💾 已保存: ${result.filename}`);
    } catch (err) {
      showToast(`❌ 保存失败: ${err.message}`, true);
    }
  }

  async function handleDelete() {
    if (!currentFilename) {
      showToast('⚠️ 当前没有已保存的关卡可删除', true);
      return;
    }
    if (!confirm(`确定要删除关卡「${currentFilename}」吗？此操作不可恢复！`)) return;
    try {
      const resp = await fetch(`/api/levels?name=${encodeURIComponent(currentFilename)}`, { method: 'DELETE' });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: resp.statusText }));
        throw new Error(err.error || '删除失败');
      }
      showToast(`🗑️ 已删除: ${currentFilename}`);
      currentFilename = null;
      // 不清除编辑器内容，只清除文件名
      refreshAll();
    } catch (err) {
      showToast(`❌ 删除失败: ${err.message}`, true);
    }
  }

  async function handleRename() {
    if (!currentFilename) {
      showToast('⚠️ 当前没有已保存的关卡，无法重命名', true);
      return;
    }
    const newName = prompt('请输入新的关卡文件名（不需要 .txt 后缀）：', currentFilename);
    if (!newName || newName === currentFilename) return;
    try {
      // 1. 读取当前内容
      const content = await fetchLevelContent(currentFilename);
      // 2. 保存为新文件
      await saveLevelToBackend(newName, content);
      // 3. 删除旧文件
      const delResp = await fetch(`/api/levels?name=${encodeURIComponent(currentFilename)}`, { method: 'DELETE' });
      if (!delResp.ok) {
        // 新文件已保存但旧文件删除失败，提示用户
        showToast(`⚠️ 已保存为新文件「${newName}」，但旧文件删除失败，请手动删除`, true);
        currentFilename = newName;
        refreshAll();
        return;
      }
      currentFilename = newName;
      refreshAll();
      showToast(`✏️ 已重命名为: ${newName}`);
    } catch (err) {
      showToast(`❌ 重命名失败: ${err.message}`, true);
    }
  }

  function handleExportText() {
    try {
      const text = generateFullLevelText();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text; document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); ta.remove();
      }
      showToast('📋 完整关卡文本已复制到剪贴板');
    } catch (err) {
      showToast(`❌ 复制失败: ${err.message}`, true);
    }
  }

  function handleImportText() {
    const input = prompt('粘贴完整关卡文本（:map ~ :end）：');
    if (!input) return;
    try {
      const parsed = parseFullLevelText(input);
      mapData = { base: parsed.base, instructions: parsed.instructions };
      baseSelect.value = parsed.base;
      objects.length = 0;
      parsed.objects.forEach(o => objects.push(o));
      scriptArea.value = parsed.scriptLines.join('\n');
      currentFilename = null; // 导入后清除文件名关联
      selInstr = -1; selObj = -1; hovInstr = -1; hovObj = -1;
      updateInstrBtn.disabled = true; deleteInstrBtn.disabled = true;
      updateObjBtn.disabled = true; deleteObjBtn.disabled = true;
      refreshAll();
      showToast('📋 文本导入成功！');
    } catch (err) {
      showToast(`❌ 导入失败: ${err.message}`, true);
    }
  }

  // === Init ===
  mapData = {
    base: '0',
    instructions: [
      { type: '1', startX: 2, startY: 11, endX: 29, endY: 14 },
    ]
  };
  baseSelect.value = mapData.base;
  refreshAll();

})();