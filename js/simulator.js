/**
 * Ara DB VER 3.0 — 일일던전 배치 시뮬레이터 (js/simulator.js)
 * 팬 커뮤니티용 일일던전 배치 공유 및 전략 수립 툴:
 *  - 규격별 던전 맵 지원: 14×18 (표준 세로형), 22×18 (가로 확장형), 14×24 (세로 장문형), 26×26 (정사각형)
 *  - 주요 장애물 배치 프리셋 지원
 *  - HTML5 Canvas 기반 인터랙티브 시뮬레이터:
 *      * 정확한 마우스-타일 좌표 맵핑 및 드래그 앤 드롭 이동
 *      * 인게임 그래픽 규격에 맞춘 타워/장애물 배치
 */
(function (global) {
  'use strict';

  // 던전 장애물 추천 배치 패턴 (0-based col, row)
  const PRESET_OBSTACLE_LAYOUTS = {
    pattern_1: {
      label: '장애물 패턴 1 (십자 통로형)',
      coords: [[0, 1], [2, 1], [6, 1], [12, 1], [2, 6], [4, 6], [8, 6], [10, 6]],
    },
    pattern_2: {
      label: '장애물 패턴 2 (분산형)',
      coords: [[0, 1], [2, 1], [8, 1], [10, 1], [2, 3], [2, 7], [4, 7], [10, 7], [12, 7]],
    },
    pattern_3: {
      label: '장애물 패턴 3 (지그재그형)',
      coords: [[2, 1], [10, 1], [4, 3], [6, 5], [10, 5], [2, 9], [6, 9], [10, 9], [12, 9], [4, 11], [2, 13]],
    },
    pattern_4: {
      label: '장애물 패턴 4 (중앙 차단형)',
      coords: [[4, 2], [8, 2], [0, 6], [2, 6], [4, 6], [8, 6], [10, 6], [12, 6]],
    },
  };

  const state = {
    presetId: 'daily_t1',
    cols: 14,
    rows: 18,
    title: '',
    memo: '',
    paletteTab: 'towers', // 'towers' | 'obstacles'
    towerGradeFilter: 'all',
    towerSizeFilter: 'all',
    towerSearch: '',
    selectedTool: null, // { type: 'tower'|'obstacle'|'tile'|'marker'|'eraser', id, name, tileW, tileH, img, boardImg, ... }
    showNames: false, // Default FALSE: Pure tower sprite only, no text labels
    showRange: false,
    showSubGrid: true,
    hoverCell: null, // { col, row, rawCol, rawRow }
    draggingItem: null, // { item, startCol, startRow, offsetX, offsetY, moved }
    isPainting: false,
    paintMode: null, // 'add_buff' | 'del_buff' | 'erase'
    buffTiles: new Set(), // "col,row"
    placedItems: [], // [{ uid, type, id, name, grade, col, row, w, h, img, boardImg, symbol, color, range }]
    history: [],
    uidCounter: 1,
    tilePx: 36,
    wallMarginX: 28,
    wallMarginY: 22,
  };

  // Exact Pedestal Base Bounding Boxes [pedX1, pedY1, pedX2, pedY2, imgW, imgH]
  // Maps the tower's lower pedestal block [pedX1..pedX2, pedY1..pedY2] 100% edge-to-edge
  // onto its [ix..ix+iw, iy..iy+ih] tile footprint while letting the upper turret/head (y < pedY1) protrude upward!
  const SPRITE_PEDESTAL_BOX = {
    'Tower_1.webp': [114, 154, 287, 344, 400, 400],
    'Tower_2.webp': [116, 154, 284, 339, 400, 400],
    'Tower_3.webp': [114, 154, 285, 340, 400, 400],
    'Tower_4.webp': [81, 154, 321, 342, 400, 400],
    'Tower_5.webp': [81, 154, 320, 341, 400, 400],
    'Tower_6.webp': [111, 154, 284, 340, 400, 400],
    'Tower_7.webp': [122, 154, 292, 339, 400, 400],
    'Tower_8.webp': [122, 154, 292, 339, 400, 400],
    'Tower_9.webp': [122, 154, 292, 339, 400, 400],
    'Tower_10.webp': [81, 154, 320, 340, 400, 400],
    'Tower_11.webp': [81, 154, 323, 339, 400, 400],
    'Tower_12.webp': [122, 154, 292, 339, 400, 400],
    'Tower_13.webp': [82, 154, 320, 340, 400, 400],
    'Tower_14.webp': [121, 154, 295, 339, 400, 400],
    'Tower_15.webp': [123, 154, 291, 339, 400, 400],
    'Tower_16.webp': [81, 154, 321, 341, 400, 400],
    'Tower_17.webp': [80, 154, 320, 341, 400, 400],
    'Tower_18.webp': [121, 154, 292, 339, 400, 400],
    'Tower_19.webp': [82, 154, 321, 339, 400, 400],
    'Tower_20.webp': [82, 154, 320, 339, 400, 400],
    'Tower_21.webp': [81, 154, 320, 340, 400, 400],
    'Tower_22.webp': [81, 154, 320, 340, 400, 400],
    'Tower_23.webp': [81, 154, 320, 340, 400, 400],
    'Tower_24.webp': [79, 154, 317, 339, 400, 400],
    'Tower_25.webp': [82, 154, 320, 339, 400, 400],
    'Tower_26.webp': [80, 154, 320, 338, 400, 400],
    'Tower_27.webp': [122, 154, 291, 338, 400, 400],
    'Tower_28.webp': [122, 154, 291, 338, 400, 400],
    'Tower_29.webp': [121, 154, 291, 338, 400, 400],
    'Tower_30.webp': [122, 154, 290, 338, 400, 400],
    'Tower_31.webp': [121, 154, 292, 338, 400, 400],
    'Tower_32.webp': [121, 154, 291, 338, 400, 400],
    'Tower_33.webp': [82, 154, 323, 340, 400, 400],
    'Tower_34.webp': [81, 154, 321, 340, 400, 400],
    'Tower_35.webp': [122, 154, 291, 337, 400, 400],
    'Tower_36.webp': [67, 154, 323, 344, 400, 400],
    'Tower_37.webp': [121, 150, 292, 331, 400, 400],
    'Tower_38.webp': [120, 154, 292, 337, 400, 400],
    'Tower_39.webp': [123, 153, 292, 339, 400, 400],
    'Tower_40.webp': [121, 154, 283, 344, 400, 400],
    'Tower_41.webp': [77, 154, 322, 341, 400, 400],
    'Tower_42.webp': [120, 154, 291, 335, 400, 400],
    'Tower_44.webp': [91, 125, 307, 339, 400, 400],
    'Tower_45.webp': [91, 125, 307, 338, 400, 400],
    'Tower_46.webp': [91, 125, 307, 345, 400, 400],
    'Tower_47.webp': [91, 125, 307, 338, 400, 400],
    'Tower_701.webp': [82, 154, 319, 336, 400, 400],
    'Tower_Object_7.webp': [120, 154, 292, 341, 400, 400],
    'Tower_Obstruction.webp': [117, 154, 290, 337, 400, 400],
    'Tower_Obstruction_Ice.webp': [65, 83, 234, 252, 300, 300],
    'Housing_4.webp': [202, 190, 508, 481, 700, 510],
  };

  function drawAnchoredTowerSprite(ctx, spriteIm, spriteSrc, ix, iy, iw, ih) {
    if (!spriteIm || !spriteIm.complete || spriteIm.naturalWidth <= 0) return;
    const baseName = (spriteSrc || '').split('/').pop().split('?')[0];
    const box = SPRITE_PEDESTAL_BOX[baseName];
    if (!box) {
      ctx.drawImage(spriteIm, ix, iy, iw, ih);
      return;
    }
    const [pedX1, pedY1, pedX2, pedY2, imgW, imgH] = box;
    const pedW = Math.max(1, pedX2 - pedX1);
    const pedH = Math.max(1, pedY2 - pedY1);
    const scaleX = iw / pedW;
    const scaleY = ih / pedH;
    const destX = ix - pedX1 * scaleX;
    const destY = iy - pedY1 * scaleY;
    const destW = imgW * scaleX;
    const destH = imgH * scaleY;
    ctx.drawImage(spriteIm, destX, destY, destW, destH);
  }

  // Sprite Image Cache for 60fps Canvas rendering
  const spriteCache = new Map();
  let rafPending = false;

  function getCachedImage(src) {
    if (!src) return null;
    if (spriteCache.has(src)) {
      return spriteCache.get(src);
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    spriteCache.set(src, img);
    img.onload = () => {
      requestCanvasRender();
    };
    img.src = src;
    return img;
  }

  function preloadSimulatorSprites() {
    const db = getDB();
    const simMeta = getSimMeta();
    if (simMeta.nexusImg) getCachedImage(simMeta.nexusImg);
    if (simMeta.bgImg) getCachedImage(simMeta.bgImg);
    for (const ob of (simMeta.obstacles || [])) {
      if (ob.boardImg) getCachedImage(ob.boardImg);
      if (ob.img) getCachedImage(ob.img);
    }
    for (const tw of (db.towers || [])) {
      if (tw.boardImg) getCachedImage(tw.boardImg);
      else if (tw.img) getCachedImage(tw.img);
    }
  }

  function getDB() {
    return global.ARA_DB_V3 || global.ARA_DB_V2 || {};
  }

  function getSimMeta() {
    const db = getDB();
    return db.dailySimulator || { mapPresets: [], obstacles: [] };
  }

  function getPreset(presetId) {
    const presets = getSimMeta().mapPresets || [];
    return presets.find(p => p.id === presetId) || presets[0] || {
      id: 'daily_t1',
      code: 'Type_1',
      name: '일일던전 1형 (표준 세로형)',
      badge: '14 × 18 타일',
      cols: 14,
      rows: 18,
      nexus: { col: 6, row: 16, w: 2, h: 2, label: '본진 화로' },
      spawns: [{ col: 6, row: 0, w: 2, h: 1, label: '몬스터 입구' }],
    };
  }

  function pushHistory() {
    const snap = {
      presetId: state.presetId,
      cols: state.cols,
      rows: state.rows,
      buffTiles: Array.from(state.buffTiles),
      placedItems: state.placedItems.map(it => ({ ...it })),
    };
    state.history.push(snap);
    if (state.history.length > 40) state.history.shift();
  }

  function undo() {
    if (!state.history.length) return;
    const snap = state.history.pop();
    state.presetId = snap.presetId;
    state.cols = snap.cols;
    state.rows = snap.rows;
    state.buffTiles = new Set(snap.buffTiles);
    state.placedItems = snap.placedItems;
    syncCanvasSize();
    requestCanvasRender();
    renderSummaryBar();
  }

  function selectDefaultTool() {
    if (state.selectedTool) return;
    const db = getDB();
    const towers = db.towers || [];
    const firstTower = towers.find(t => t.name === '해파리') || towers[0];
    if (firstTower) {
      setToolFromTower(firstTower);
    }
  }

  function setToolFromTower(tw) {
    state.selectedTool = {
      type: 'tower',
      id: String(tw.officialId),
      name: tw.name,
      grade: tw.grade,
      tileW: tw.specs?.tileW || 2,
      tileH: tw.specs?.tileH || 2,
      range: tw.specs?.range || 0,
      img: tw.img,
      boardImg: tw.boardImg || tw.img,
    };
    if (state.selectedTool.boardImg) getCachedImage(state.selectedTool.boardImg);
  }

  function setToolFromObstacle(ob) {
    state.selectedTool = {
      type: ob.category || 'obstacle',
      id: ob.id,
      name: ob.name,
      grade: '지형',
      tileW: ob.tileW || 2,
      tileH: ob.tileH || 2,
      range: 0,
      img: ob.img || '',
      boardImg: ob.boardImg || ob.img || '',
      symbol: ob.symbol || '',
      color: ob.color || '#574c49',
    };
    if (state.selectedTool.boardImg) getCachedImage(state.selectedTool.boardImg);
  }

  function getActiveFootprint() {
    const tool = state.selectedTool;
    if (!tool || tool.type === 'eraser') return { w: 1, h: 1 };
    return { w: tool.tileW || 2, h: tool.tileH || 2 };
  }

  function rectsOverlap(c1, r1, w1, h1, c2, r2, w2, h2) {
    return !(c1 + w1 <= c2 || c2 + w2 <= c1 || r1 + h1 <= r2 || r2 + h2 <= r1);
  }

  function isCellInNexus(col, row, w, h) {
    const preset = getPreset(state.presetId);
    const nx = preset.nexus;
    if (!nx) return false;
    return rectsOverlap(col, row, w, h, nx.col, nx.row, nx.w, nx.h);
  }

  function isCellInSpawn(col, row, w, h) {
    const preset = getPreset(state.presetId);
    const spawns = preset.spawns || [];
    return spawns.some(sp => rectsOverlap(col, row, w, h, sp.col, sp.row, sp.w, sp.h));
  }

  function canPlaceAt(col, row, w, h, toolType, ignoreUid = null) {
    if (col < 0 || row < 0 || col + w > state.cols || row + h > state.rows) {
      return false;
    }
    if (isCellInNexus(col, row, w, h) || isCellInSpawn(col, row, w, h)) {
      return false;
    }
    if (toolType === 'tile') {
      return true;
    }
    for (const item of state.placedItems) {
      if (ignoreUid !== null && item.uid === ignoreUid) continue;
      if (rectsOverlap(col, row, w, h, item.col, item.row, item.w, item.h)) {
        return false;
      }
    }
    return true;
  }

  function findItemAtCell(col, row) {
    for (let i = state.placedItems.length - 1; i >= 0; i--) {
      const it = state.placedItems[i];
      if (rectsOverlap(col, row, 1, 1, it.col, it.row, it.w, it.h)) {
        return it;
      }
    }
    return null;
  }

  // 추천 버프 타일(25%) 자동 생성
  function generateRandomBuffTiles25Percent() {
    pushHistory();
    state.buffTiles.clear();
    // 타일은 2×2 규격으로 묶여 약 25%의 타일에 버프 효과가 부여됩니다
    const macroCoords = [];
    for (let r = 0; r < state.rows; r += 2) {
      for (let c = 0; c < state.cols; c += 2) {
        if (isCellInNexus(c, r, 2, 2) || isCellInSpawn(c, r, 2, 2)) continue;
        const hitOb = state.placedItems.some(it => it.type === 'obstacle' && rectsOverlap(c, r, 2, 2, it.col, it.row, it.w, it.h));
        if (hitOb) continue;
        macroCoords.push([c, r]);
      }
    }
    // Shuffle
    for (let i = macroCoords.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = macroCoords[i];
      macroCoords[i] = macroCoords[j];
      macroCoords[j] = tmp;
    }
    const targetCount = Math.max(1, Math.floor(macroCoords.length / 4));
    for (let i = 0; i < targetCount; i++) {
      const [mc, mr] = macroCoords[i];
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          if (mc + dx < state.cols && mr + dy < state.rows) {
            state.buffTiles.add(`${mc + dx},${mr + dy}`);
          }
        }
      }
    }
    requestCanvasRender();
    renderSummaryBar();
    showToast(`추천 버프 타일 ${targetCount}곳(2×2)이 자동 배치되었습니다!`);
  }

  // 던전 장애물 추천 배치 적용
  function applyObstaclePreset(obsKey) {
    const presetData = PRESET_OBSTACLE_LAYOUTS[obsKey];
    if (!presetData) return;
    const obstacles = getSimMeta().obstacles || [];
    const obStone = obstacles.find(o => o.id === 'ob_stone_2x2') || obstacles[0];
    if (!obStone) return;

    pushHistory();
    // Remove existing obstacles first, keep placed towers that don't overlap
    state.placedItems = state.placedItems.filter(it => it.type !== 'obstacle');

    const offsetX = Math.floor((state.cols - 14) / 2);
    const offsetY = Math.floor((state.rows - 18) / 2);

    for (const [baseC, baseR] of presetData.coords) {
      const c = baseC + offsetX;
      const r = baseR + offsetY;
      if (canPlaceAt(c, r, 2, 2, 'obstacle')) {
        state.placedItems.push({
          uid: state.uidCounter++,
          type: 'obstacle',
          id: obStone.id,
          name: obStone.name,
          grade: '지형',
          col: c,
          row: r,
          w: 2,
          h: 2,
          range: 0,
          img: obStone.img,
          boardImg: obStone.boardImg || obStone.img,
          color: obStone.color || '#574c49',
        });
      }
    }
    requestCanvasRender();
    renderSummaryBar();
    showToast(`${presetData.label} 지형이 적용되었습니다!`);
  }

  function loadSampleLayout(sampleKey) {
    const db = getDB();
    const towers = db.towers || [];
    const obstacles = getSimMeta().obstacles || [];
    const findTw = (name) => towers.find(t => t.name.includes(name)) || towers[0];
    const obStone = obstacles.find(o => o.id === 'ob_stone_2x2') || obstacles[0];
    const obHero = obstacles.find(o => o.id === 'marker_hero_2x2');

    pushHistory();
    state.buffTiles.clear();
    state.placedItems = [];

    if (sampleKey === 'sample_t1') {
      applyMapPreset('daily_t1', false);
      state.title = '일일던전 표준형(14×18) 입구 일자 유도 & 주력딜 정석 배치';
      state.memo = '좌우 장애물 사이 중앙 통로로 몬스터를 유도하고 버프 타일(★) 위에 주력 딜타워와 공속 버프 타워를 밀집 배치합니다.';
      ['4,6', '5,6', '4,7', '5,7', '8,6', '9,6', '8,7', '9,7', '4,8', '5,8', '4,9', '5,9'].forEach(k => state.buffTiles.add(k));

      // 추천 장애물 배치 1 적용
      for (const [c, r] of PRESET_OBSTACLE_LAYOUTS.pattern_1.coords) {
        state.placedItems.push({
          uid: state.uidCounter++, type: 'obstacle', id: obStone.id, name: obStone.name, grade: '지형',
          col: c, row: r, w: 2, h: 2, img: obStone.img, boardImg: obStone.boardImg || obStone.img, color: obStone.color
        });
      }

      const placeTw = (name, c, r) => {
        const tw = findTw(name);
        if (!tw) return;
        const w = tw.specs?.tileW || 2;
        const h = tw.specs?.tileH || 2;
        state.placedItems.push({
          uid: state.uidCounter++, type: 'tower', id: String(tw.officialId), name: tw.name, grade: tw.grade,
          col: c, row: r, w, h, range: tw.specs?.range || 0, img: tw.img, boardImg: tw.boardImg || tw.img
        });
      };
      placeTw('해파리', 4, 8);
      placeTw('펭귄', 8, 8);
      placeTw('기억석', 4, 10);
      placeTw('토템', 8, 10);
      placeTw('나무', 4, 12);
      placeTw('모루', 8, 12);
      if (obHero) {
        state.placedItems.push({
          uid: state.uidCounter++, type: 'marker', id: obHero.id, name: '영웅 위치', grade: '마커',
          col: 6, row: 11, w: 2, h: 2, img: obHero.img, boardImg: obHero.boardImg, color: obHero.color
        });
      }
    } else if (sampleKey === 'sample_t2') {
      applyMapPreset('daily_t2', false);
      state.title = '일일던전 가로확장형(22×18) ㄷ자 미로 넉백 배치';
      state.memo = '가로 폭이 넓은 맵에서는 타워로 ㄷ자 우회로를 만들어 이동 거리를 2배 이상 늘려주는 것이 핵심입니다.';
      ['8,6', '9,6', '8,7', '9,7', '10,8', '11,8', '10,9', '11,9', '12,8', '13,8', '12,9', '13,9'].forEach(k => state.buffTiles.add(k));
      const addOb = (c, r) => state.placedItems.push({
        uid: state.uidCounter++, type: 'obstacle', id: obStone.id, name: obStone.name, grade: '지형',
        col: c, row: r, w: 2, h: 2, img: obStone.img, boardImg: obStone.boardImg || obStone.img, color: obStone.color
      });
      addOb(4, 4); addOb(6, 4); addOb(14, 4); addOb(16, 4);
      addOb(6, 12); addOb(14, 12);

      const placeTw = (name, c, r) => {
        const tw = findTw(name);
        if (!tw) return;
        state.placedItems.push({
          uid: state.uidCounter++, type: 'tower', id: String(tw.officialId), name: tw.name, grade: tw.grade,
          col: c, row: r, w: tw.specs?.tileW || 2, h: tw.specs?.tileH || 2,
          range: tw.specs?.range || 0, img: tw.img, boardImg: tw.boardImg || tw.img
        });
      };
      placeTw('해파리', 8, 4);
      placeTw('기억석', 10, 4);
      placeTw('해골 궁수', 8, 8);
      placeTw('불 정령', 10, 8);
      placeTw('전기로켓', 12, 8);
      placeTw('토템', 14, 8);
    } else if (sampleKey === 'sample_t4') {
      applyMapPreset('daily_t4', false);
      state.title = '일일던전 4형 사방포위(26×26) 중앙 화로 호위 배치';
      state.memo = '중앙 화로(4×4) 주변에 버프 타워와 광역/처형 타워를 360도 대칭으로 둘러 사방 웨이브를 동시에 제압합니다.';
      const placeTw = (name, c, r) => {
        const tw = findTw(name);
        if (!tw) return;
        state.placedItems.push({
          uid: state.uidCounter++, type: 'tower', id: String(tw.officialId), name: tw.name, grade: tw.grade,
          col: c, row: r, w: tw.specs?.tileW || 2, h: tw.specs?.tileH || 2,
          range: tw.specs?.range || 0, img: tw.img, boardImg: tw.boardImg || tw.img
        });
      };
      placeTw('해파리', 9, 9);
      placeTw('해파리', 15, 9);
      placeTw('펭귄', 9, 15);
      placeTw('펭귄', 15, 15);
      placeTw('토템', 12, 9);
      placeTw('기억석', 12, 15);
      placeTw('나무', 9, 12);
      placeTw('모루', 15, 12);
    }

    const titleEl = document.getElementById('simTitleInput');
    const memoEl = document.getElementById('simMemoInput');
    if (titleEl) titleEl.value = state.title;
    if (memoEl) memoEl.value = state.memo;
    renderAll();
    showToast('예시 배치를 불러왔습니다! 타워를 드래그해 이동하거나 우클릭으로 삭제할 수 있습니다.');
  }

  function applyMapPreset(presetId, recordHistory = true) {
    const preset = getPreset(presetId);
    if (recordHistory) pushHistory();
    state.presetId = preset.id;
    state.cols = preset.cols;
    state.rows = preset.rows;
    state.buffTiles.clear();
    state.placedItems = [];
  }

  // =========================================================================
  // URL Share Encoding / Decoding (#sim=...)
  // =========================================================================
  function encodeShareState() {
    const payload = {
      p: state.presetId,
      c: state.cols,
      r: state.rows,
      t: state.title || '',
      m: state.memo || '',
      b: Array.from(state.buffTiles),
      i: state.placedItems.map(it => [
        it.type,
        it.id,
        it.col,
        it.row,
        it.w,
        it.h,
      ]),
    };
    const jsonStr = JSON.stringify(payload);
    return btoa(encodeURIComponent(jsonStr));
  }

  function decodeShareState(encodedStr) {
    try {
      const jsonStr = decodeURIComponent(atob(encodedStr));
      const data = JSON.parse(jsonStr);
      if (!data || !data.c || !data.r) return false;
      state.presetId = data.p || 'daily_t1';
      state.cols = parseInt(data.c, 10) || 14;
      state.rows = parseInt(data.r, 10) || 18;
      state.title = data.t || '';
      state.memo = data.m || '';
      state.buffTiles = new Set(Array.isArray(data.b) ? data.b : []);

      const db = getDB();
      const towersById = new Map((db.towers || []).map(tw => [String(tw.officialId), tw]));
      const obsById = new Map((getSimMeta().obstacles || []).map(ob => [ob.id, ob]));

      state.placedItems = [];
      for (const arr of (data.i || [])) {
        const [type, id, col, row, w, h] = arr;
        if (type === 'tower') {
          const tw = towersById.get(String(id));
          if (tw) {
            state.placedItems.push({
              uid: state.uidCounter++,
              type: 'tower',
              id: String(id),
              name: tw.name,
              grade: tw.grade,
              col,
              row,
              w: w || tw.specs?.tileW || 2,
              h: h || tw.specs?.tileH || 2,
              range: tw.specs?.range || 0,
              img: tw.img,
              boardImg: tw.boardImg || tw.img,
            });
          }
        } else {
          const ob = obsById.get(String(id));
          if (ob) {
            state.placedItems.push({
              uid: state.uidCounter++,
              type,
              id: ob.id,
              name: ob.name,
              grade: '지형',
              col,
              row,
              w: w || ob.tileW || 2,
              h: h || ob.tileH || 2,
              range: 0,
              img: ob.img || '',
              boardImg: ob.boardImg || ob.img || '',
              symbol: ob.symbol || '',
              color: ob.color || '#574c49',
            });
          }
        }
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  function copyShareLink() {
    const code = encodeShareState();
    const url = `${window.location.origin}${window.location.pathname}#sim=${code}`;
    try {
      window.history.replaceState(null, '', `#sim=${code}`);
    } catch (e) {}
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        showToast('배치 공유 링크가 클립보드에 복사되었습니다! 단톡방이나 카페에 붙여넣으세요.');
      }).catch(() => {
        prompt('아래 배치 공유 링크를 복사하세요:', url);
      });
    } else {
      prompt('아래 배치 공유 링크를 복사하세요:', url);
    }
  }

  // =========================================================================
  // Shared Battlefield Renderer (Used by both Live Canvas & PNG Export)
  // =========================================================================
  function drawBattlefieldBoard(ctx, tilePx, wallX, wallY, isExport = false) {
    const preset = getPreset(state.presetId);
    const boardW = state.cols * tilePx;
    const boardH = state.rows * tilePx;
    const totalW = boardW + wallX * 2;
    const totalH = boardH + wallY * 2;

    // 1. Deep Cavern Void Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, totalH);
    bgGrad.addColorStop(0, '#181311');
    bgGrad.addColorStop(0.5, '#211a17');
    bgGrad.addColorStop(1, '#16110f');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, totalW, totalH);

    // 2. Outer Stone Wall Blocks (Left & Right 28 blocks)
    const wallRows = state.rows + 2;
    const wallBlockH = totalH / wallRows;
    for (let side = 0; side < 2; side++) {
      const wx = side === 0 ? 2 : totalW - wallX + 2;
      const ww = wallX - 4;
      for (let wr = 0; wr < wallRows; wr++) {
        const wy = wr * wallBlockH;
        const wh = wallBlockH - 1.5;
        // Base stone wall block (#7B5F52 / #684f44 alternating)
        ctx.fillStyle = (wr % 2 === 0) ? '#7b5f52' : '#6d5347';
        ctx.fillRect(wx, wy, ww, wh);
        // 3D top/left highlight bevel
        ctx.fillStyle = 'rgba(255, 235, 220, 0.18)';
        ctx.fillRect(wx, wy, ww, 2.5);
        ctx.fillRect(wx, wy, 2.5, wh);
        // 3D bottom/right deep shadow
        ctx.fillStyle = 'rgba(15, 10, 8, 0.55)';
        ctx.fillRect(wx, wy + wh - 3, ww, 3);
      }
    }

    // Top & Bottom cavern stone rim
    ctx.fillStyle = '#47362f';
    ctx.fillRect(wallX, 0, boardW, wallY);
    ctx.fillRect(wallX, wallY + boardH, boardW, wallY);
    ctx.strokeStyle = '#120d0b';
    ctx.lineWidth = 2;
    ctx.strokeRect(wallX - 1, wallY - 1, boardW + 2, boardH + 2);

    ctx.save();
    ctx.translate(wallX, wallY);

    // 3. Base Cavern Floor under tiles
    ctx.fillStyle = '#261f1c';
    ctx.fillRect(0, 0, boardW, boardH);

    // 4. Buildable Tiles: 2×2 macro stone blocks
    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        const x = c * tilePx;
        const y = r * tilePx;
        const isMacroAlt = (Math.floor(c / 2) + Math.floor(r / 2)) % 2 === 0;
        const isBuff = state.buffTiles.has(`${c},${r}`);

        // Macro 2x2 stone slab tone
        ctx.fillStyle = isMacroAlt ? '#352c28' : '#2e2622';
        ctx.fillRect(x, y, tilePx, tilePx);

        // Tile inset slab
        ctx.fillStyle = isBuff ? 'rgba(250, 204, 21, 0.22)' : 'rgba(255, 255, 255, 0.065)';
        ctx.fillRect(x + 1, y + 1, tilePx - 2, tilePx - 2);

        // Subtle top-left stone bevel
        ctx.fillStyle = isBuff ? 'rgba(253, 224, 71, 0.38)' : 'rgba(255, 255, 255, 0.05)';
        ctx.fillRect(x + 1, y + 1, tilePx - 2, 1.5);

        // Buff Tile effect (Golden rune glow on the tile floor)
        if (isBuff) {
          ctx.strokeStyle = 'rgba(250, 204, 21, 0.65)';
          ctx.lineWidth = 1.2;
          ctx.strokeRect(x + 2, y + 2, tilePx - 4, tilePx - 4);

          ctx.fillStyle = 'rgba(250, 204, 21, 0.85)';
          ctx.font = `bold ${Math.max(9, Math.floor(tilePx * 0.32))}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('★', x + tilePx / 2, y + tilePx / 2);
        }
      }
    }

    // 5. Sub-tile (1x1) & Macro-tile (2x2) Grid Lines
    if (state.showSubGrid) {
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.28)';
      ctx.lineWidth = 1;
      for (let c = 1; c < state.cols; c++) {
        if (c % 2 === 0) continue;
        ctx.beginPath();
        ctx.moveTo(c * tilePx, 0);
        ctx.lineTo(c * tilePx, boardH);
        ctx.stroke();
      }
      for (let r = 1; r < state.rows; r++) {
        if (r % 2 === 0) continue;
        ctx.beginPath();
        ctx.moveTo(0, r * tilePx);
        ctx.lineTo(boardW, r * tilePx);
        ctx.stroke();
      }
    }

    // 2x2 Macro Tile Seams
    ctx.strokeStyle = 'rgba(12, 9, 8, 0.62)';
    ctx.lineWidth = 1.5;
    for (let c = 0; c <= state.cols; c += 2) {
      ctx.beginPath();
      ctx.moveTo(c * tilePx, 0);
      ctx.lineTo(c * tilePx, boardH);
      ctx.stroke();
    }
    for (let r = 0; r <= state.rows; r += 2) {
      ctx.beginPath();
      ctx.moveTo(0, r * tilePx);
      ctx.lineTo(boardW, r * tilePx);
      ctx.stroke();
    }

    // 6. Monster Spawn Portals (Top red portal zone)
    for (const sp of (preset.spawns || [])) {
      const sx = sp.col * tilePx;
      const sy = sp.row * tilePx;
      const sw = sp.w * tilePx;
      const sh = sp.h * tilePx;
      const spGrad = ctx.createRadialGradient(
        sx + sw / 2, sy + sh / 2, 2,
        sx + sw / 2, sy + sh / 2, Math.max(sw, sh) * 0.65
      );
      spGrad.addColorStop(0, 'rgba(239, 68, 68, 0.55)');
      spGrad.addColorStop(1, 'rgba(153, 27, 27, 0.18)');
      ctx.fillStyle = spGrad;
      ctx.fillRect(sx + 1, sy + 1, sw - 2, sh - 2);

      ctx.strokeStyle = 'rgba(248, 113, 113, 0.8)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(sx + 1.5, sy + 1.5, sw - 3, sh - 3);

      ctx.fillStyle = '#fecaca';
      ctx.font = `bold ${Math.max(10, Math.floor(tilePx * 0.3))}px "Pretendard", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('▼ 몬스터 입구', sx + sw / 2, sy + sh / 2);
    }

    // 7. Nexus Brazier (Bottom or Center Fire Brazier — pure sprite, no bulky box)
    if (preset.nexus) {
      const nx = preset.nexus;
      const nX = nx.col * tilePx;
      const nY = nx.row * tilePx;
      const nW = nx.w * tilePx;
      const nH = nx.h * tilePx;

      // Warm brazier floor glow
      const nxGrad = ctx.createRadialGradient(
        nX + nW / 2, nY + nH / 2, 4,
        nX + nW / 2, nY + nH / 2, Math.max(nW, nH) * 0.65
      );
      nxGrad.addColorStop(0, 'rgba(245, 158, 11, 0.42)');
      nxGrad.addColorStop(1, 'rgba(245, 158, 11, 0.0)');
      ctx.fillStyle = nxGrad;
      ctx.fillRect(nX - 6, nY - 6, nW + 12, nH + 12);

      const nexusSrc = getSimMeta().nexusImg;
      const nexusIm = getCachedImage(nexusSrc);
      if (nexusIm && nexusIm.complete && nexusIm.naturalWidth > 0) {
        drawAnchoredTowerSprite(ctx, nexusIm, nexusSrc, nX, nY, nW, nH);
      } else {
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(nX + nW / 2, nY + nH / 2, Math.min(nW, nH) * 0.35, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 8. Optional Range Circles (drawn underneath tower sprites so they don't obscure towers)
    if (state.showRange) {
      for (const item of state.placedItems) {
        if (item.type === 'tower' && item.range > 0) {
          const cx = (item.col + item.w / 2) * tilePx;
          const cy = (item.row + item.h / 2) * tilePx;
          const radius = (item.range / 120) * tilePx * 2.2;
          ctx.save();
          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    // 9. Placed Obstacles, Markers & Towers — Pedestal Base Fills [ix..ix+iw, iy..iy+ih] 100%, Upper Body Protrudes Above iy!
    // Sort by bottom Y ((row + h) ascending) so objects in lower rows naturally overlap the base of objects above them!
    const sortedItems = [...state.placedItems].sort((a, b) => ((a.row + a.h) - (b.row + b.h)) || (a.col - b.col));

    for (const item of sortedItems) {
      const isBeingDragged = !isExport && state.draggingItem && state.draggingItem.item.uid === item.uid;
      const ix = item.col * tilePx;
      const iy = item.row * tilePx;
      const iw = item.w * tilePx;
      const ih = item.h * tilePx;

      ctx.save();
      if (isBeingDragged) {
        ctx.globalAlpha = 0.35;
      }

      const spriteSrc = item.boardImg || item.img;
      const spriteIm = getCachedImage(spriteSrc);
      if (spriteIm && spriteIm.complete && spriteIm.naturalWidth > 0) {
        drawAnchoredTowerSprite(ctx, spriteIm, spriteSrc, ix, iy, iw, ih);
      } else if (item.symbol) {
        ctx.fillStyle = item.color || '#22c55e';
        ctx.font = `bold ${Math.floor(Math.min(iw, ih) * 0.55)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(item.symbol, ix + iw / 2, iy + ih / 2);
      }

      // Only draw tiny floating name text if user explicitly checked "타워 이름 표시" (off by default)
      if (state.showNames && item.w >= 2) {
        ctx.font = `bold ${Math.max(10, Math.floor(tilePx * 0.28))}px "Pretendard", "맑은 고딕", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.88)';
        ctx.strokeText(item.name.slice(0, 6), ix + iw / 2, iy + ih - 2);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(item.name.slice(0, 6), ix + iw / 2, iy + ih - 2);
      }

      ctx.restore();
    }

    // 10. Live Hover / Drag Ghost Preview (Only on live canvas, never in exported PNG)
    if (!isExport && state.hoverCell) {
      if (state.draggingItem) {
        // Dragging an existing tower/obstacle to a new position
        const it = state.draggingItem.item;
        const hc = state.hoverCell.col;
        const hr = state.hoverCell.row;
        const valid = canPlaceAt(hc, hr, it.w, it.h, it.type, it.uid);
        const gx = hc * tilePx;
        const gy = hr * tilePx;
        const gw = it.w * tilePx;
        const gh = it.h * tilePx;

        // Subtle tile footprint highlight under the dragged sprite
        ctx.fillStyle = valid ? 'rgba(34, 197, 94, 0.28)' : 'rgba(239, 68, 68, 0.35)';
        ctx.fillRect(gx, gy, gw, gh);

        const dragSrc = it.boardImg || it.img;
        const spriteIm = getCachedImage(dragSrc);
        if (spriteIm && spriteIm.complete && spriteIm.naturalWidth > 0) {
          ctx.save();
          ctx.globalAlpha = 0.88;
          drawAnchoredTowerSprite(ctx, spriteIm, dragSrc, gx, gy, gw, gh);
          ctx.restore();
        }
      } else if (state.selectedTool) {
        const tool = state.selectedTool;
        if (tool.type === 'eraser') {
          const hc = state.hoverCell.rawCol;
          const hr = state.hoverCell.rawRow;
          const hitItem = findItemAtCell(hc, hr);
          if (hitItem) {
            ctx.fillStyle = 'rgba(239, 68, 68, 0.38)';
            ctx.fillRect(hitItem.col * tilePx, hitItem.row * tilePx, hitItem.w * tilePx, hitItem.h * tilePx);
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 2;
            ctx.strokeRect(hitItem.col * tilePx + 1, hitItem.row * tilePx + 1, hitItem.w * tilePx - 2, hitItem.h * tilePx - 2);
          } else if (hc >= 0 && hr >= 0 && hc < state.cols && hr < state.rows) {
            ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
            ctx.fillRect(hc * tilePx, hr * tilePx, tilePx, tilePx);
          }
        } else {
          const { w, h } = getActiveFootprint();
          const hc = state.hoverCell.col;
          const hr = state.hoverCell.row;
          const valid = canPlaceAt(hc, hr, w, h, tool.type);
          const gx = hc * tilePx;
          const gy = hr * tilePx;
          const gw = w * tilePx;
          const gh = h * tilePx;

          // Ground footprint indicator (cyan for valid, red for blocked)
          ctx.fillStyle = valid ? 'rgba(56, 189, 248, 0.22)' : 'rgba(239, 68, 68, 0.34)';
          ctx.fillRect(gx, gy, gw, gh);
          ctx.strokeStyle = valid ? 'rgba(125, 211, 252, 0.85)' : 'rgba(248, 113, 113, 0.9)';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(gx + 0.75, gy + 0.75, gw - 1.5, gh - 1.5);

          const hoverSrc = tool.boardImg || tool.img;
          const spriteIm = getCachedImage(hoverSrc);
          if (spriteIm && spriteIm.complete && spriteIm.naturalWidth > 0) {
            ctx.save();
            ctx.globalAlpha = valid ? 0.86 : 0.45;
            drawAnchoredTowerSprite(ctx, spriteIm, hoverSrc, gx, gy, gw, gh);
            ctx.restore();
          } else if (tool.type === 'tile') {
            ctx.fillStyle = 'rgba(250, 204, 21, 0.9)';
            ctx.font = `bold ${Math.floor(tilePx * 0.45)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('★', gx + gw / 2, gy + gh / 2);
          }
        }
      }
    }

    ctx.restore();
  }

  // =========================================================================
  // Live Interactive HTML5 <canvas> Management
  // =========================================================================
  function computeOptimalTilePx() {
    const isMobile = window.innerWidth <= 768;
    if (state.cols >= 24) return isMobile ? 22 : 28;
    if (state.cols >= 20) return isMobile ? 24 : 32;
    return isMobile ? 28 : 38;
  }

  function syncCanvasSize() {
    const canvas = document.getElementById('simBattleCanvas');
    if (!canvas) return;
    state.tilePx = computeOptimalTilePx();
    state.wallMarginX = Math.max(20, Math.round(state.tilePx * 0.72));
    state.wallMarginY = Math.max(22, Math.round(state.tilePx * 0.75));

    const cssW = state.cols * state.tilePx + state.wallMarginX * 2;
    const cssH = state.rows * state.tilePx + state.wallMarginY * 2;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);

    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
  }

  function requestCanvasRender() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      renderBoardOnly();
    });
  }

  function renderBoardOnly() {
    const canvas = document.getElementById('simBattleCanvas');
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawBattlefieldBoard(ctx, state.tilePx, state.wallMarginX, state.wallMarginY, false);
    ctx.restore();
  }

  // Convert mouse/pointer clientX, clientY to exact board (col, row)
  function clientToBoardCoords(canvas, clientX, clientY, footprintW, footprintH) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = (state.cols * state.tilePx + state.wallMarginX * 2) / rect.width;
    const scaleY = (state.rows * state.tilePx + state.wallMarginY * 2) / rect.height;

    const localX = (clientX - rect.left) * scaleX - state.wallMarginX;
    const localY = (clientY - rect.top) * scaleY - state.wallMarginY;

    const exactCol = localX / state.tilePx;
    const exactRow = localY / state.tilePx;
    const rawCol = Math.floor(exactCol);
    const rawRow = Math.floor(exactRow);

    // Center the w×h footprint right under the cursor so a 2×2 tower sits symmetrically on the mouse
    const centeredCol = Math.round(exactCol - footprintW / 2);
    const centeredRow = Math.round(exactRow - footprintH / 2);

    const clampedCol = Math.min(Math.max(0, centeredCol), Math.max(0, state.cols - footprintW));
    const clampedRow = Math.min(Math.max(0, centeredRow), Math.max(0, state.rows - footprintH));

    return {
      rawCol,
      rawRow,
      col: clampedCol,
      row: clampedRow,
      insideBoard: exactCol >= -0.5 && exactRow >= -0.5 && exactCol <= state.cols + 0.5 && exactRow <= state.rows + 0.5,
    };
  }

  // =========================================================================
  // High-DPI PNG Image Export ("배치는 이렇게 하면 좋아요~")
  // =========================================================================
  async function exportBoardAsPNG() {
    showToast('인게임 배치 공유 이미지를 생성 중입니다...');
    preloadSimulatorSprites();
    const preset = getPreset(state.presetId);
    const tilePx = 38;
    const wallX = 28;
    const wallY = 18;
    const padX = 36;
    const headerH = 110;
    const footerH = 92;
    const stageW = state.cols * tilePx + wallX * 2;
    const stageH = state.rows * tilePx + wallY * 2;
    const canvasW = Math.max(stageW + padX * 2, 660);
    const canvasH = headerH + stageH + footerH + 36;
    const stageOffsetX = Math.floor((canvasW - stageW) / 2);
    const stageOffsetY = headerH;

    const canvas = document.createElement('canvas');
    const dpr = 2;
    canvas.width = canvasW * dpr;
    canvas.height = canvasH * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    // 1. Background
    const grad = ctx.createLinearGradient(0, 0, 0, canvasH);
    grad.addColorStop(0, '#141110');
    grad.addColorStop(1, '#1c1816');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Border frame
    ctx.strokeStyle = '#3f3530';
    ctx.lineWidth = 3;
    ctx.strokeRect(6, 6, canvasW - 12, canvasH - 12);

    // 2. Header (Title, Map Preset Badge, Memo)
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 13px "Pretendard", "맑은 고딕", sans-serif';
    ctx.fillText(`UNDERDARK · ${preset.name} (${state.cols}×${state.rows})`, padX, 34);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 20px "Pretendard", "맑은 고딕", sans-serif';
    const titleTxt = (state.title || '일일던전 추천 타워 배치 공유').slice(0, 42);
    ctx.fillText(titleTxt, padX, 62);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '13px "Pretendard", "맑은 고딕", sans-serif';
    const memoTxt = (state.memo || '장애물과 타워 위치를 참고하여 일일던전을 공략해보세요!').slice(0, 65);
    ctx.fillText(memoTxt, padX, 88);

    // 3. Draw Battlefield Board
    ctx.save();
    ctx.translate(stageOffsetX, stageOffsetY);
    drawBattlefieldBoard(ctx, tilePx, wallX, wallY, true);
    ctx.restore();

    // 4. Footer summary (Used towers count)
    const fy = headerH + stageH + 28;
    const towerCounts = new Map();
    let obCount = 0;
    for (const it of state.placedItems) {
      if (it.type === 'tower') {
        towerCounts.set(it.name, (towerCounts.get(it.name) || 0) + 1);
      } else if (it.type === 'obstacle') {
        obCount++;
      }
    }
    const summaryParts = [];
    towerCounts.forEach((cnt, name) => summaryParts.push(`${name} ×${cnt}`));
    if (obCount > 0) summaryParts.push(`장애물 ×${obCount}`);
    if (state.buffTiles.size > 0) summaryParts.push(`버프타일 ★×${Math.round(state.buffTiles.size / 4) || state.buffTiles.size}`);

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 12px "Pretendard", "맑은 고딕", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('배치 요약:', padX, fy);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px "Pretendard", "맑은 고딕", sans-serif';
    const sumLine = summaryParts.length ? summaryParts.join('  |  ') : '배치된 타워 없음';
    ctx.fillText(sumLine.slice(0, 75), padX, fy + 22);

    ctx.fillStyle = '#64748b';
    ctx.font = '11px "Pretendard", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('Ara DB V3 · 일일던전 인게임 배치 시뮬레이터', canvasW - padX, fy + 22);

    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    const cleanTitle = (state.title || preset.name).replace(/[^\w가-힣_-]+/g, '_');
    a.href = dataUrl;
    a.download = `언더다크_배치공유_${cleanTitle}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('배치 이미지(PNG)가 저장되었습니다!');
  }

  function showToast(msg) {
    if (global.showAppToast) {
      global.showAppToast(msg);
      return;
    }
    let el = document.getElementById('simToastMsg');
    if (!el) {
      el = document.createElement('div');
      el.id = 'simToastMsg';
      el.className = 'sim-toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('visible');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('visible'), 2600);
  }

  // =========================================================================
  // Palette & UI Rendering
  // =========================================================================
  function renderPaletteOnly() {
    const paletteListEl = document.getElementById('simPaletteList');
    const activeToolBar = document.getElementById('simActiveToolBar');
    if (!paletteListEl) return;

    const db = getDB();
    const simMeta = getSimMeta();

    if (activeToolBar && state.selectedTool) {
      const t = state.selectedTool;
      const { w, h } = getActiveFootprint();
      activeToolBar.innerHTML = `
        <div class="sim-active-tool-info">
          ${(t.boardImg || t.img) ? `<img src="${t.boardImg || t.img}" alt="" class="sim-active-tool-thumb">` : `<span class="sim-active-tool-icon">${t.type === 'eraser' ? '🧹' : '★'}</span>`}
          <div>
            <div class="sim-active-tool-name">${t.name} <span class="sim-size-pill">${w}×${h}</span></div>
            <div class="sim-active-tool-hint">${t.type === 'eraser' ? '클릭 또는 드래그하여 보드 위의 오브젝트를 삭제합니다' : '빈 타일 클릭: 배치 · 놓인 타워 드래그: 위치 이동 · 우클릭(또는 재클릭): 삭제'}</div>
          </div>
        </div>
        <div class="sim-active-tool-actions">
          <button type="button" class="sim-mini-btn ${t.type === 'eraser' ? 'active' : ''}" id="simEraserBtn">🧹 지우개</button>
        </div>
      `;
      const erBtn = document.getElementById('simEraserBtn');
      if (erBtn) {
        erBtn.addEventListener('click', () => {
          state.selectedTool = { type: 'eraser', id: 'eraser', name: '지우개 (클릭/드래그 삭제)', tileW: 1, tileH: 1 };
          renderPaletteOnly();
          requestCanvasRender();
        });
      }
    }

    if (state.paletteTab === 'obstacles') {
      const obs = simMeta.obstacles || [];
      paletteListEl.innerHTML = obs.map(ob => {
        const isSel = state.selectedTool && state.selectedTool.id === ob.id;
        return `
          <button type="button" class="sim-palette-card ${isSel ? 'selected' : ''}" data-ob-id="${ob.id}">
            <div class="sim-palette-img-wrap">
              ${(ob.boardImg || ob.img)
                ? `<img src="${ob.boardImg || ob.img}" alt="${ob.name}" loading="lazy">`
                : `<span class="sim-palette-symbol" style="color:${ob.color || '#facc15'}">${ob.symbol || '★'}</span>`
              }
              <span class="sim-palette-size-badge">${ob.tileW}×${ob.tileH}</span>
            </div>
            <div class="sim-palette-meta">
              <div class="sim-palette-title">${ob.name}</div>
              <div class="sim-palette-sub">${ob.desc || ''}</div>
            </div>
          </button>
        `;
      }).join('');

      paletteListEl.querySelectorAll('[data-ob-id]').forEach(btn => {
        btn.addEventListener('click', () => {
          const ob = (simMeta.obstacles || []).find(x => x.id === btn.dataset.obId);
          if (ob) {
            setToolFromObstacle(ob);
            renderPaletteOnly();
            requestCanvasRender();
          }
        });
      });
      return;
    }

    // Towers tab
    const q = state.towerSearch.trim().toLowerCase();
    const towers = (db.towers || []).filter(tw => {
      if (state.towerGradeFilter !== 'all' && tw.grade !== state.towerGradeFilter) return false;
      const w = tw.specs?.tileW || 2;
      const h = tw.specs?.tileH || 2;
      if (state.towerSizeFilter === '2x2' && !(w === 2 && h === 2)) return false;
      if (state.towerSizeFilter === '3x2' && !((w === 3 && h === 2) || (w === 2 && h === 3))) return false;
      if (state.towerSizeFilter === 'large' && (w * h < 8)) return false;
      if (q) {
        const hay = `${tw.name} ${tw.grade} ${tw.heroDeckRec || ''}`.toLowerCase();
        const cho = global.AraSearchV3 ? global.AraSearchV3.toChosung(tw.name) : '';
        if (!hay.includes(q) && !cho.includes(q)) return false;
      }
      return true;
    });

    paletteListEl.innerHTML = towers.map(tw => {
      const isSel = state.selectedTool && state.selectedTool.type === 'tower' && state.selectedTool.id === String(tw.officialId);
      const w = tw.specs?.tileW || 2;
      const h = tw.specs?.tileH || 2;
      const gCls = tw.grade === '전설' ? 'legend' : tw.grade === '희귀' ? 'rare' : 'normal';
      return `
        <button type="button" class="sim-palette-card ${isSel ? 'selected' : ''}" data-tw-id="${tw.officialId}">
          <div class="sim-palette-img-wrap grade-${gCls}">
            <img src="${tw.boardImg || tw.img}" alt="${tw.name}" loading="lazy">
            <span class="sim-palette-size-badge">${w}×${h}</span>
          </div>
          <div class="sim-palette-meta">
            <div class="sim-palette-title">
              <span class="sim-grade-dot ${gCls}"></span>${tw.name}
            </div>
            <div class="sim-palette-sub">${tw.grade}${tw.heroDeckRec ? ` · <b class="sim-rec-tag">${tw.heroDeckRec}</b>` : ''}</div>
          </div>
        </button>
      `;
    }).join('');

    paletteListEl.querySelectorAll('[data-tw-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tw = (db.towers || []).find(x => String(x.officialId) === btn.dataset.twId);
        if (tw) {
          setToolFromTower(tw);
          renderPaletteOnly();
          requestCanvasRender();
        }
      });
    });
  }

  function renderSummaryBar() {
    const el = document.getElementById('simSummaryFooter');
    if (!el) return;
    const towerCounts = new Map();
    let obCount = 0;
    for (const it of state.placedItems) {
      if (it.type === 'tower') {
        towerCounts.set(it.name, (towerCounts.get(it.name) || 0) + 1);
      } else if (it.type === 'obstacle') {
        obCount++;
      }
    }
    const chips = [];
    towerCounts.forEach((cnt, name) => {
      chips.push(`<span class="sim-used-chip tower">${name} <b>×${cnt}</b></span>`);
    });
    if (obCount > 0) chips.push(`<span class="sim-used-chip ob">장애물 <b>×${obCount}</b></span>`);
    if (state.buffTiles.size > 0) chips.push(`<span class="sim-used-chip buff">버프타일 ★ <b>×${state.buffTiles.size}칸</b></span>`);

    el.innerHTML = chips.length
      ? `<span class="sim-used-label">현재 배치 구성:</span> ${chips.join('')}`
      : `<span class="sim-used-empty">우측 목록에서 타워·장애물을 골라 전장 위에 클릭해보세요! (놓인 타워 드래그 이동 · 우클릭 삭제)</span>`;
  }

  function renderAll() {
    const root = document.getElementById('simulatorMountRoot');
    if (!root) return;
    selectDefaultTool();
    preloadSimulatorSprites();
    const presets = getSimMeta().mapPresets || [];
    const curPreset = getPreset(state.presetId);

    root.innerHTML = `
      <div class="sim-layout-wrapper">
        <!-- Top Map Size & Share Control Bar -->
        <div class="sim-top-panel">
          <div class="sim-top-header">
            <div>
              <span class="sim-eyebrow">DAILY DUNGEON SIMULATOR</span>
              <h2 class="sim-main-title">일일던전 배치 시뮬레이터 & 공유 보드</h2>
              <p class="sim-main-desc">일일던전 규격(<b>표준 14×18 · 가로 22×18 · 장문 14×24 · 대형 26×26</b>) 위에 타워 스탠딩 이미지를 자유롭게 배치하고 전략을 공유해보세요.</p>
            </div>
            <div class="sim-share-btns">
              <button type="button" class="sim-btn sim-btn-primary" id="simShareLinkBtn">🔗 공유 링크 복사</button>
              <button type="button" class="sim-btn sim-btn-accent" id="simExportPngBtn">📸 배치 이미지 저장 (PNG)</button>
            </div>
          </div>

          <!-- Map Size Preset Selector -->
          <div class="sim-preset-row">
            <span class="sim-row-label">1. 일일던전 맵 크기 선택</span>
            <div class="sim-preset-chips">
              ${presets.map(p => `
                <button type="button" class="sim-preset-chip ${p.id === state.presetId ? 'active' : ''}" data-preset-id="${p.id}">
                  <span class="sim-preset-name">${p.name}</span>
                  <span class="sim-preset-badge">${p.badge}</span>
                </button>
              `).join('')}
            </div>
            <div class="sim-preset-desc">${curPreset.desc || ''} · <b>${curPreset.spawnDir || ''}</b></div>
          </div>

          <!-- Share Title & Memo Inputs + Sample Layouts -->
          <div class="sim-meta-inputs-row">
            <div class="sim-input-group">
              <label for="simTitleInput">배치 제목</label>
              <input type="text" id="simTitleInput" class="sim-text-input" placeholder="예: 오늘자 일일던전(14×18) 해파리+기억석 정석 배치" value="${(state.title || '').replace(/"/g, '&quot;')}">
            </div>
            <div class="sim-input-group flex-2">
              <label for="simMemoInput">핵심 공략 한줄 코멘트</label>
              <input type="text" id="simMemoInput" class="sim-text-input" placeholder="예: 배치는 이렇게 하면 좋아요~ 입구 양옆 바위 사이에 해파리를 놓고 영웅은 중앙에 세우세요!" value="${(state.memo || '').replace(/"/g, '&quot;')}">
            </div>
            <div class="sim-sample-group">
              <label>추천 지형 / 예시 불러오기</label>
              <div class="sim-sample-btns">
                <button type="button" class="sim-mini-btn" data-obs-pattern="pattern_1" title="십자 통로형 추천 장애물 배치">🪨 장애물 패턴1</button>
                <button type="button" class="sim-mini-btn" data-obs-pattern="pattern_2" title="분산형 추천 장애물 배치">🪨 장애물 패턴2</button>
                <button type="button" class="sim-mini-btn" data-obs-pattern="pattern_4" title="중앙 차단형 추천 장애물 배치">🪨 장애물 패턴3</button>
                <button type="button" class="sim-mini-btn" id="simRandBuffBtn" title="추천 버프 타일(25%) 자동 생성">★ 버프타일 25%</button>
                <button type="button" class="sim-mini-btn" data-sample="sample_t1">📋 완성 예시</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Main Workspace: Battlefield Board (Left) + Palette (Right) -->
        <div class="sim-workspace-grid">
          <!-- Left: Canvas Battlefield Board -->
          <div class="sim-board-card">
            <div class="sim-board-toolbar">
              <div class="sim-board-toolbar-left">
                <span class="sim-board-dim-badge">${curPreset.name} · <b>${state.cols} × ${state.rows}</b></span>
                <label class="sim-toggle-lbl" title="체크 해제 시 인게임처럼 순수 타워 스프라이트만 깔끔하게 표시됩니다">
                  <input type="checkbox" id="simShowNamesChk" ${state.showNames ? 'checked' : ''}> 이름 표시
                </label>
                <label class="sim-toggle-lbl">
                  <input type="checkbox" id="simShowRangeChk" ${state.showRange ? 'checked' : ''}> 사거리 원
                </label>
              </div>
              <div class="sim-board-toolbar-right">
                <button type="button" class="sim-mini-btn" id="simUndoBtn">↩️ 실행취소</button>
                <button type="button" class="sim-mini-btn danger" id="simClearBtn">🗑️ 전체 초기화</button>
              </div>
            </div>

            <div class="sim-cavern-stage" id="simCavernStage">
              <canvas id="simBattleCanvas" class="sim-battle-canvas"></canvas>
            </div>

            <div class="sim-summary-footer" id="simSummaryFooter"></div>
          </div>

          <!-- Right: Tower & Obstacle Selector Palette -->
          <div class="sim-palette-card-container">
            <div class="sim-active-tool-bar" id="simActiveToolBar"></div>

            <div class="sim-palette-tabs">
              <button type="button" class="sim-ptab ${state.paletteTab === 'towers' ? 'active' : ''}" data-ptab="towers">
                🏰 타워 목록 (46종)
              </button>
              <button type="button" class="sim-ptab ${state.paletteTab === 'obstacles' ? 'active' : ''}" data-ptab="obstacles">
                🪨 장애물 · 버프타일 ★
              </button>
            </div>

            ${state.paletteTab === 'towers' ? `
              <div class="sim-palette-filters">
                <input type="search" id="simTowerSearchInput" class="sim-search-input" placeholder="타워 이름 / 초성 검색 (예: ㅎㅍㄹ, 해파리, 기억석)" value="${state.towerSearch}">
                <div class="sim-filter-pills">
                  <button type="button" class="sim-fpill ${state.towerGradeFilter === 'all' ? 'active' : ''}" data-gfilter="all">전체 등급</button>
                  <button type="button" class="sim-fpill ${state.towerGradeFilter === '전설' ? 'active' : ''}" data-gfilter="전설">전설</button>
                  <button type="button" class="sim-fpill ${state.towerGradeFilter === '희귀' ? 'active' : ''}" data-gfilter="희귀">희귀</button>
                  <button type="button" class="sim-fpill ${state.towerGradeFilter === '일반' ? 'active' : ''}" data-gfilter="일반">일반</button>
                </div>
                <div class="sim-filter-pills">
                  <button type="button" class="sim-fpill ${state.towerSizeFilter === 'all' ? 'active' : ''}" data-sfilter="all">전체 크기</button>
                  <button type="button" class="sim-fpill ${state.towerSizeFilter === '2x2' ? 'active' : ''}" data-sfilter="2x2">2×2 (4칸)</button>
                  <button type="button" class="sim-fpill ${state.towerSizeFilter === '3x2' ? 'active' : ''}" data-sfilter="3x2">3×2 / 2×3 (6칸)</button>
                  <button type="button" class="sim-fpill ${state.towerSizeFilter === 'large' ? 'active' : ''}" data-sfilter="large">대형 (8~16칸)</button>
                </div>
              </div>
            ` : `
              <div class="sim-palette-obs-guide">
                일일던전에 등장하는 <b>바위/얼음/수정 장애물</b>과 <b>버프 타일(★)</b>, <b>영웅 추천 위치</b>를 자유롭게 배치해보세요. 상단 <b>[🪨 장애물 패턴1~3]</b>을 누르면 실제 인게임 일일던전 장애물이 즉시 깔립니다!
              </div>
            `}

            <div class="sim-palette-list" id="simPaletteList"></div>
          </div>
        </div>
      </div>
    `;

    syncCanvasSize();
    bindSimulatorEvents();
    renderBoardOnly();
    renderPaletteOnly();
    renderSummaryBar();
  }

  function bindSimulatorEvents() {
    // Map preset buttons
    document.querySelectorAll('[data-preset-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const pid = btn.dataset.presetId;
        if (pid === state.presetId) return;
        if (state.placedItems.length > 0 && !confirm('맵 크기를 변경하면 현재 배치된 오브젝트가 초기화됩니다. 변경하시겠습니까?')) {
          return;
        }
        applyMapPreset(pid, true);
        renderAll();
      });
    });

    // Title & Memo inputs
    const titleInput = document.getElementById('simTitleInput');
    if (titleInput) {
      titleInput.addEventListener('input', (e) => { state.title = e.target.value; });
    }
    const memoInput = document.getElementById('simMemoInput');
    if (memoInput) {
      memoInput.addEventListener('input', (e) => { state.memo = e.target.value; });
    }

    // Obstacle Presets & Random 25% Buff Tile generator
    document.querySelectorAll('[data-obs-pattern]').forEach(btn => {
      btn.addEventListener('click', () => applyObstaclePreset(btn.dataset.obsPattern));
    });
    const randBuffBtn = document.getElementById('simRandBuffBtn');
    if (randBuffBtn) {
      randBuffBtn.addEventListener('click', generateRandomBuffTiles25Percent);
    }

    // Sample layout buttons
    document.querySelectorAll('[data-sample]').forEach(btn => {
      btn.addEventListener('click', () => loadSampleLayout(btn.dataset.sample));
    });

    // Share & Export buttons
    const shareBtn = document.getElementById('simShareLinkBtn');
    if (shareBtn) shareBtn.addEventListener('click', copyShareLink);

    const pngBtn = document.getElementById('simExportPngBtn');
    if (pngBtn) pngBtn.addEventListener('click', exportBoardAsPNG);

    // Toggles & Undo/Clear
    const namesChk = document.getElementById('simShowNamesChk');
    if (namesChk) {
      namesChk.addEventListener('change', (e) => {
        state.showNames = e.target.checked;
        requestCanvasRender();
      });
    }
    const rangeChk = document.getElementById('simShowRangeChk');
    if (rangeChk) {
      rangeChk.addEventListener('change', (e) => {
        state.showRange = e.target.checked;
        requestCanvasRender();
      });
    }

    const undoBtn = document.getElementById('simUndoBtn');
    if (undoBtn) undoBtn.addEventListener('click', undo);

    const clearBtn = document.getElementById('simClearBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (!state.placedItems.length && !state.buffTiles.size) return;
        pushHistory();
        state.placedItems = [];
        state.buffTiles.clear();
        requestCanvasRender();
        renderSummaryBar();
      });
    }

    // Palette tabs
    document.querySelectorAll('[data-ptab]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.paletteTab = btn.dataset.ptab;
        if (state.paletteTab === 'obstacles') {
          const firstOb = (getSimMeta().obstacles || [])[0];
          if (firstOb) setToolFromObstacle(firstOb);
        } else {
          const firstTw = (getDB().towers || [])[0];
          if (firstTw) setToolFromTower(firstTw);
        }
        renderAll();
      });
    });

    // Tower search & filters
    const searchInput = document.getElementById('simTowerSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        state.towerSearch = e.target.value;
        renderPaletteOnly();
      });
    }
    document.querySelectorAll('[data-gfilter]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.towerGradeFilter = btn.dataset.gfilter;
        document.querySelectorAll('[data-gfilter]').forEach(b => b.classList.toggle('active', b === btn));
        renderPaletteOnly();
      });
    });
    document.querySelectorAll('[data-sfilter]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.towerSizeFilter = btn.dataset.sfilter;
        document.querySelectorAll('[data-sfilter]').forEach(b => b.classList.toggle('active', b === btn));
        renderPaletteOnly();
      });
    });

    // =====================================================================
    // Interactive 60fps HTML5 <canvas> Pointer Events (Click, Drag, Right-Click)
    // =====================================================================
    const canvas = document.getElementById('simBattleCanvas');
    if (canvas) {
      // Prevent browser context menu on right-click so right-click deletes towers smoothly
      canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
      });

      canvas.addEventListener('pointermove', (e) => {
        const activeFp = state.draggingItem
          ? { w: state.draggingItem.item.w, h: state.draggingItem.item.h }
          : getActiveFootprint();
        const coords = clientToBoardCoords(canvas, e.clientX, e.clientY, activeFp.w, activeFp.h);

        if (!coords.insideBoard) {
          if (state.hoverCell) {
            state.hoverCell = null;
            requestCanvasRender();
          }
          return;
        }

        const prev = state.hoverCell;
        state.hoverCell = coords;

        if (state.draggingItem) {
          if (coords.col !== state.draggingItem.startCol || coords.row !== state.draggingItem.startRow) {
            state.draggingItem.moved = true;
          }
          requestCanvasRender();
          return;
        }

        // Continuous drag-painting for Buff Tiles or Eraser
        if (state.isPainting) {
          if (state.paintMode === 'erase') {
            const hit = findItemAtCell(coords.rawCol, coords.rawRow);
            if (hit) {
              state.placedItems = state.placedItems.filter(x => x.uid !== hit.uid);
              renderSummaryBar();
            }
            state.buffTiles.delete(`${coords.rawCol},${coords.rawRow}`);
            requestCanvasRender();
            return;
          } else if (state.paintMode === 'add_buff' || state.paintMode === 'del_buff') {
            const { w, h } = getActiveFootprint();
            for (let dy = 0; dy < h; dy++) {
              for (let dx = 0; dx < w; dx++) {
                const k = `${coords.col + dx},${coords.row + dy}`;
                if (state.paintMode === 'add_buff') state.buffTiles.add(k);
                else state.buffTiles.delete(k);
              }
            }
            requestCanvasRender();
            renderSummaryBar();
            return;
          }
        }

        if (!prev || prev.col !== coords.col || prev.row !== coords.row || prev.rawCol !== coords.rawCol || prev.rawRow !== coords.rawRow) {
          requestCanvasRender();
        }
      });

      canvas.addEventListener('pointerleave', () => {
        state.hoverCell = null;
        state.isPainting = false;
        state.paintMode = null;
        requestCanvasRender();
      });

      canvas.addEventListener('pointerdown', (e) => {
        const activeFp = getActiveFootprint();
        const coords = clientToBoardCoords(canvas, e.clientX, e.clientY, activeFp.w, activeFp.h);
        if (!coords.insideBoard) return;
        state.hoverCell = coords;

        // Right-click (button === 2): instant delete of item or buff tile under cursor
        if (e.button === 2) {
          const hit = findItemAtCell(coords.rawCol, coords.rawRow);
          const buffKey = `${coords.rawCol},${coords.rawRow}`;
          if (hit || state.buffTiles.has(buffKey)) {
            pushHistory();
            if (hit) {
              state.placedItems = state.placedItems.filter(x => x.uid !== hit.uid);
            } else {
              state.buffTiles.delete(buffKey);
            }
            requestCanvasRender();
            renderSummaryBar();
          }
          return;
        }

        if (e.button !== 0) return;
        const tool = state.selectedTool;
        if (!tool) return;

        // 1. Eraser tool: start drag-erasing
        if (tool.type === 'eraser') {
          pushHistory();
          state.isPainting = true;
          state.paintMode = 'erase';
          const hit = findItemAtCell(coords.rawCol, coords.rawRow);
          if (hit) {
            state.placedItems = state.placedItems.filter(x => x.uid !== hit.uid);
          } else {
            state.buffTiles.delete(`${coords.rawCol},${coords.rawRow}`);
          }
          requestCanvasRender();
          renderSummaryBar();
          return;
        }

        // 2. Buff Tile tool: start drag-painting buff tiles
        if (tool.type === 'tile') {
          pushHistory();
          const { w, h } = activeFp;
          let allSet = true;
          for (let dy = 0; dy < h; dy++) {
            for (let dx = 0; dx < w; dx++) {
              if (!state.buffTiles.has(`${coords.col + dx},${coords.row + dy}`)) allSet = false;
            }
          }
          state.isPainting = true;
          state.paintMode = allSet ? 'del_buff' : 'add_buff';
          for (let dy = 0; dy < h; dy++) {
            for (let dx = 0; dx < w; dx++) {
              const k = `${coords.col + dx},${coords.row + dy}`;
              if (allSet) state.buffTiles.delete(k);
              else state.buffTiles.add(k);
            }
          }
          requestCanvasRender();
          renderSummaryBar();
          return;
        }

        // 3. Clicking on an ALREADY placed tower/obstacle:
        //    Start dragging it! If released without moving, remove it!
        const existingItem = findItemAtCell(coords.rawCol, coords.rawRow);
        if (existingItem) {
          state.draggingItem = {
            item: existingItem,
            startCol: existingItem.col,
            startRow: existingItem.row,
            moved: false,
          };
          const dragCoords = clientToBoardCoords(canvas, e.clientX, e.clientY, existingItem.w, existingItem.h);
          state.hoverCell = dragCoords;
          try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
          requestCanvasRender();
          return;
        }

        // 4. Clicking on an empty buildable area: place selected tower/obstacle immediately!
        if (!canPlaceAt(coords.col, coords.row, activeFp.w, activeFp.h, tool.type)) {
          showToast('해당 위치에는 배치할 수 없습니다 (본진/입구 또는 다른 타워와 겹침)');
          return;
        }

        pushHistory();
        state.placedItems.push({
          uid: state.uidCounter++,
          type: tool.type,
          id: tool.id,
          name: tool.name,
          grade: tool.grade || '',
          col: coords.col,
          row: coords.row,
          w: activeFp.w,
          h: activeFp.h,
          range: tool.range || 0,
          img: tool.img || '',
          boardImg: tool.boardImg || tool.img || '',
          symbol: tool.symbol || '',
          color: tool.color || '',
        });
        requestCanvasRender();
        renderSummaryBar();
      });

      canvas.addEventListener('pointerup', (e) => {
        if (state.draggingItem) {
          const { item, moved } = state.draggingItem;
          const dragCoords = clientToBoardCoords(canvas, e.clientX, e.clientY, item.w, item.h);
          state.draggingItem = null;
          try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}

          if (!moved) {
            // Simple click on an existing tower/obstacle -> remove it
            pushHistory();
            state.placedItems = state.placedItems.filter(x => x.uid !== item.uid);
            requestCanvasRender();
            renderSummaryBar();
          } else {
            // Dragged to a new tile -> move if valid!
            if (canPlaceAt(dragCoords.col, dragCoords.row, item.w, item.h, item.type, item.uid)) {
              pushHistory();
              item.col = dragCoords.col;
              item.row = dragCoords.row;
              requestCanvasRender();
              renderSummaryBar();
            } else {
              showToast('이동할 위치에 다른 오브젝트나 본진이 있어 원래 위치로 되돌아갑니다.');
              requestCanvasRender();
            }
          }
          return;
        }

        state.isPainting = false;
        state.paintMode = null;
      });
    }
  }

  // Resize listener to keep canvas crisp
  window.addEventListener('resize', () => {
    if (document.getElementById('simBattleCanvas')) {
      syncCanvasSize();
      requestCanvasRender();
    }
  });

  global.AraSimulatorV3 = {
    mount: function (containerEl) {
      const target = containerEl || document.getElementById('contentStage');
      if (target && !document.getElementById('simulatorMountRoot')) {
        target.innerHTML = '<div id="simulatorMountRoot"></div>';
      }
      renderAll();
    },
    checkUrlHashAndLoad: function () {
      const hash = window.location.hash || '';
      if (hash.startsWith('#sim=')) {
        const encoded = hash.slice(5);
        if (decodeShareState(encoded)) {
          return true;
        }
      }
      return false;
    },
    loadSampleLayout,
  };
})(window);
