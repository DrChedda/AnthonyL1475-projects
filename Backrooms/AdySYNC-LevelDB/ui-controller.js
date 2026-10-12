// ui-controller.js
(function() {
    if (window.MapUI?.destroy) {
        window.MapUI.destroy();
    }

    const AVAILABLE_LEVELS = [
        { id: '0', label: 'Level 0' },
        { id: '0.5', label: 'Level 0.5', parent: '0' },
        { id: '1', label: 'Level 1' },
        { id: '1.1', label: 'Level 1.1', parent: '1'},
    ];

    const sidebar = document.querySelector('.sidebar');
    const levelGroupContainer = document.querySelector('.level-btn-group');
    const mapControls = document.querySelector('.map-controls');
    const fullscreenButton = mapControls?.querySelector('[data-map-control="fullscreen"]');

    let currentActiveLevel = '0';

    function updateFullscreenButton() {
        if (!fullscreenButton) return;
        fullscreenButton.textContent = document.fullscreenElement ? 'Exit Fullscreen' : 'Fullscreen';
    }

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

        AVAILABLE_LEVELS.forEach((lvl) => {
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

        const levelId = btn.getAttribute('data-level');
        if (!levelId || levelId === currentActiveLevel) return;

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
    }
    mapControls?.addEventListener('click', handleMapControlClick);
    document.addEventListener('fullscreenchange', updateFullscreenButton);
    updateFullscreenButton();
    const coordinateButton = sidebar?.querySelector('.sidebar-coordinate-readout');
    coordinateButton?.addEventListener('click', handleCoordinateClick);

    renderLevelButtons();

    window.MapUI = {
        updateSidebar,
        destroy: () => {
            mapControls?.removeEventListener('click', handleMapControlClick);
            document.removeEventListener('fullscreenchange', updateFullscreenButton);
            if (levelGroupContainer) {
                levelGroupContainer.removeEventListener('click', handleContainerClick);
            }
            coordinateButton?.removeEventListener('click', handleCoordinateClick);
        }
    };
})();