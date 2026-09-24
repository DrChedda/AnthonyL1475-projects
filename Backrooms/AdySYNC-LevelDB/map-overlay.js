// map-overlay.js
(function() {
    if (window.MapOverlay?.destroy) {
        window.MapOverlay.destroy();
    }

    const wallsLayer = document.querySelector('.walls-layer');
    const pointsLayer = document.querySelector('.points-layer');
    const coordTagEl = document.querySelector('.coord-level-tag');
    const labelsLayer = document.querySelector('.labels-layer');

    if (!wallsLayer) return;
    const LayerManager = (() => {
        const layers = new Map();

        function define(id, opts = {}) {
            layers.set(id, {
                name: opts.name || id,
                enabled: opts.enabled !== false,
                minVisStuds: opts.minVisStuds ?? 0,
                maxVisStuds: opts.maxVisStuds ?? Infinity,
            });
            return LayerManager;
        }

        function isVisible(id, visStuds) {
            const layer = layers.get(id) ?? layers.get('default');
            if (!layer) return true; // unknown id, no default defined -> fail open
            return layer.enabled && visStuds >= layer.minVisStuds && visStuds <= layer.maxVisStuds;
        }

        function setEnabled(id, enabled) {
            const layer = layers.get(id);
            if (layer) layer.enabled = enabled;
        }

        function toggle(id) {
            const layer = layers.get(id);
            if (layer) { layer.enabled = !layer.enabled; return layer.enabled; }
        }

        function has(id) { return layers.has(id); }

        function list() {
            return [...layers.entries()].map(([id, l]) => ({ id, ...l }));
        }

        return { define, isVisible, setEnabled, toggle, has, list };
    })();

    // Default layers — these reproduce your old behavior exactly, just
    // named and centralized instead of scattered across 4 conditionals.
    // Add/adjust/remove layers here; nothing else in the file needs to change.
    LayerManager
        .define('default',  { maxVisStuds: Infinity })       // always visible unless disabled
        .define('walls',    { maxVisStuds: Infinity })
        .define('overview', { maxVisStuds: Infinity })       // old: layer >= 2
        .define('regional', { maxVisStuds: 2e7 })            // old: layer >= 1
        .define('detail',   { maxVisStuds: 2e5 })            // old: layer 0 / undefined
        .define('sectors',  { maxVisStuds: 2e7 })
        .define('border',   { maxVisStuds: 2e7 })
        .define('grid',     { maxVisStuds: Infinity });

    // Backward-compat shim: old level JSON may still have numeric `layer`
    // values (0/1/2) on points instead of string ids. Map those onto the
    // new named layers so existing level data keeps working unchanged.
    const LEGACY_NUMERIC_LAYER = { 0: 'detail', 1: 'regional', 2: 'overview' };
    function resolveLayerId(rawLayer) {
        if (rawLayer == null) return 'default';
        if (typeof rawLayer === 'number') return LEGACY_NUMERIC_LAYER[rawLayer] ?? 'overview';
        return rawLayer; // already a string id
    }

    const canvas = Object.assign(document.createElement('canvas'), { className: 'walls-canvas' });
    Object.assign(canvas.style, { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none' });
    wallsLayer.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    let currentLevelData = null, wallData = [], pointsData = [], sectorNamesData = {}, isRenderPending = false;

    const columnLetterCache = new Map();
    const getColumnLetter = col => {
        if (columnLetterCache.has(col)) return columnLetterCache.get(col);

        if (columnLetterCache.size > 2000) columnLetterCache.clear();

        const sign = col < 0 ? '-' : '';
        let n = Math.abs(col), res = '';
        while (n >= 0) {
            res = String.fromCharCode((n % 26) + 65) + res;
            n = Math.floor(n / 26) - 1;
        }
        const val = sign + res;
        columnLetterCache.set(col, val);
        return val;
    };

    function getDynamicStep(spp) {
        const ideal = 160 * spp;
        if (!ideal || !isFinite(ideal)) return 1e6;
        const mag = Math.pow(10, Math.floor(Math.log10(ideal)));
        const r = ideal / mag;
        const step = mag * (r < 1.5 ? 1 : r < 3.5 ? 2 : r < 7.5 ? 5 : 10);
        return Math.max(100, step || 1e6);
    }

    function centerLevelData(data) {
        const items = [...(data.walls || []), ...(data.locations || [])].filter(Boolean);
        if (!items.length) return data;

        let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
        items.forEach(p => {
            if (p.x !== undefined) { if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x; }
            if (p.z !== undefined) { if (p.z < minZ) minZ = p.z; if (p.z > maxZ) maxZ = p.z; }
        });

        if (minX === Infinity) return data;
        const offX = (minX + maxX) * 0.5, offZ = (minZ + maxZ) * 0.5;

        ['walls', 'locations'].forEach(key => {
            if (data[key]) {
                data[key] = data[key].map(p => p ? { ...p, x: Math.round(p.x - offX), z: Math.round(p.z - offZ) } : null);
            }
        });
        return data;
    }

    function drawViewport() {
        if (!window.MapEngine) return;
        const { studsPerPixel: spp, centerCoords: c, LIMIT } = window.MapEngine;
        const rect = wallsLayer.parentElement.getBoundingClientRect();
        const w = rect.width, h = rect.height;

        if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }

        const sCX = w * 0.5;
        const sCY = h * 0.5;
        const invSpp = 1 / spp;
        const visStuds = w * spp;
        const halfVisW = (w * 0.5) * spp;
        const halfVisH = (h * 0.5) * spp;
        const minVisZ = c.z - halfVisW, maxVisZ = c.z + halfVisW;
        const minVisX = c.x - halfVisH, maxVisX = c.x + halfVisH;
        const toX = z => sCX - ((z - c.z) * invSpp);
        const toY = x => sCY + ((x - c.x) * invSpp);
        const inView = (x, y, pad = 0) => x >= -pad && x <= w + pad && y >= -pad && y <= h + pad;

        ctx.clearRect(0, 0, w, h);

        // Walls: each point can optionally carry its own `layer`; falls
        // back to the level-wide default (still 'walls' if unspecified).
        const wallsLevelLayer = currentLevelData?.wallsLayer || 'walls';
        if (wallData?.length > 0 && LayerManager.isVisible(wallsLevelLayer, visStuds)) {
            const wallWidth = 3;
            ctx.lineWidth = wallWidth;
            ctx.strokeStyle = '#4378c9';
            ctx.fillStyle = '#4378c9';

            const wallVisible = p => {
                if (!p || p.x === undefined || Math.abs(p.x) > LIMIT || Math.abs(p.z) > LIMIT) return false;
                return LayerManager.isVisible(resolveLayerId(p.layer ?? wallsLevelLayer), visStuds);
            };

            if (wallData.length === 1) {
                const p = wallData[0];
                if (wallVisible(p)) {
                    const posX = toX(p.z), posY = toY(p.x);
                    if (inView(posX, posY, wallWidth)) {
                        ctx.beginPath();
                        ctx.arc(posX, posY, wallWidth * 0.5, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            } else {
                ctx.beginPath();

                for (let i = 0, len = wallData.length; i < len; i++) {
                    const curr = wallData[i];
                    if (!wallVisible(curr)) continue;

                    const next = wallData[i + 1];
                    const prev = wallData[i - 1];
                    const p1X = toX(curr.z), p1Y = toY(curr.x);
                    const hasNext = wallVisible(next);
                    const hasPrev = wallVisible(prev);

                    if (!hasNext && !hasPrev) {
                        if (inView(p1X, p1Y, wallWidth)) {
                            ctx.moveTo(p1X + wallWidth * 0.5, p1Y);
                            ctx.arc(p1X, p1Y, wallWidth * 0.5, 0, Math.PI * 2);
                        }
                        continue;
                    }

                    if (hasNext) {
                        const p2X = toX(next.z), p2Y = toY(next.x);

                        if (Math.max(p1X, p2X) < 0 || Math.min(p1X, p2X) > w ||
                            Math.max(p1Y, p2Y) < 0 || Math.min(p1Y, p2Y) > h) continue;

                        ctx.moveTo(p1X, p1Y);
                        ctx.lineTo(p2X, p2Y);
                    }
                }

                ctx.stroke();
                ctx.fill();
            }
        }

        if (labelsLayer) {
            labelsLayer.querySelectorAll('.sector-title-label, .dynamic-axis-label').forEach(e => e.remove());

            const bBox = labelsLayer.querySelector('.map-boundary-box');
            if (bBox) {
                const border = currentLevelData?.worldBorder;
                const borderLayerId = currentLevelData?.borderLayer || 'border';
                if (border > 0 && LayerManager.isVisible(borderLayerId, visStuds)) {
                    const bL = toX(border), bR = toX(-border), bT = toY(-border), bB = toY(border);
                    Object.assign(bBox.style, { left: `${bL}px`, top: `${bT}px`, width: `${bR - bL}px`, height: `${bB - bT}px`, display: 'block' });
                } else bBox.style.display = 'none';
            }

            const sectorsLayerId = currentLevelData?.sectorsLayer || 'sectors';
            if (currentLevelData?.hasSectors && LayerManager.isVisible(sectorsLayerId, visStuds)) {
                const step = 1e6;
                const referenceSPP = 2000;
                const scale = Math.max(0.05, Math.min(5.0, referenceSPP * invSpp));
                const sR = Math.floor((minVisX + 5e5) / step), eR = Math.floor((maxVisX + 5e5) / step);
                const sC = Math.floor((minVisZ + 5e5) / step), eC = Math.floor((maxVisZ + 5e5) / step);

                if ((eR - sR) * (eC - sC) < 400) {
                    const frag = document.createDocumentFragment();
                    for (let r = sR; r <= eR; r++) {
                        for (let col = sC; col <= eC; col++) {
                            const wX = (r * step) - 5e5, wZ = (col * step) + 5e5;
                            if (Math.abs(wX) > LIMIT || Math.abs(wZ) > LIMIT) continue;

                            const posX = toX(wZ), posY = toY(wX);
                            if (inView(posX, posY, 100)) {
                                const secId = `${r}|${getColumnLetter(col)}`;
                                const lbl = document.createElement('div');
                                lbl.className = 'sector-title-label';
                                lbl.textContent = `Sector ${sectorNamesData[secId] ? sectorNamesData[secId] + ` ${secId}` : secId}`;

                                Object.assign(lbl.style, {
                                    position: 'absolute',
                                    left: `${posX}px`,
                                    top: `${posY}px`,
                                    transformOrigin: 'top left',
                                    transform: `scale(${scale}) translate(4px, 4px)`,
                                    pointerEvents: 'none'
                                });
                                frag.appendChild(lbl);
                            }
                        }
                    }
                    labelsLayer.appendChild(frag);
                }
            }

            const gridLayerId = 'grid';
            if (LayerManager.isVisible(gridLayerId, visStuds)) {
                const dynStep = getDynamicStep(spp), edge = 25;
                const aZ = toX(0), aX = toY(0);

                if (aZ > 0 && aZ < w) {
                    for (let xVal = Math.ceil((c.x - halfVisH) / dynStep) * dynStep; xVal <= Math.floor((c.x + halfVisH) / dynStep) * dynStep; xVal += dynStep) {
                        if (!xVal || Math.abs(xVal) > LIMIT) continue;
                        const posY = toY(xVal);
                        if (posY > edge && posY < h - edge) createLabel(`X ${xVal.toLocaleString()}`, aZ - 8, posY, 'translate(-100%, -50%)');
                    }
                }

                if (aX > 0 && aX < h) {
                    for (let zVal = Math.ceil((c.z - halfVisW) / dynStep) * dynStep; zVal <= Math.floor((c.z + halfVisW) / dynStep) * dynStep; zVal += dynStep) {
                        if (Math.abs(zVal) > LIMIT) continue;
                        const posX = toX(zVal);
                        if (posX > edge && posX < w - edge) {
                            createLabel(zVal === 0 ? "0" : `Z ${zVal.toLocaleString()}`, posX - (zVal === 0 ? 8 : 0), aX + 8, zVal === 0 ? 'translate(-100%, 0%)' : 'translateX(-50%)');
                        }
                    }
                }
            }
        }

        if (pointsLayer) {
            pointsLayer.textContent = '';
            if (pointsData?.length) {
                const frag = document.createDocumentFragment();
                pointsData.forEach(p => {
                    if (!p || p.x === undefined || Math.abs(p.x) > LIMIT || Math.abs(p.z) > LIMIT) return;
                    if (p.x < minVisX || p.x > maxVisX || p.z < minVisZ || p.z > maxVisZ) return;

                    const layerId = resolveLayerId(p.layer);
                    if (!LayerManager.isVisible(layerId, visStuds)) return;

                    const pX = toX(p.z), pY = toY(p.x);

                    const cont = document.createElement('div');
                    cont.className = 'map-point-container';
                    cont._pointData = p;
                    Object.assign(cont.style, { position: 'absolute', left: `${pX}px`, top: `${pY}px`, cursor: 'pointer', pointerEvents: 'auto' });

                    const marker = document.createElement('div');
                    marker.className = 'point-marker';
                    if (p.color) Object.assign(marker.style, { backgroundColor: p.color, boxShadow: `0 0 8px ${p.color}` });
                    cont.appendChild(marker);

                    if (p.name) {
                        const lbl = document.createElement('span');
                        lbl.className = 'point-label';
                        lbl.textContent = p.name;
                        cont.appendChild(lbl);
                    }

                    frag.appendChild(cont);
                });
                pointsLayer.appendChild(frag);
            }
        }
    }

    const handlePointClick = (e) => {
        const target = e.target.closest('.map-point-container');
        if (target && target._pointData) {
            e.stopPropagation();
            window.MapUI?.updateSidebar(target._pointData);
        }
    };

    if (pointsLayer) {
        pointsLayer.addEventListener('click', handlePointClick);
    }

    function createLabel(txt, x, y, transform) {
        const lbl = document.createElement('div');
        lbl.className = 'dynamic-axis-label';
        lbl.textContent = txt;
        Object.assign(lbl.style, { position: 'absolute', left: `${x}px`, top: `${y}px`, transform });
        labelsLayer.appendChild(lbl);
    }

    function renderActiveViewportContent() {
        if (isRenderPending) return;
        isRenderPending = true;
        requestAnimationFrame(() => { drawViewport(); isRenderPending = false; });
    }

    function loadLevel(levelNum = 0) {
        fetch(`./levelData/level-${levelNum}.json`)
            .then(res => res.ok ? res.json() : Promise.reject(`Level data missing for level-${levelNum}`))
            .then(data => {
                currentLevelData = data.autoCenter ? centerLevelData(data) : data;
                wallData = currentLevelData.walls || [];
                pointsData = currentLevelData.locations || [];
                sectorNamesData = currentLevelData.sectors || {};

                const levelId = currentLevelData.levelId || `Level-${levelNum}`;
                if (coordTagEl) coordTagEl.textContent = levelId;

                window.MapUI?.updateSidebar({
                    name: levelId,
                    description: currentLevelData.description || 'No level description provided.',
                    trelloUrl: currentLevelData.trelloUrl || null
                });

                if (window.MapEngine) {
                    const activeLimit = currentLevelData.limit || 1e9;

                    const mapRect = wallsLayer.parentElement.getBoundingClientRect();
                    const minDim = Math.min(mapRect.width, mapRect.height) || 800;

                    let maxWallDist = 0;
                    if (currentLevelData.walls?.length) {
                        currentLevelData.walls.forEach(w => {
                            if (w && w.x !== undefined && w.z !== undefined) {
                                maxWallDist = Math.max(maxWallDist, Math.abs(w.x), Math.abs(w.z));
                            }
                        });
                    }

                    const effectiveWallDist = Math.max(maxWallDist, 500);

                    window.MapEngine.maxStudsPerPixel = ((currentLevelData.mapSize || activeLimit) * 2.2) / minDim;
                    window.MapEngine.minStudsPerPixel = 0.05;
                    window.MapEngine.studsPerPixel = (effectiveWallDist * 2.4) / minDim;

                    window.MapEngine.centerCoords = { x: 0, z: 0 };
                    window.MapEngine.onViewportChange = renderActiveViewportContent;

                    window.MapEngine.setLimit(activeLimit);
                    window.MapEngine.applyTransform();
                }
            })
            .catch(err => {
                console.warn(err, "Defaulting to empty viewport.");
                wallData = []; pointsData = []; sectorNamesData = {};
                if (coordTagEl) coordTagEl.textContent = `Level-${levelNum}`;
                window.MapEngine?.applyTransform();
            });
    }

    loadLevel(0);

    window.MapOverlay = {
        loadLevel,
        layers: LayerManager, // e.g. MapOverlay.layers.setEnabled('sectors', false); renderActiveViewportContent();
        refresh: renderActiveViewportContent,
        destroy: () => {
            if (pointsLayer) pointsLayer.removeEventListener('click', handlePointClick);
            if (window.MapEngine) window.MapEngine.onViewportChange = null;
            canvas.remove();
        }
    };
})();