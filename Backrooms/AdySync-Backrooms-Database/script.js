const items = window.items;
const canvasEl = document.getElementById("canvas");
const ctx = canvasEl.getContext("2d");
const ui = document.getElementById("ui-layer");
const searchInput = document.getElementById("search-box");
const counter = document.getElementById("search-counter");

let width, height;
function resize() {
  width = canvas.width = window.innerWidth;
  height = canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

const majorR = 140;
const minorR = 80;
const thickness = 10;
const total = items.length;
let coil = 0;
let scrollPos = 0;

window.addEventListener('scroll', () => { scrollPos = window.scrollY; });

const nodes = [];
for (let i = 0; i < total; i++) {
  const data = items[i];
  const el = document.createElement('div');
  el.className = 'node';
  const isBlank = !data.label || data.label.trim() === "";

  const match = data.label.match(/^(\d+)\*(.*)/);
  let hasAsterisk = data.label.includes('*');
  let displayLabel = data.label;
  let anchorIndex = i;

  if (displayLabel && displayLabel.trim().toLowerCase() === 'fun') {
    el.classList.add('fun-node');
  }

  if (match) {
    anchorIndex = parseInt(match[1]);
    displayLabel = match[2];
    hasAsterisk = true;
  } else if (hasAsterisk) {
    displayLabel = data.label.replace('*', '');
  }

  const baseOffset = hasAsterisk ? 750 : 0;

  if (!isBlank) {
    el.innerHTML = `
      <span>${displayLabel}</span>
      <div class="menu">
        <img class="menu-image" src="${data.image || ''}" alt="">
        <div class="menu-header">${data.header}</div>
      </div>
    `;
    el.addEventListener('click', (e) => {
      if (e.target.tagName === 'A') return;
      const wasOpen = el.classList.contains('open');
      if (!wasOpen) {
        nodes.forEach(n => {
          if (n.element !== el) n.element.classList.remove('open');
        });
        el.classList.add('open');
      } else {
        el.classList.remove('open');
        if (data.link) {
          window.location.href = data.link;
        }
      }
      e.stopPropagation();
    });
  } else {
    el.classList.add('hidden-node');
  }

  ui.appendChild(el);
  nodes.push({
    element: el,
    label: displayLabel.toLowerCase(),
    targetY: i * 250 + 300,
    anchorY: anchorIndex * 250 + 300,
    visible: !isBlank,
    baseOffset: baseOffset,
    hasAsterisk: hasAsterisk,
    vOffset: (anchorIndex === i) ? 0 : 50,
    connectors: (data.connector && typeof data.connector === 'string') ? data.connector.split('|').map(s => parseInt(s, 10)).filter(n => !isNaN(n)) : []
  });
}

function drift(yPos) { return Math.sin(yPos * 0.0004) * (width * 0.15); }

function corePos(worldY, centerX) {
    const d = drift(worldY);
    const mainAngle = worldY * 0.0035;
    return centerX + d + (majorR * Math.cos(mainAngle));
}

function drawSegment(worldY, screenY, nextScreenY, centerX) {
    const d1 = drift(worldY);
    const nextWorldY = nextScreenY + scrollPos;
    const d2 = drift(nextWorldY);
    const mainAngle = worldY * 0.0035;
    const nextMainAngle = nextWorldY * 0.0035;
    const coilAngle = (worldY * 0.035) + coil;
    const nextCoilAngle = (nextWorldY * 0.035) + coil;

    const x = centerX + d1 + (majorR * Math.cos(mainAngle)) + (minorR * Math.cos(coilAngle));
    const finalY = screenY + (minorR * Math.sin(coilAngle));
    const nx = centerX + d2 + (majorR * Math.cos(nextMainAngle)) + (minorR * Math.cos(nextCoilAngle));
    const nfy = nextScreenY + (minorR * Math.sin(nextCoilAngle));

    const depth = Math.sin(mainAngle);
    const brightness = 60 + (depth * 50);

    ctx.beginPath();
    ctx.moveTo(x, finalY);
    ctx.lineTo(nx, nfy);
    ctx.lineWidth = (thickness * 0.8) + (depth * 5);
    ctx.strokeStyle = `rgba(0, ${brightness + 120}, 255, ${0.7 + (depth * 0.3)})`;
    ctx.stroke();
}

function render() {
  ctx.fillStyle = "#000308";
  ctx.fillRect(0, 0, width, height);
  const centerX = width / 2;
  const segments = 250;
  const buffer = 100;

  for (let i = 0; i < segments; i++) {
    const screenY = (i / segments) * (height + buffer * 2) - buffer;
    const nextScreenY = ((i + 1) / segments) * (height + buffer * 2) - buffer;
    const worldY = screenY + scrollY;
    if (Math.sin(worldY * 0.0035) < 0) drawSegment(worldY, screenY, nextScreenY, centerX);
  }
  for (let i = 0; i < segments; i++) {
    const screenY = (i / segments) * (height + buffer * 2) - buffer;
    const nextScreenY = ((i + 1) / segments) * (height + buffer * 2) - buffer;
    const x1 = corePos(screenY + scrollPos, centerX);
    const x2 = corePos(nextScreenY + scrollPos, centerX);
    ctx.beginPath();
    ctx.moveTo(x1, screenY);
    ctx.lineTo(x2, nextScreenY);
    ctx.lineWidth = 25; ctx.strokeStyle = "rgba(0, 100, 255, 0.2)"; ctx.stroke();
    ctx.lineWidth = 8; ctx.strokeStyle = "rgba(180, 240, 255, 0.8)"; ctx.stroke();
  }
  for (let i = 0; i < segments; i++) {
    const screenY = (i / segments) * (height + buffer * 2) - buffer;
    const nextScreenY = ((i + 1) / segments) * (height + buffer * 2) - buffer;
    const worldY = screenY + scrollPos;
    if (Math.sin(worldY * 0.0035) >= 0) drawSegment(worldY, screenY, nextScreenY, centerX);
  }

  const time = Date.now() * 0.002;

  nodes.forEach((node) => {
    if (!node.visible || node.element.classList.contains('filtered-out')) {
        node.element.style.display = "none";
        return;
    }
    
    const worldY = node.hasAsterisk ? (node.anchorY + node.vOffset) : node.targetY;
    const relativeY = worldY - scrollPos;

    if (relativeY > -200 && relativeY < height + 200) {
      const coreX = corePos(node.hasAsterisk ? node.anchorY : node.targetY, centerX);
      const mainAngle = (node.hasAsterisk ? node.anchorY : node.targetY) * 0.0035;
      const dirX = Math.cos(mainAngle); 
      const spiralEdgeX = coreX + (dirX * minorR);

      const side = coreX < centerX ? 1 : -1;

      let finalX = spiralEdgeX + (node.baseOffset * side);
      const margin = 150;
      if (finalX < margin) finalX = margin;
      if (finalX > width - margin) finalX = width - margin;

      if (node.hasAsterisk) {
        const anchorRelY = node.anchorY - scrollPos;
        const anchorX = corePos(node.anchorY, centerX);
        const flicker = Math.random() > 0.96 ? 0.8 : 0.2;
        const dashSpeed = time * 20;

        ctx.beginPath();
        ctx.moveTo(anchorX, anchorRelY);
        const cp1x = anchorX + (120 * side);
        const cp1y = anchorRelY;
        const cp2x = finalX - (150 * side);
        const cp2y = relativeY;
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, finalX, relativeY);
        
        ctx.setLineDash([]);
        ctx.strokeStyle = `rgba(0, 150, 255, ${0.1 + (Math.random() * 0.05)})`;
        ctx.lineWidth = 4; ctx.stroke();

        ctx.setLineDash([8, 4]);
        ctx.lineDashOffset = -dashSpeed + (Math.random() * flicker * 10);
        ctx.strokeStyle = `rgba(0, 210, 255, ${0.4 + (Math.random() * flicker)})`;
        ctx.lineWidth = 2; ctx.stroke();
        ctx.setLineDash([]);
      }

      node.element.style.display = "flex";
      node.element.style.left = `${finalX}px`;
      node.element.style.top = `${relativeY}px`;
      node.element.style.transform = `translate(-50%, -50%)`;
      const opacity = Math.min(relativeY / 200, (height - relativeY) / 200, 1);
      node.element.style.opacity = opacity > 0 ? opacity : 0;
    } else {
      node.element.style.display = "none";
    }
  });
}

