const supabaseUrl = 'https://wmbvsbhbmryhzgktfxfz.supabase.co';
const supabaseKey = 'sb_publishable_X47RHqCndZ9vdvVT_ZX4Jw_6X7fEHf_';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

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

async function renderLevel() {
    const { data, error } = await supabaseClient
        .from('levels')
        .select('content')
        .eq('id', PAGE_ID)
        .single();

    const vId = document.getElementById('v-id');
    if (error || !data) {
        if (vId) vId.textContent = "Level Not Found";
        return;
    }

    const c = data.content;
    const repoBase = '..';
    
    const imgElement = document.getElementById('v-image');
    if (imgElement) {
        let imgVal = c.imageFile || `${PAGE_ID}.png`;
        if (imgVal.startsWith('http')) {
            imgElement.src = imgVal;
        } else {
            const cleanName = imgVal.replace(/^\//, '');
            const pathPrefix = cleanName.toLowerCase().startsWith('images/') ? '' : 'Images/';
            imgElement.src = `${repoBase}/${pathPrefix}${cleanName}`;
        }
        imgElement.onerror = () => {
            imgElement.src = `${repoBase}/Images/placeholder.png`;
            imgElement.onerror = null;
        };
    }

    if (vId) vId.textContent = c.title || PAGE_ID;
    
    const vName = document.getElementById('v-name');
    if (vName) vName.textContent = c.name || "";
    
    const vTags = document.getElementById('v-tags');
    if (vTags) vTags.innerHTML = c.tagsHtml || "";
    
    const vStats = document.getElementById('v-stats');
    if (vStats && c.statsHtml) vStats.innerHTML = c.statsHtml;

    const hContainer = document.getElementById('v-tab-headers');
    const cContainer = document.getElementById('v-tab-contents');

    if (c.tabs?.length > 0 && hContainer && cContainer) {
        const headerFrag = document.createDocumentFragment();
        const contentFrag = document.createDocumentFragment();

        c.tabs.forEach((tab, i) => {
            const isActive = i === 0;
            const tabId = `tab-${i}`;

            const btn = document.createElement('button');
            btn.className = `tab-button ${isActive ? 'active' : ''}`;
            btn.dataset.tab = tabId;
            btn.textContent = tab.name;
            headerFrag.appendChild(btn);

            const pane = document.createElement('div');
            pane.className = `tab-content ${isActive ? 'active' : ''}`;
            pane.id = tabId;
            pane.innerHTML = tab.content;
            contentFrag.appendChild(pane);
        });

        hContainer.replaceChildren(headerFrag);
        cContainer.replaceChildren(contentFrag);

        hContainer.onclick = (e) => {
            const tabId = e.target.dataset.tab;
            if (tabId) switchTab(tabId);
        };
    }
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