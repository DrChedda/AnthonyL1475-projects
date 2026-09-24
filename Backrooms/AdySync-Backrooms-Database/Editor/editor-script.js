--- 
permalink: /main/editor/editor-script.js
---
const supabaseUrl = 'https://wmbvsbhbmryhzgktfxfz.supabase.co';
const supabaseKey = 'sb_publishable_X47RHqCndZ9vdvVT_ZX4Jw_6X7fEHf_';
const db = window.supabase.createClient(supabaseUrl, supabaseKey);
const quillInstances = {};
let CURRENT_ID = new URLSearchParams(window.location.search).get('id') || 'level-0';

const getEl = (id) => document.getElementById(id);

window.toggleSignup = function() {
    const extra = getEl('signup-extra');
    const isLogin = extra.style.display === 'none' || !extra.style.display;
    
    extra.style.display = isLogin ? 'flex' : 'none';
    getEl('login-btn').style.display = isLogin ? 'none' : 'block';
    getEl('back-to-login').style.display = isLogin ? 'block' : 'none';
    getEl('auth-title').textContent = isLogin ? "CREATE ACCOUNT" : "ACCESS RESTRICTED";
    
    const signupBtn = getEl('signup-btn');
    signupBtn.textContent = isLogin ? "CONFIRM REGISTRATION" : "REGISTER";
    signupBtn.style.width = isLogin ? "100%" : "auto";
};

window.resetAuthUI = function() {
    getEl('signup-extra').style.display = 'none';
    getEl('login-btn').style.display = 'block';
    getEl('back-to-login').style.display = 'none';
    getEl('auth-title').textContent = "AUTH_REQUIRED";
    getEl('signup-btn').textContent = "Request Access";
    getEl('signup-btn').style.width = "auto";
    getEl('auth-status').textContent = "";
};

window.handleAuth = async function(mode) {
    const email = getEl('email-field').value;
    const password = getEl('password-field').value;
    const statusBox = getEl('auth-status');
    
    const { error } = (mode === 'login') 
        ? await db.auth.signInWithPassword({ email, password })
        : await db.auth.signUp({ email, password, options: { data: { creation_key: getEl('key-field').value } } });

    if (error) statusBox.textContent = `ERROR: ${error.message}`;
    else mode === 'login' ? window.checkUser() : (statusBox.textContent = "CHECK EMAIL FOR LINK");
};

window.handleAuthSubmit = function() {
    const isSignup = getEl('signup-extra').style.display === 'flex';
    window.handleAuth(isSignup ? 'signup' : 'login');
};

window.handleLogout = async function() {
    try {
        const { error } = await db.auth.signOut();
        if (error) throw error;
        document.body.classList.remove('editor-active');
        const url = new URL(window.location);
        url.searchParams.delete('id');
        window.history.replaceState({}, '', url);
        location.reload();
    } catch (err) {
        console.error("Logout failed:", err.message);
        alert("Logout Error: " + err.message);
    }
};

window.checkUser = async function() {
    const { data: { user } } = await db.auth.getUser();
    if (user) {
        document.body.classList.add('editor-active');
        getEl('login-overlay').style.display = 'none';
        getEl('editor-ui').style.display = 'flex';
        getEl('id-input').value = CURRENT_ID;
        window.loadData();
    }
};

window.switchPage = function() {
    const newId = getEl('id-input').value.trim();
    if (newId && newId !== CURRENT_ID) {
        CURRENT_ID = newId;
        const url = new URL(window.location);
        url.searchParams.set('id', newId);
        window.history.pushState({}, '', url);
        window.loadData();
    }
};

window.updatePreview = function(val) {
    if (!val) return;
    const repoBase = '/AdySync-Backrooms-Database';
    let src = val.startsWith('http') ? val : `${repoBase}/${val.toLowerCase().startsWith('images/') ? val : 'Images/' + val}`;
    const img = getEl('active-image');
    img.onerror = () => { img.src = `${repoBase}/Images/placeholder.png`; img.onerror = null; };
    img.src = src;
};

getEl('edit-tags').addEventListener('click', (e) => {
    const tag = e.target.closest('.tag');
    if (tag && confirm(`Remove tag "${tag.textContent.trim()}"?`)) tag.remove();
});

window.addTag = function() {
    const input = getEl('new-tag-text');
    if (!input.value.trim()) return;
    const tag = document.createElement('span');
    tag.className = `tag ${getEl('tag-color-select').value}`;
    tag.textContent = input.value.trim();
    getEl('edit-tags').appendChild(tag);
    input.value = "";
};

