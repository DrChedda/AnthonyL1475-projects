// map-handler.js
(function() {
    if (window.MapEngine?.destroy) {
        window.MapEngine.destroy();
    }

    const mapSurface = document.querySelector('.map-surface');
    const axisOverlay = document.querySelector('.axis-overlay');
    const coordOut = document.querySelector('[data-coordinate]');
    const axisV = document.querySelector('.axis-line--vertical');
    const axisH = document.querySelector('.axis-line--horizontal');
    const walls = document.querySelector('.walls-layer');

    if (!mapSurface || !axisOverlay) return;

    const borders = {
        left: document.querySelector('.border-line--left'),
        right: document.querySelector('.border-line--right'),
        top: document.querySelector('.border-line--top'),
        bottom: document.querySelector('.border-line--bottom')
    };

    const gridCanvas = Object.assign(document.createElement('canvas'), { className: 'grid-canvas' });
    Object.assign(gridCanvas.style, { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none' });
    axisOverlay.appendChild(gridCanvas);
    const gridCtx = gridCanvas.getContext('2d');

    let LIMIT = 1e9, centerX = 0, centerZ = 0, studsPerPixel = 10;
    let dragging = false, startX = 0, startY = 0, startCenterX = 0, startCenterZ = 0, isPending = false;
    let cachedRect = null;
    function getRect() {
        if (!cachedRect) cachedRect = mapSurface.getBoundingClientRect();
        return cachedRect;
    }

    const clamp = (val, min = -LIMIT, max = LIMIT) => Math.max(min, Math.min(max, val));

    const toWorld = (sX, sY, r) => ({
        z: clamp(Math.round(centerZ - ((sX - r.width * 0.5) * studsPerPixel))),
        x: clamp(Math.round(centerX + ((sY - r.height * 0.5) * studsPerPixel)))
    });

    function getSteps(rawStep) {
        let pwr = 1;
        let temp = rawStep;
        if (temp >= 1) {
            while (temp >= 10) { temp /= 10; pwr *= 10; }
        } else {
            while (temp < 1) { temp *= 10; pwr /= 10; }
        }
        const ratio = rawStep / pwr;
        const majorStep = pwr * (ratio >= 5 ? 5 : ratio >= 2 ? 2 : 1);
        return { majorStep, minorStep: majorStep / 5 };
    }

    function applyTransform() {
        if (isPending) return;
        isPending = true;
        requestAnimationFrame(() => {
            const rect = getRect();
            centerX = clamp(centerX);
            centerZ = clamp(centerZ);
            updateGrid(rect.width, rect.height);
            window.MapEngine?.onViewportChange?.();
            isPending = false;
        });
    }

    function setBorder(el, show, styles) {
        if (!el) return;
        el.style.display = show ? 'block' : 'none';
        if (show) Object.assign(el.style, styles);
    }

    function updateGrid(w, h) {
        if (gridCanvas.width !== w || gridCanvas.height !== h) {
            gridCanvas.width = w;
            gridCanvas.height = h;
        }
        gridCtx.clearRect(0, 0, w, h);

        const invSpp = 1 / studsPerPixel;
        const halfW = w * 0.5;
        const halfH = h * 0.5;
        const xOrigin = halfW + (centerZ * invSpp);
        const yOrigin = halfH - (centerX * invSpp);

        const toScreenX = z => xOrigin - (z * invSpp);
        const toScreenY = x => yOrigin + (x * invSpp);

        const bL = toScreenX(LIMIT), bR = toScreenX(-LIMIT);
        const bT = toScreenY(LIMIT), bB = toScreenY(-LIMIT);

        const cL = Math.max(0, bL), cR = Math.min(w, bR);
        const cT = Math.max(0, bB), cB = Math.min(h, bT);
        const bW = cR - cL, bH = cB - cT;

        const originX = toScreenX(0);
        const originY = toScreenY(0);

        if (axisV) setBorder(axisV, !(originX < bL || originX > bR || cT >= cB), { left: `${originX}px`, top: `${cT}px`, height: `${bH}px` });
        if (axisH) setBorder(axisH, !(originY < bB || originY > bT || cL >= cR), { top: `${originY}px`, left: `${cL}px`, width: `${bW}px` });

        setBorder(borders.left, bH > 0 && bL >= 0 && bL <= w, { left: `${bL}px`, top: `${cT}px`, width: '3px', height: `${bH}px`, transform: 'translateX(-50%)' });
        setBorder(borders.right, bH > 0 && bR >= 0 && bR <= w, { left: `${bR}px`, top: `${cT}px`, width: '3px', height: `${bH}px`, transform: 'translateX(-50%)' });
        setBorder(borders.top, bW > 0 && bT >= 0 && bT <= h, { left: `${cL}px`, top: `${bT}px`, width: `${bW}px`, height: '3px', transform: 'translateY(-50%)' });
        setBorder(borders.bottom, bW > 0 && bB >= 0 && bB <= h, { left: `${cL}px`, top: `${bB}px`, width: `${bW}px`, height: '3px', transform: 'translateY(-50%)' });

        const visStuds = w * studsPerPixel;
        if (walls) walls.classList.toggle('hidden', visStuds > 2e7);

        let majorStep, minorStep;
        if (visStuds >= 5e5 && visStuds <= 2e7) {
            majorStep = 1e6; minorStep = 2e5;
        } else {
            const steps = getSteps(120 * studsPerPixel);
            majorStep = steps.majorStep;
            minorStep = steps.minorStep;
        }

        const halfMinor = minorStep * 0.5;
        const minZ = centerZ - halfW * studsPerPixel;
        const maxZ = centerZ + halfW * studsPerPixel;
        const minX = centerX - halfH * studsPerPixel;
        const maxX = centerX + halfH * studsPerPixel;
        const startIdxZ = Math.floor((minZ - halfMinor) / minorStep);
        const endIdxZ = Math.ceil((maxZ - halfMinor) / minorStep);
        const startIdxX = Math.floor((minX - halfMinor) / minorStep);
        const endIdxX = Math.ceil((maxX - halfMinor) / minorStep);

        if ((endIdxZ - startIdxZ) > 500 || bH <= 0 || bW <= 0) return;

        const isMajorIndex = i => ((i - 2) % 5 + 5) % 5 === 0;

        // Single pass per axis: bucket each line into a minor/major Path2D
        // instead of re-scanning the whole index range twice (once per pass,
        // as the old two-pass version did). Halves the loop iterations for
        // the same picture.
        const minorPath = new Path2D();
        const majorPath = new Path2D();

        for (let i = startIdxZ; i <= endIdxZ; i++) {
            const z = (i + 0.5) * minorStep;
            if (Math.abs(z) > LIMIT) continue;

            const sX = toScreenX(z);
            if (sX < bL || sX > bR) continue;

            const path = isMajorIndex(i) ? majorPath : minorPath;
            path.moveTo(sX, cT);
            path.lineTo(sX, cB);
        }

        for (let i = startIdxX; i <= endIdxX; i++) {
            const x = (i + 0.5) * minorStep;
            if (Math.abs(x) > LIMIT) continue;

            const sY = toScreenY(x);
            if (sY < bB || sY > bT) continue;

            const path = isMajorIndex(i) ? majorPath : minorPath;
            path.moveTo(cL, sY);
            path.lineTo(cR, sY);
        }

        gridCtx.lineWidth = 1;
        gridCtx.strokeStyle = 'rgba(141, 129, 109, 0.08)';
        gridCtx.stroke(minorPath);

        gridCtx.lineWidth = 2;
        gridCtx.strokeStyle = 'rgba(141, 129, 109, 0.25)';
        gridCtx.stroke(majorPath);
    }

    function updateCoords(eX, eY) {
        if (!coordOut) return;
        const r = getRect();
        const { x, z } = toWorld(eX - r.left, eY - r.top, r);
        coordOut.textContent = `X ${Math.round(x).toLocaleString('en-US')}, Z ${Math.round(z).toLocaleString('en-US')}`;
    }

    const handleWheel = (e) => {
        e.preventDefault();
        const r = getRect();
        const target = toWorld(e.clientX - r.left, e.clientY - r.top, r);
        const zoomLimits = [window.MapEngine?.minStudsPerPixel || 0.05, window.MapEngine?.maxStudsPerPixel || 4e6];

        studsPerPixel = clamp(studsPerPixel * (e.deltaY < 0 ? 1 / 1.2 : 1.2), ...zoomLimits);
        centerZ = clamp(target.z + ((e.clientX - r.left - r.width * 0.5) * studsPerPixel));
        centerX = clamp(target.x - ((e.clientY - r.top - r.height * 0.5) * studsPerPixel));
        applyTransform();
    };

    const handlePointerDown = (e) => {
        if (e.button !== 0 || e.target.closest('.map-point-container, .ui-info-sidebar')) return;
        dragging = true;
        startX = e.clientX; startY = e.clientY;
        startCenterX = centerX; startCenterZ = centerZ;
        mapSurface.classList.add('dragging');
        mapSurface.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e) => {
        if (!dragging) return updateCoords(e.clientX, e.clientY);
        centerZ = clamp(startCenterZ + ((e.clientX - startX) * studsPerPixel));
        centerX = clamp(startCenterX - ((e.clientY - startY) * studsPerPixel));
        applyTransform();
        updateCoords(e.clientX, e.clientY);
    };

    const stopDrag = () => { dragging = false; mapSurface.classList.remove('dragging'); };
    const handlePointerLeave = () => !dragging && coordOut && (coordOut.textContent = "X -----, Z -----");

    mapSurface.addEventListener('wheel', handleWheel, { passive: false });
    mapSurface.addEventListener('pointerdown', handlePointerDown);
    mapSurface.addEventListener('pointermove', handlePointerMove);
    ['pointerup', 'pointercancel'].forEach(evt => mapSurface.addEventListener(evt, stopDrag));
    mapSurface.addEventListener('pointerleave', handlePointerLeave);

    // ResizeObserver instead of window 'resize': catches container-only
    // resizes (sidebar toggles, flex/grid reflow) that a window resize
    // listener would miss, and is the single place that invalidates the
    // cached rect from getRect().
    const resizeObserver = new ResizeObserver(() => {
        cachedRect = null;
        applyTransform();
    });
    resizeObserver.observe(mapSurface);

    const rect = getRect();
    studsPerPixel = 20000 / (Math.min(rect.width, rect.height) || 800);
    const initTimeout = setTimeout(applyTransform, 100);

    window.MapEngine = {
        applyTransform,
        setLimit: (l) => { LIMIT = l || 1e9; },
        get studsPerPixel() { return studsPerPixel; },
        set studsPerPixel(val) { studsPerPixel = val; },
        get centerCoords() { return { x: centerX, z: centerZ }; },
        set centerCoords({ x, z }) {
            if (x !== undefined) centerX = clamp(x);
            if (z !== undefined) centerZ = clamp(z);
        },
        get LIMIT() { return LIMIT; },
        destroy: () => {
            clearTimeout(initTimeout);
            resizeObserver.disconnect();
            mapSurface.removeEventListener('wheel', handleWheel);
            mapSurface.removeEventListener('pointerdown', handlePointerDown);
            mapSurface.removeEventListener('pointermove', handlePointerMove);
            ['pointerup', 'pointercancel'].forEach(evt => mapSurface.removeEventListener(evt, stopDrag));
            mapSurface.removeEventListener('pointerleave', handlePointerLeave);
            gridCanvas.remove();
        }
    };
})();