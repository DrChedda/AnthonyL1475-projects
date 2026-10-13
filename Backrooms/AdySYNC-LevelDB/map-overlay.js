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
    const config = window.MapConfig;
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
            if (!layer) return true;
            return layer.enabled && visStuds >= layer.minVisStuds && visStuds <= layer.maxVisStuds;
        }

        function setEnabled(id, enabled) {
            const layer = layers.get(id);
            if (!layer || layer.enabled === enabled) return;
            layer.enabled = enabled;
            renderActiveViewportContent();
        }

        function toggle(id) {
            const layer = layers.get(id);
            if (!layer) return;
            layer.enabled = !layer.enabled;
            renderActiveViewportContent();
            return layer.enabled;
        }

        function has(id) { return layers.has(id); }

        function list() {
            return [...layers.entries()].map(([id, l]) => ({ id, ...l }));
        }

        return { define, isVisible, setEnabled, toggle, has, list };
    })();

    config.layers.visibility.forEach(layer => LayerManager.define(layer.id, layer));

    function resolveLayerId(rawLayer) {
        if (rawLayer == null) return 'default';
        if (typeof rawLayer === 'number') return config.layers.legacyNumericIds[rawLayer] ?? 'overview';
        return rawLayer;
    }

    const canvas = Object.assign(document.createElement('canvas'), { className: 'walls-canvas' });
    Object.assign(canvas.style, { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none' });
    wallsLayer.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    let currentLevelData = null, wallData = [], pointsData = [], sourcePointsData = [], pointElements = [], sectorNamesData = {}, isRenderPending = false, levelLoadVersion = 0;
    let wallsVisible = true, locationsVisible = true;
    const warnedWallColors = new Set();
    const renderedLabels = new Map();
    const markerShapes = new Set(config.rendering.markerShapes);

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
        const ideal = config.grid.dynamicLabelTargetPixels * spp;
        if (!ideal || !isFinite(ideal)) return 1e6;
        const mag = Math.pow(10, Math.floor(Math.log10(ideal)));
        const r = ideal / mag;
        const step = mag * (r < 1.5 ? 1 : r < 3.5 ? 2 : r < 7.5 ? 5 : 10);
        return Math.max(100, step || 1e6);
    }

    function getWallCenter(data) {
        const walls = (data.walls || []).filter(point =>
            point && Number.isFinite(point.x) && Number.isFinite(point.z)
        );
        if (!walls.length) return { x: 0, z: 0 };

        const bounds = walls.reduce((result, point) => ({
            minX: Math.min(result.minX, point.x),
            maxX: Math.max(result.maxX, point.x),
            minZ: Math.min(result.minZ, point.z),
            maxZ: Math.max(result.maxZ, point.z)
        }), {
            minX: Infinity,
            maxX: -Infinity,
            minZ: Infinity,
            maxZ: -Infinity
        });

        return {
            x: (bounds.minX + bounds.maxX) * 0.5,
            z: (bounds.minZ + bounds.maxZ) * 0.5
        };
    }

    function drawViewport() {
        if (!window.MapEngine) return;
        const { coordinateOffset, LIMIT } = window.MapEngine;
        const rect = wallsLayer.parentElement.getBoundingClientRect();
        const viewport = window.MapEngine.getViewport();
        const { width: w, height: h, centerCoords: c, bounds, studsPerPixel: spp, visibleStuds: visStuds } = viewport;
        const { minX: minVisX, maxX: maxVisX, minZ: minVisZ, maxZ: maxVisZ } = bounds;

        const canvasWidth = Math.round(w), canvasHeight = Math.round(h);
        if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
        }

        const toX = x => viewport.worldToScreen({ x, z: c.z }).x;
        const toY = z => viewport.worldToScreen({ x: c.x, z }).y;
        const inView = (x, y, pad = 0) => x >= -pad && x <= w + pad && y >= -pad && y <= h + pad;

        ctx.clearRect(0, 0, w, h);

        const wallsLevelLayer = currentLevelData?.wallsLayer || 'walls';
        if (wallsVisible && wallData?.length > 0 && LayerManager.isVisible(wallsLevelLayer, visStuds)) {
            const wallWidth = config.rendering.wallWidth;
            ctx.lineWidth = wallWidth;
            ctx.lineCap = config.rendering.wallLineCap;
            ctx.lineJoin = config.rendering.wallLineJoin;
            const defaultWallColor = config.rendering.defaultWallColor;

            const wallVisible = p => {
                if (!p || p.x == null || p.z == null || Math.abs(p.x) > LIMIT || Math.abs(p.z) > LIMIT) return false;
                return LayerManager.isVisible(resolveLayerId(p.layer ?? wallsLevelLayer), visStuds);
            };

            const resolveWallColor = color => {
                if (typeof color !== 'string') return defaultWallColor;
                if (CSS.supports('color', color)) return color;
                if (!warnedWallColors.has(color)) {
                    console.warn(`Ignoring invalid wall color: ${color}`);
                    warnedWallColors.add(color);
                    window.PopupNotification?.show(`Ignoring invalid wall color: ${color}`, { type: 'warning' });
                }
                return defaultWallColor;
            };

            const wallSegments = [[]];
            let currentWallColor = defaultWallColor;
            for (const point of wallData) {
                if (point === null) {
                    if (wallSegments[wallSegments.length - 1].length) wallSegments.push([]);
                    continue;
                }

                if (point && typeof point.color === 'string') {
                    currentWallColor = resolveWallColor(point.color);
                    if (point.x == null || point.z == null) continue;
                }
                wallSegments[wallSegments.length - 1].push({ point, color: currentWallColor });
            }

            const pathsByColor = new Map();
            const getPath = color => {
                if (!pathsByColor.has(color)) pathsByColor.set(color, new Path2D());
                return pathsByColor.get(color);
            };

            for (const segment of wallSegments) {
                for (let i = 0; i < segment.length; i++) {
                    const curr = segment[i];
                    if (!wallVisible(curr.point)) continue;

                    const prev = segment[i - 1];
                    const next = segment[i + 1];
                    const hasPrev = prev && wallVisible(prev.point);
                    const hasNext = next && wallVisible(next.point);
                    const p1X = toX(curr.point.x), p1Y = toY(curr.point.z);
                    const path = getPath(curr.color);

                    if (!hasNext && !hasPrev && inView(p1X, p1Y, wallWidth)) {
                        path.moveTo(p1X + wallWidth * 0.5, p1Y);
                        path.arc(p1X, p1Y, wallWidth * 0.5, 0, Math.PI * 2);
                    }

                    if (hasNext) {
                        const p2X = toX(next.point.x), p2Y = toY(next.point.z);
                        if (Math.max(p1X, p2X) < 0 || Math.min(p1X, p2X) > w ||
                            Math.max(p1Y, p2Y) < 0 || Math.min(p1Y, p2Y) > h) continue;

                        getPath(curr.color).moveTo(p1X, p1Y);
                        getPath(curr.color).lineTo(p2X, p2Y);
                    }
                }
            }

            for (const [color, path] of pathsByColor) {
                ctx.strokeStyle = color;
                ctx.fillStyle = color;
                ctx.stroke(path);
                ctx.fill(path);
            }
        }

        const activeLabelKeys = new Set();
        if (labelsLayer) {

            const bBox = labelsLayer.querySelector('.map-boundary-box');
            if (bBox) {
                const border = currentLevelData?.worldBorder;
                const borderLayerId = currentLevelData?.borderLayer || 'border';
                if (border > 0 && LayerManager.isVisible(borderLayerId, visStuds)) {
                    const bL = toX(-border), bR = toX(border), bT = toY(-border), bB = toY(border);
                    Object.assign(bBox.style, { left: `${bL}px`, top: `${bT}px`, width: `${bR - bL}px`, height: `${bB - bT}px`, display: 'block' });
                } else bBox.style.display = 'none';
            }

            const sectorsLayerId = currentLevelData?.sectorsLayer || 'sectors';
            const inSectorView = visStuds >= config.grid.sectorViewMinStuds &&
                visStuds <= config.grid.sectorViewMaxStuds;
            if (currentLevelData?.hasSectors && inSectorView && LayerManager.isVisible(sectorsLayerId, visStuds)) {
                const step = config.grid.sectorSize;
                const halfStep = step * 0.5;
                const sR = Math.floor((minVisZ + halfStep) / step), eR = Math.floor((maxVisZ + halfStep) / step);
                const sC = Math.floor((minVisX + halfStep) / step), eC = Math.floor((maxVisX + halfStep) / step);

                const sectorCount = (eR - sR + 1) * (eC - sC + 1);
                if (sectorCount <= config.grid.maxVisibleSectors) {
                    for (let r = sR; r <= eR; r++) {
                        for (let col = sC; col <= eC; col++) {
                            const wZ = (r * step) - halfStep;
                            const wX = (col * step) - halfStep;
                            if (Math.abs(wX) > LIMIT || Math.abs(wZ) > LIMIT) continue;

                            const posX = toX(wX), posY = toY(wZ);
                            if (inView(posX, posY, 100)) {
                                const secId = `${r}|${getColumnLetter(col)}`;
                                const legacySecId = `${col}|${getColumnLetter(r)}`;
                                const sectorName = sectorNamesData[secId] || sectorNamesData[legacySecId];
                                const key = `sector:${secId}`;
                                const lbl = getRenderedLabel(key, 'dynamic-axis-label sector-title-label');
                                activeLabelKeys.add(key);
                                lbl.textContent = `${sectorName ? `${sectorName} Sector` : 'Sector'} ${secId}`;

                                Object.assign(lbl.style, {
                                    left: `${posX}px`,
                                    top: `${posY}px`,
                                    transform: 'translate(4px, 4px)'
                                });
                            }
                        }
                    }
                }
            }

            const gridLayerId = 'grid';
            if (LayerManager.isVisible(gridLayerId, visStuds)) {
                const dynStep = getDynamicStep(spp), edge = config.grid.labelEdgePadding;
                const aX = toX(0), aZ = toY(0);
                const axisZ = Math.max(0, Math.min(aX, w));
                const axisX = Math.max(0, Math.min(aZ, h));
                const xLabelsGoDown = aZ <= 0;
                const zLabelsGoRight = aX <= 0;

                if (w > 0 && h > 0) {
                    for (let xVal = Math.ceil(minVisX / dynStep) * dynStep; xVal <= Math.floor(maxVisX / dynStep) * dynStep; xVal += dynStep) {
                        if (Math.abs(xVal) > LIMIT) continue;
                        const posX = toX(xVal);
                        if (posX > edge && posX < w - edge) {
                            const key = `axis:x:${xVal}`;
                            activeLabelKeys.add(key);
                            const displayX = Math.round(xVal + coordinateOffset.x);
                            createLabel(
                                key,
                                `X ${displayX.toLocaleString()}`,
                                posX,
                                axisX + (xLabelsGoDown ? 8 : -8),
                                xLabelsGoDown ? 'translate(-50%, 0)' : 'translate(-50%, -100%)'
                            );
                        }
                    }
                }

                if (w > 0 && h > 0) {
                    for (let zVal = Math.ceil(minVisZ / dynStep) * dynStep; zVal <= Math.floor(maxVisZ / dynStep) * dynStep; zVal += dynStep) {
                        if (Math.abs(zVal) > LIMIT) continue;
                        const posY = toY(zVal);
                        if (posY > edge && posY < h - edge) {
                            const key = `axis:z:${zVal}`;
                            activeLabelKeys.add(key);
                            const displayZ = Math.round(zVal + coordinateOffset.z);
                            createLabel(
                                key,
                                `Z ${displayZ.toLocaleString()}`,
                                axisZ + (zLabelsGoRight ? 8 : -8),
                                posY,
                                zLabelsGoRight ? 'translate(0, -50%)' : 'translate(-100%, -50%)'
                            );
                        }
                    }
                }
            }
        }

        if (pointsLayer && locationsVisible) {
            const visibleLabels = [];
            pointElements.forEach(({ point, layerId, container, label }) => {
                if (point.x == null || point.z == null ||
                    Math.abs(point.x) > LIMIT || Math.abs(point.z) > LIMIT ||
                    point.x < minVisX || point.x > maxVisX ||
                    point.z < minVisZ || point.z > maxVisZ ||
                    !LayerManager.isVisible(layerId, visStuds)) {
                    container.style.display = 'none';
                    return;
                }

                const pointX = toX(point.x);
                const pointY = toY(point.z);
                container.style.display = '';
                container.style.left = `${pointX}px`;
                container.style.top = `${pointY}px`;
                if (label) visibleLabels.push({ container, label, pointX, pointY });
            });
            const centerlineLabelRects = [];
            renderedLabels.forEach((label, key) => {
                if (!activeLabelKeys.has(key) || !key.startsWith('axis:')) return;
                const labelRect = label.getBoundingClientRect();
                centerlineLabelRects.push({
                    left: labelRect.left - rect.left,
                    top: labelRect.top - rect.top,
                    right: labelRect.right - rect.left,
                    bottom: labelRect.bottom - rect.top
                });
            });
            resolvePointLabelCollisions(visibleLabels, centerlineLabelRects);
        }

        renderedLabels.forEach((label, key) => {
            if (activeLabelKeys.has(key)) return;
            label.remove();
            renderedLabels.delete(key);
        });
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

    function getRenderedLabel(key, className) {
        let lbl = renderedLabels.get(key);
        if (!lbl) {
            lbl = document.createElement('div');
            lbl.className = className;
            lbl.style.position = 'absolute';
            renderedLabels.set(key, lbl);
            labelsLayer.appendChild(lbl);
        }
        return lbl;
    }

    function createLabel(key, txt, x, y, transform) {
        const lbl = getRenderedLabel(key, 'dynamic-axis-label');
        lbl.textContent = txt;
        Object.assign(lbl.style, { left: `${x}px`, top: `${y}px`, transform });
    }

    const labelPlacements = [
        { align: 'center', side: 'below' },
        { align: 'center', side: 'above' },
        { align: 'right', side: 'right' },
        { align: 'left', side: 'left' },
        { align: 'right', side: 'below' },
        { align: 'left', side: 'below' },
        { align: 'right', side: 'above' },
        { align: 'left', side: 'above' }
    ];
    const labelGap = 7;

    const circleIntersectsRect = (cx, cy, radius, left, top, right, bottom) => {
        const nearestX = Math.max(left, Math.min(cx, right));
        const nearestY = Math.max(top, Math.min(cy, bottom));
        const dx = cx - nearestX;
        const dy = cy - nearestY;
        return (dx * dx) + (dy * dy) < (radius * radius);
    };

    const rectsOverlap = (leftA, topA, rightA, bottomA, leftB, topB, rightB, bottomB) =>
        leftA < rightB && rightA > leftB && topA < bottomB && bottomA > topB;

    function resolvePointLabelCollisions(entries, obstacles) {
        const placedLabels = [];
        entries.forEach(entry => {
            entry.width = entry.label.offsetWidth || 64;
            entry.height = entry.label.offsetHeight || 14;
            entry.label._labelOffsetX = 0;
            entry.label._labelOffsetY = 0;
        });

        entries.forEach(entry => {
            let chosen = null;

            for (const placement of labelPlacements) {
                const offsetX = placement.side === 'right'
                    ? labelGap
                    : placement.side === 'left'
                        ? -labelGap - entry.width
                        : placement.align === 'left'
                            ? -entry.width
                            : placement.align === 'right'
                                ? 0
                                : -entry.width * 0.5;
                const offsetY = placement.side === 'above'
                    ? -entry.height - labelGap
                    : placement.side === 'right' || placement.side === 'left'
                        ? -entry.height * 0.5
                        : labelGap;
                const boxLeft = entry.pointX + offsetX;
                const boxRight = boxLeft + entry.width;
                const boxTop = entry.pointY + offsetY;
                const boxBottom = boxTop + entry.height;

                let collides = false;

                if (circleIntersectsRect(entry.pointX, entry.pointY, 5, boxLeft, boxTop, boxRight, boxBottom)) {
                    collides = true;
                }

                if (obstacles.some(obstacle =>
                    rectsOverlap(boxLeft, boxTop, boxRight, boxBottom, obstacle.left, obstacle.top, obstacle.right, obstacle.bottom)
                )) {
                    collides = true;
                }

                for (const other of entries) {
                    if (circleIntersectsRect(other.pointX, other.pointY, 5, boxLeft, boxTop, boxRight, boxBottom)) {
                        collides = true;
                        break;
                    }
                }

                if (!collides && placedLabels.some(other =>
                    rectsOverlap(boxLeft, boxTop, boxRight, boxBottom, other.left, other.top, other.right, other.bottom)
                )) {
                    collides = true;
                }

                if (!collides) {
                    chosen = { x: offsetX, y: offsetY };
                    placedLabels.push({
                        left: boxLeft,
                        top: boxTop,
                        right: boxRight,
                        bottom: boxBottom
                    });
                    break;
                }
            }

            if (!chosen) {
                chosen = { x: 0, y: labelGap };
                placedLabels.push({
                    left: entry.pointX,
                    top: entry.pointY + labelGap,
                    right: entry.pointX + entry.width,
                    bottom: entry.pointY + labelGap + entry.height
                });
            }
            entry.label._labelOffsetX = chosen.x;
            entry.label._labelOffsetY = chosen.y;
            entry.label.style.transform = `translate(${chosen.x}px, ${chosen.y}px)`;
        });
    }

    function renderActiveViewportContent() {
        if (isRenderPending) return;
        isRenderPending = true;
        requestAnimationFrame(() => {
            try {
                drawViewport();
            } finally {
                isRenderPending = false;
            }
        });
    }

    function buildPointElements() {
        if (!pointsLayer) return;

        const fragment = document.createDocumentFragment();
        pointElements = [];

        pointsData.forEach((point, index) => {
            if (!point || point.x == null || point.z == null) return;

            const sourcePoint = sourcePointsData[index] || point;
            const container = document.createElement('div');
            container.className = 'map-point-container';
            container._pointData = sourcePoint;
            Object.assign(container.style, {
                position: 'absolute',
                cursor: 'pointer',
                pointerEvents: 'auto',
                display: 'none'
            });

            const marker = document.createElement('div');
            marker.className = 'point-marker';
            const shape = markerShapes.has(point.shape) ? point.shape : 'circle';
            marker.setAttribute('data-shape', shape);
            if (point.color) {
                marker.style.backgroundColor = point.color;
            }
            container.appendChild(marker);

            let label = null;
            if (point.name) {
                label = document.createElement('span');
                label.className = 'point-label';
                label.textContent = point.name;
                container.appendChild(label);
            }

            pointElements.push({ point, sourcePoint, layerId: resolveLayerId(point.layer), container, label });
            fragment.appendChild(container);
        });

        pointsLayer.replaceChildren(fragment);
    }

    function loadLevel(levelNum = config.levels.initialId) {
        const requestVersion = ++levelLoadVersion;
        const levelFile = `levelData/level-${levelNum}.json`;
        fetch(`./${levelFile}`)
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then(data => {
                if (requestVersion !== levelLoadVersion) return;
                currentLevelData = data;
                const coordinateOffset = currentLevelData.autoCenter
                    ? getWallCenter(currentLevelData)
                    : { x: 0, z: 0 };
                wallData = (currentLevelData.walls || []).map(point =>
                    point && Number.isFinite(point.x) && Number.isFinite(point.z)
                        ? { ...point, x: point.x - coordinateOffset.x, z: point.z - coordinateOffset.z }
                        : point
                );
                sourcePointsData = currentLevelData.locations || [];
                pointsData = sourcePointsData.map(point =>
                    point && Number.isFinite(point.x) && Number.isFinite(point.z)
                        ? { ...point, x: point.x - coordinateOffset.x, z: point.z - coordinateOffset.z }
                        : point
                );
                sectorNamesData = currentLevelData.sectors || {};
                buildPointElements();

                const levelId = currentLevelData.levelId || `Level-${levelNum}`;
                if (coordTagEl) coordTagEl.textContent = levelId;

                window.MapUI?.updateSidebar({
                    name: levelId,
                    description: currentLevelData.description || 'No level description provided.',
                    trelloUrl: currentLevelData.trelloUrl || null
                });

                if (window.MapEngine) {
                    const activeLimit = currentLevelData.limit || config.map.defaultLimit;

                    const mapRect = wallsLayer.parentElement.getBoundingClientRect();
                    const minDim = Math.min(mapRect.width, mapRect.height) || config.map.fallbackViewportSize;

                    let maxWallDist = 0;
                    if (currentLevelData.walls?.length) {
                        currentLevelData.walls.forEach(w => {
                            if (w && w.x !== undefined && w.z !== undefined) {
                                maxWallDist = Math.max(
                                    maxWallDist,
                                    Math.abs(w.x - coordinateOffset.x),
                                    Math.abs(w.z - coordinateOffset.z)
                                );
                            }
                        });
                    }

                    const effectiveWallDist = Math.max(maxWallDist, config.map.minimumWallDistance);

                    window.MapEngine.maxStudsPerPixel = ((currentLevelData.mapSize || activeLimit) * config.map.maximumZoomPadding) / minDim;
                    window.MapEngine.minStudsPerPixel = config.map.minStudsPerPixel;
                    window.MapEngine.studsPerPixel = (effectiveWallDist * config.map.initialZoomPadding) / minDim;

                    window.MapEngine.onViewportChange = renderActiveViewportContent;

                    const absoluteLimit = currentLevelData.autoCenter
                        ? [...wallData, ...pointsData].reduce((limit, point) => {
                            if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.z)) return limit;
                            return Math.max(limit, Math.abs(point.x), Math.abs(point.z));
                        }, activeLimit)
                        : activeLimit;

                    window.MapEngine.setLimit(absoluteLimit);
                    window.MapEngine.coordinateOffset = coordinateOffset;
                    window.MapEngine.centerCoords = { x: 0, z: 0 };
                    window.MapEngine.applyTransform();
                }
            })
            .catch(err => {
                if (requestVersion !== levelLoadVersion) return;
                console.warn(err, "Defaulting to empty viewport.");
                const reason = err instanceof Error ? err.message : String(err);
                window.PopupNotification?.show(`Could not load "${levelFile}": ${reason}`, { type: 'error' });
                currentLevelData = null;
                wallData = []; pointsData = []; sourcePointsData = []; sectorNamesData = {};
                buildPointElements();
                if (window.MapEngine) {
                    window.MapEngine.coordinateOffset = { x: 0, z: 0 };
                    window.MapEngine.centerCoords = { x: 0, z: 0 };
                    window.MapEngine.setLimit(config.map.defaultLimit);
                }
                if (coordTagEl) coordTagEl.textContent = `Level-${levelNum}`;
                window.MapEngine?.applyTransform();
            });
    }

    loadLevel(config.levels.initialId);

    window.MapOverlay = {
        loadLevel,
        layers: LayerManager,
        refresh: renderActiveViewportContent,
        setWallsVisible(visible) {
            wallsVisible = visible;
            renderActiveViewportContent();
        },
        setLocationsVisible(visible) {
            locationsVisible = visible;
            if (pointsLayer) pointsLayer.style.display = visible ? '' : 'none';
            renderActiveViewportContent();
        },
        destroy: () => {
            levelLoadVersion++;
            if (pointsLayer) pointsLayer.removeEventListener('click', handlePointClick);
            if (window.MapEngine) window.MapEngine.onViewportChange = null;
            renderedLabels.forEach(label => label.remove());
            renderedLabels.clear();
            canvas.remove();
        }
    };
})();