window.loadData = async function() {
    const { data } = await db.from('levels').select('content').eq('id', CURRENT_ID).single();
    const content = data?.content || {};
    getEl('img-input').value = content.imageFile || `${CURRENT_ID}.png`;
    window.updatePreview(getEl('img-input').value);
    getEl('edit-lvl-id').textContent = content.title || CURRENT_ID;
    getEl('edit-lvl-name').textContent = content.name || "";
    getEl('edit-tags').innerHTML = content.tagsHtml || "";
    getEl('edit-stats').innerHTML = content.statsHtml || "";
    Object.keys(quillInstances).forEach(id => delete quillInstances[id]);
    getEl('tab-headers').innerHTML = "";
    getEl('tab-contents-container').innerHTML = "";
    if (content.tabs?.length) {
        content.tabs.forEach((t, i) => window.createNewTab(t.name, t.content, i === 0));
    }
};

window.saveToSupabase = async function() {
    const tabs = Array.from(document.querySelectorAll('.tab-controls')).map(ctrl => ({
        name: ctrl.querySelector('.tab-button').textContent,
        content: quillInstances[ctrl.dataset.tabId].root.innerHTML
    }));
    const payload = {
        title: getEl('edit-lvl-id').textContent,
        name: getEl('edit-lvl-name').textContent,
        tagsHtml: getEl('edit-tags').innerHTML,
        statsHtml: getEl('edit-stats').innerHTML,
        imageFile: getEl('img-input').value,
        tabs
    };
    const { error } = await db.from('levels').upsert({ id: CURRENT_ID, content: payload });
    alert(error ? `Error: ${error.message}` : `SUCCESS: Data pushed to ${CURRENT_ID}`);
};

window.setActiveTab = function(id) {
    document.querySelectorAll('.tab-button, .tab-content, .ql-toolbar').forEach(el => {
        el.classList.remove('active', 'active-toolbar');
        if (el.classList.contains('ql-toolbar')) el.style.setProperty('display', 'none', 'important');
    });
    const header = document.querySelector(`#header-${id} .tab-button`);
    const pane = getEl(`content-${id}`);
    const toolbar = pane?.previousElementSibling;
    if (header && pane) {
        header.classList.add('active');
        pane.classList.add('active');
        if (toolbar?.classList.contains('ql-toolbar')) {
            toolbar.classList.add('active-toolbar');
            toolbar.style.setProperty('display', 'block', 'important');
        }
        quillInstances[id]?.update();
    }
};

window.createNewTab = function(name = "New Tab", content = "", isFirst = false) {
    const id = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const header = document.createElement('div');
    header.className = 'tab-controls';
    header.id = `header-${id}`;
    header.dataset.tabId = id;
    header.innerHTML = `
        <span class="tab-button" role="button" onclick="window.setActiveTab('${id}')" 
              ondblclick="this.contentEditable='true';this.focus()"
              onblur="this.contentEditable='false'">${name}</span>
        <button class="del-tab" onclick="window.deleteTab('${id}')">✕</button>`;
    getEl('tab-headers').appendChild(header);
    const pane = document.createElement('div');
    pane.className = 'tab-content';
    pane.id = `content-${id}`;
    getEl('tab-contents-container').appendChild(pane);
    const quill = new Quill(`#content-${id}`, {
        theme: 'snow',
        modules: {
            toolbar: [
                [{ 'font': [] }, { 'size': [] }],
                ['bold', 'italic', 'underline', 'strike'],
                [{ 'color': [] }, { 'background': [] }],
                [{ 'script': 'super' }, { 'script': 'sub' }],
                [{ 'header': '1' }, { 'header': '2' }, 'blockquote', 'code-block'],
                [{ 'list': 'ordered' }, { 'list': 'bullet' }, { 'indent': '-1' }, { 'indent': '+1' }],
                [{ 'direction': 'rtl' }, { 'align': [] }],
                ['link', 'image', 'formula'],
                ['clean']
            ]
        }
    });
    if (content) quill.clipboard.dangerouslyPasteHTML(content);
    quillInstances[id] = quill;
    if (isFirst) window.setActiveTab(id);
    else pane.previousElementSibling.style.setProperty('display', 'none', 'important');
};

window.deleteTab = (id) => {
    const wasActive = document.querySelector(`#header-${id} .tab-button`)?.classList.contains('active');
    getEl(`header-${id}`)?.remove();
    getEl(`content-${id}`)?.remove();
    delete quillInstances[id]; 
    if (wasActive) {
        const first = document.querySelector('.tab-controls');
        if (first) window.setActiveTab(first.dataset.tabId);
    }
};

getEl('id-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') window.switchPage();
});

window.checkUser();