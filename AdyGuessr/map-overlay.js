// map-overlay.js
(function() {
    if (window.MapOverlay?.destroy) {
        window.MapOverlay.destroy();
    }

    const wallsLayer = document.querySelector('.walls-layer');
    const pointsLayer = document.querySelector('.points-layer');

    if (!wallsLayer) return;

    const canvas = Object.assign(document.createElement('canvas'), { className: 'walls-canvas' });
    Object.assign(canvas.style, { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none' });
    wallsLayer.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    let currentLevelData = null, wallData = [], pointsData = [], isRenderPending = false;

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
        const halfVisW = (w * 0.5) * spp;
        const halfVisH = (h * 0.5) * spp;
        const minVisZ = c.z - halfVisW, maxVisZ = c.z + halfVisW;
        const minVisX = c.x - halfVisH, maxVisX = c.x + halfVisH;
        const toX = z => sCX - ((z - c.z) * invSpp);
        const toY = x => sCY + ((x - c.x) * invSpp);
        const inView = (x, y, pad = 0) => x >= -pad && x <= w + pad && y >= -pad && y <= h + pad;

        ctx.clearRect(0, 0, w, h);

        if (wallData?.length > 0) {
            const wallWidth = 3;
            ctx.lineWidth = wallWidth;
            ctx.strokeStyle = '#4378c9';
            ctx.fillStyle = '#4378c9';

            const wallVisible = p => {
                if (!p || p.x === undefined || Math.abs(p.x) > LIMIT || Math.abs(p.z) > LIMIT) return false;
                return true;
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

        if (pointsLayer) {
            pointsLayer.textContent = '';
            if (pointsData?.length) {
                const frag = document.createDocumentFragment();
                pointsData.forEach(p => {
                    if (!p || p.x === undefined || Math.abs(p.x) > LIMIT || Math.abs(p.z) > LIMIT) return;
                    if (p.x < minVisX || p.x > maxVisX || p.z < minVisZ || p.z > maxVisZ) return;

                    const pX = toX(p.z), pY = toY(p.x);

                    const cont = document.createElement('div');
                    cont.className = `map-point-container${p.name === 'Beacon' ? ' map-point-container--visual' : ''}`;
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

    function renderActiveViewportContent() {
        if (isRenderPending) return;
        isRenderPending = true;
        requestAnimationFrame(() => {
            drawViewport();
            window.MapEngine?.onMapRender?.();
            isRenderPending = false;
        });
    }

    function loadLevel(levelNum = 0) {
        fetch(`config/level-0-map.json`)
            .then(res => res.ok ? res.json() : Promise.reject(`Level data missing for level-${levelNum}`))
            .then(data => {
                currentLevelData = data.autoCenter ? centerLevelData(data) : data;
                wallData = currentLevelData.walls || [];
                pointsData = currentLevelData.locations || [];
                if (window.MapEngine) {
                    const activeLimit = currentLevelData.limit || 1e9;
                    const mapLimit = Math.min(activeLimit, 15000);

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

                    window.MapEngine.maxStudsPerPixel = (Math.min(currentLevelData.mapSize || mapLimit, mapLimit) * 2.2) / minDim;
                    window.MapEngine.minStudsPerPixel = 0.05;
                    window.MapEngine.studsPerPixel = (effectiveWallDist * 2.4) / minDim;

                    window.MapEngine.centerCoords = { x: 0, z: 0 };
                    window.MapEngine.onViewportChange = renderActiveViewportContent;

                    window.MapEngine.setLimit(mapLimit);
                    window.MapEngine.applyTransform();
                }
            })
            .catch(err => {
                console.warn(err, "Defaulting to empty viewport.");
                wallData = []; pointsData = [];
                window.MapEngine?.applyTransform();
            });
    }

    loadLevel(0);

    window.MapOverlay = {
        loadLevel,
        refresh: renderActiveViewportContent,
        destroy: () => {
            if (window.MapEngine) window.MapEngine.onViewportChange = null;
            canvas.remove();
        }
    };
})();