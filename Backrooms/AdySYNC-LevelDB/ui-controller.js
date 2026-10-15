// ui-controller.js
(function() {
    if (window.MapUI?.destroy) {
        window.MapUI.destroy();
    }

    const { available: availableLevels, initialId } = window.MapConfig.levels;

    const sidebar = document.querySelector('.sidebar');
    const levelGroupContainer = document.querySelector('.level-btn-group');
    const mapControls = document.querySelector('.map-controls');
    const fullscreenButton = mapControls?.querySelector('[data-map-control="fullscreen"]');

    function getLevelIdFromHash() {
        const hash = window.location.hash.replace(/^#/, '').trim();
        const match = hash.match(/^level-(.+)$/i);
        return match ? decodeURIComponent(match[1]) : null;
    }

    function syncHashWithLevel(levelId) {
        const nextHash = `#level-${levelId}`;
        if (window.location.hash !== nextHash) {
            window.history.replaceState(null, '', nextHash);
        }
    }

    function resolveLevelId(levelId) {
        const candidate = typeof levelId === 'string' ? levelId.trim() : '';
        return availableLevels.some((lvl) => lvl.id === candidate) ? candidate : initialId;
    }

    let currentActiveLevel = resolveLevelId(getLevelIdFromHash() || initialId);

    function updateFullscreenButton() {
        if (!fullscreenButton) return;
        fullscreenButton.textContent = document.fullscreenElement ? 'Exit Fullscreen' : 'Fullscreen';
    }

    const handleLevelWheel = (e) => {
        if (e.deltaY === 0 || !levelGroupContainer) return;
        e.preventDefault();
        levelGroupContainer.scrollLeft += e.deltaY;
    };

    const handleMapControlClick = async (e) => {
        const button = e.target.closest('[data-map-control]');
        if (!button) return;

        const control = button.getAttribute('data-map-control');
        if (control === 'walls' || control === 'locations') {
            const enabled = button.getAttribute('aria-pressed') !== 'true';
            button.setAttribute('aria-pressed', String(enabled));
            if (control === 'walls') window.MapOverlay?.setWallsVisible(enabled);
            else window.MapOverlay?.setLocationsVisible(enabled);
            return;
        }

        if (control === 'fullscreen') {
            try {
                if (document.fullscreenElement) await document.exitFullscreen();
                else await document.documentElement.requestFullscreen();
            } catch (error) {
                console.error('Could not toggle map fullscreen mode.', error);
                window.PopupNotification?.show('Could not toggle map fullscreen mode.', { type: 'error' });
            }
        }
    };

    function updateSidebar(data) {
        if (!sidebar) return;

        const titleEl = sidebar.querySelector('.sidebar-title-text');
        const descEl = sidebar.querySelector('.sidebar-desc');
        const trelloContainer = sidebar.querySelector('.sidebar-trello-wrapper');
        const coordinateEl = sidebar.querySelector('.sidebar-coordinate-readout');

        if (titleEl) titleEl.textContent = data.name || 'Unknown Location';
        if (descEl) descEl.textContent = data.description || 'No description provided.';
        if (coordinateEl) {
            const hasCoordinates = data.x != null && data.z != null &&
                Number.isFinite(Number(data.x)) && Number.isFinite(Number(data.z));
            coordinateEl.hidden = !hasCoordinates;
            coordinateEl.textContent = hasCoordinates
                ? `${Number(data.x).toLocaleString('en-US')} X, ${Number(data.z).toLocaleString('en-US')} Z`
                : '';
            coordinateEl.title = 'Click to copy coordinates';
        }

        if (trelloContainer) {
            while (trelloContainer.firstChild) {
                trelloContainer.removeChild(trelloContainer.firstChild);
            }

            if (data.trelloUrl) {
                const quote = document.createElement('blockquote');
                quote.className = 'trello-card';

                const link = document.createElement('a');
                link.href = data.trelloUrl;
                link.textContent = 'Trello Card';

                quote.appendChild(link);
                trelloContainer.appendChild(quote);

                if (window.TrelloCards) {
                    window.TrelloCards.load(trelloContainer);
                }
            }
        }
    }

    function renderLevelButtons() {
        if (!levelGroupContainer) return;

        levelGroupContainer.innerHTML = '';

        const frag = document.createDocumentFragment();

        availableLevels.forEach((lvl) => {
            const btn = document.createElement('button');
            const isActive = lvl.id === currentActiveLevel;
            const isSublevel = Boolean(lvl.parent);

            btn.className = `ui-level-btn ${isActive ? 'active' : ''} ${isSublevel ? 'sub-level-btn' : ''}`;
            btn.setAttribute('data-level', lvl.id);
            btn.textContent = lvl.label;

            frag.appendChild(btn);
        });

        levelGroupContainer.appendChild(frag);
    }

    const handleContainerClick = (e) => {
        const btn = e.target.closest('.ui-level-btn');
        if (!btn) return;

        const levelId = resolveLevelId(btn.getAttribute('data-level'));
        if (!levelId || levelId === currentActiveLevel) return;

        currentActiveLevel = levelId;
        syncHashWithLevel(levelId);

        if (window.MapOverlay?.loadLevel) {
            window.MapOverlay.loadLevel(levelId);
        }

        renderLevelButtons();
    };

    const handleHashChange = () => {
        const levelId = resolveLevelId(getLevelIdFromHash() || initialId);
        if (levelId === currentActiveLevel) return;

        currentActiveLevel = levelId;

        if (window.MapOverlay?.loadLevel) {
            window.MapOverlay.loadLevel(levelId);
        }

        renderLevelButtons();
    };

    const handleCoordinateClick = async () => {
        const coordinateEl = sidebar?.querySelector('.sidebar-coordinate-readout');
        if (!coordinateEl || coordinateEl.hidden) return;

        try {
            await navigator.clipboard.writeText(coordinateEl.textContent);
            coordinateEl.title = 'Copied to clipboard';
            window.PopupNotification?.show('Coordinates copied to clipboard.', { type: 'success' });
        } catch (error) {
            console.error('Could not copy point coordinates to the clipboard.', error);
            coordinateEl.title = 'Could not copy coordinates';
            window.PopupNotification?.show('Could not copy point coordinates to the clipboard.', { type: 'error' });
        }
    };

    if (levelGroupContainer) {
        levelGroupContainer.addEventListener('click', handleContainerClick);
        levelGroupContainer.addEventListener('wheel', handleLevelWheel, { passive: false });
    }
    mapControls?.addEventListener('click', handleMapControlClick);
    document.addEventListener('fullscreenchange', updateFullscreenButton);
    window.addEventListener('hashchange', handleHashChange);
    updateFullscreenButton();
    const coordinateButton = sidebar?.querySelector('.sidebar-coordinate-readout');
    coordinateButton?.addEventListener('click', handleCoordinateClick);

    syncHashWithLevel(currentActiveLevel);
    renderLevelButtons();

    window.MapUI = {
        updateSidebar,
        destroy: () => {
            mapControls?.removeEventListener('click', handleMapControlClick);
            document.removeEventListener('fullscreenchange', updateFullscreenButton);
            window.removeEventListener('hashchange', handleHashChange);
            if (levelGroupContainer) {
                levelGroupContainer.removeEventListener('click', handleContainerClick);
                levelGroupContainer.removeEventListener('wheel', handleLevelWheel);
            }
            coordinateButton?.removeEventListener('click', handleCoordinateClick);
        }
    };
})();