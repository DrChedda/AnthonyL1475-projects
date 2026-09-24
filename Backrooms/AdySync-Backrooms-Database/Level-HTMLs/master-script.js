const pathParts = window.location.pathname.split('/').filter(Boolean);
const rawPageName = pathParts[pathParts.length - 1] || "level-0.html";
const PAGE_ID = rawPageName.replace(/\.html$/i, '') || 'level-0';

let searchTimeout;

function switchTab(tabId) {
    const buttons = document.querySelectorAll('.tab-button');
    const contents = document.querySelectorAll('.tab-content');
    
    buttons.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabId));
    contents.forEach(content => content.classList.toggle('active', content.id === tabId));
}

function renderLevel() {
    const vId = document.getElementById('v-id');
    if (vId) vId.textContent = "Database Inactive";

    const vName = document.getElementById('v-name');
    if (vName) vName.textContent = "Level content is no longer available.";
}

function searchText() {
    const box = document.getElementById('search-box');
    const activeContent = document.querySelector('.tab-content.active');
    if (!box || !activeContent) return;

    const query = box.value.trim();

    const prevHighlights = activeContent.querySelectorAll('.highlight');
    prevHighlights.forEach(span => {
        span.replaceWith(document.createTextNode(span.textContent));
    });
    activeContent.normalize();

    if (!query) return;

    const walker = document.createTreeWalker(activeContent, NodeFilter.SHOW_TEXT, null, false);
    const nodesToReplace = [];
    const regex = new RegExp(`(${query})`, 'gi');

    let currentNode;
    while (currentNode = walker.nextNode()) {
        if (regex.test(currentNode.textContent)) {
            nodesToReplace.push(currentNode);
        }
    }

    if (nodesToReplace.length > 0) {
        nodesToReplace.forEach(node => {
            const span = document.createElement('span');
            span.innerHTML = node.textContent.replace(regex, '<span class="highlight">$1</span>');
            node.replaceWith(span);
        });

        const firstMatch = activeContent.querySelector('.highlight');
        if (firstMatch) firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
        box.style.borderColor = "#00ff00";
    } else {
        box.style.borderColor = "#ff3333";
        setTimeout(() => { box.style.borderColor = "#0099ff"; }, 500);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    renderLevel();

    const lightbox = document.getElementById('image-lightbox');
    const lightboxImg = document.getElementById('lightbox-img');

    document.addEventListener('click', (e) => {
        if (e.target.tagName === 'IMG' && e.target.id !== 'lightbox-img') {
            if (lightbox && lightboxImg) {
                lightboxImg.src = e.target.src;
                lightbox.style.display = 'flex';
            }
        }
    });

    if (lightbox) {
        lightbox.onclick = (e) => {
            if (e.target !== lightboxImg) lightbox.style.display = 'none';
        };
    }

    const searchBox = document.getElementById('search-box');
    if (searchBox) {
        searchBox.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(searchText, 300); 
        });
        searchBox.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                clearTimeout(searchTimeout);
                searchText();
            }
        });
    }

    document.addEventListener('click', (e) => {
        const tab = e.target.closest('.side-tab');
        if (!tab) return;
        
        const wrap = tab.closest('.tab-side-wrap');
        const targetId = tab.getAttribute('data-target');
        
        wrap.querySelectorAll('.side-tab, .side-panel').forEach(el => {
            el.classList.toggle('active', el === tab || el.id === targetId);
        });
    });
});