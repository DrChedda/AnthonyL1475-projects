// ui-controller.js
(function() {
    if (window.MapUI?.destroy) {
        window.MapUI.destroy();
    }

    const AVAILABLE_LEVELS = [
        { id: '0', label: 'Level 0' },
        { id: '0.3', label: 'Level 0.3', parent: '0' },
        { id: '0.35', label: 'Level 0.35', parent: '0' },
        { id: '0.5', label: 'Level 0.5', parent: '0' },                
        { id: '0.7', label: 'Level 0.7', parent: '0' },
        { id: '0.775', label: 'Level 0.775', parent: '0' },
        { id: '1', label: 'Level 1' },
        { id: '1.0090', label: 'Level 1.0090', parent: '1'},
        { id: '1.1', label: 'Level 1.1', parent: '1'},
        { id: '2', label: 'Level 2' },
        { id: '3', label: 'Level 3' },
        { id: '4', label: 'Level 4' },
        { id: '6', label: 'Level 6' },
        { id: '6.1', label: 'Level 6.1', parent: '6' },
        { id: '6.2', label: 'Level 6.2', parent: '6' },
        { id: '6.3', label: 'Level 6.3', parent: '6' },
        { id: '8', label: 'Level 8' },
        { id: '9', label: 'Level 9' },
        { id: '19', label: 'Level 19' },
        { id: '21', label: 'Level 21' },
    ];

    const sidebar = document.querySelector('.sidebar');
    const levelGroupContainer = document.querySelector('.level-btn-group');

    let currentActiveLevel = '0';

    function getRootParentId(levelId) {
        const levelObj = AVAILABLE_LEVELS.find(lvl => lvl.id === levelId);
        return levelObj?.parent || levelObj?.id || levelId;
    }

    function updateSidebar(data) {
        if (!sidebar) return;

        const titleEl = sidebar.querySelector('.sidebar-title');
        const descEl = sidebar.querySelector('.sidebar-desc');
        const trelloContainer = sidebar.querySelector('.sidebar-trello-wrapper');

        if (titleEl) titleEl.textContent = data.name || 'Unknown Location';
        if (descEl) descEl.textContent = data.description || 'No description provided.';

        if (trelloContainer) {
            // Safely clear old children
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

        const activeRoot = getRootParentId(currentActiveLevel);

        const visibleLevels = AVAILABLE_LEVELS.filter(lvl => {
            if (!lvl.parent) return true;
            return lvl.parent === activeRoot;
        });

        const frag = document.createDocumentFragment();

        visibleLevels.forEach((lvl) => {
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

    if (levelGroupContainer) {
        levelGroupContainer.addEventListener('click', handleContainerClick);
    }

    renderLevelButtons();

    window.MapUI = {
        updateSidebar,
        destroy: () => {
            if (levelGroupContainer) {
                levelGroupContainer.removeEventListener('click', handleContainerClick);
            }
        }
    };
})();