let scrollAnim = null;
function scrollToSmooth(target, duration = 900) {
  if (scrollAnim) cancelAnimationFrame(scrollAnim);
  const start = window.scrollY || window.pageYOffset;
  const startTime = performance.now();
  const docHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
  const maxScroll = Math.max(0, docHeight - window.innerHeight);
  const dest = Math.max(0, Math.min(target, maxScroll));
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function step(now) {
    const elapsed = now - startTime;
    const t = Math.min(1, elapsed / duration);
    const eased = easeOut(t);
    const y = start + (dest - start) * eased;
    window.scrollTo(0, y);
    if (t < 1) {
      scrollAnim = requestAnimationFrame(step);
    } else {
      scrollAnim = null;
    }
  }
  scrollAnim = requestAnimationFrame(step);
}

let results = [];
let currentIndex = -1;
function search(isNewSearch = false) {
  const term = searchInput.value.toLowerCase();
  
  nodes.forEach(n => n.element.classList.remove('active-search'));

  if (isNewSearch) {
    results = [];
    nodes.forEach(node => {
      const isMatch = node.label.includes(term);
      if (term === "" || isMatch) {
        node.element.classList.remove('filtered-out');
        if (node.visible && term !== "") results.push(node);
      } else {
        node.element.classList.add('filtered-out');
      }
    });

    currentIndex = -1; 
  }

  if (term === "" || results.length === 0) {
    counter.textContent = "<0/0>";
  } else {
    const displayIndex = currentIndex === -1 ? 0 : currentIndex + 1;
    counter.textContent = `<${displayIndex}/${results.length}>`;
  }

  if (currentIndex !== -1 && results.length > 0) {
    const targetNode = results[currentIndex];
    targetNode.element.classList.add('active-search');

    if (!isNewSearch) {
      const worldY = targetNode.hasAsterisk ? targetNode.anchorY : targetNode.targetY;
      scrollToSmooth(worldY - (height / 2));
    }
  }
}

searchInput.addEventListener('input', () => search(true));

searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && results.length > 0) {
    if (currentIndex === -1) {
      currentIndex = 0;
    } else {
      currentIndex = (currentIndex + 1) % results.length;
    }
    
    search(false);
  }
});

window.addEventListener('load', () => {
  const savedPos = sessionStorage.getItem('backrooms_scroll_pos');
  if (savedPos) {
    setTimeout(() => {
      window.scrollTo(0, parseInt(savedPos));
      sessionStorage.removeItem('backrooms_scroll_pos');
    }, 50);
  }
});

nodes.forEach(node => {
  node.element.addEventListener('click', () => {
    sessionStorage.setItem('backrooms_scroll_pos', window.scrollY.toString());
  });
});

function loop() {
  coil += 0.008;
  render();
  requestAnimationFrame(loop);
}
loop();