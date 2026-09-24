--- 
permalink: /main/editor/editor-script.js
---
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
    const statusBox = getEl('auth-status');
    statusBox.textContent = "DATABASE INACTIVE: AUTHENTICATION UNAVAILABLE";
};

window.handleAuthSubmit = function() {
    const isSignup = getEl('signup-extra').style.display === 'flex';
    window.handleAuth(isSignup ? 'signup' : 'login');
};

window.handleLogout = async function() {
    alert("Database authentication is inactive.");
};

window.checkUser = async function() {
    getEl('auth-status').textContent = "DATABASE INACTIVE: EDITOR UNAVAILABLE";
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
    getEl('auth-status').textContent = "DATABASE INACTIVE: LEVEL DATA UNAVAILABLE";
};

window.saveChanges = async function() {
    alert("Database inactive: changes were not saved.");
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