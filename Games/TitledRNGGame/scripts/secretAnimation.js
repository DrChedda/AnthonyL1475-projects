export const SecretAnimation = {
    overlay: document.getElementById("secretOverlay"),
    canvas: document.getElementById("secretCanvas"),
    titleText: document.getElementById("secretTitleText"),
    ctx: null, particles: [], burstParticles: [], animFrame: null, phase: "idle",
    starScale: 0, starAlpha: 0, starRotation: 0,

    init() {
        if (!this.canvas) {
            this.overlay = document.getElementById("secretOverlay");
            this.canvas = document.getElementById("secretCanvas");
            this.titleText = document.getElementById("secretTitleText");
        }
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext("2d");
        this.resize();
        addEventListener("resize", () => this.resize());
    },

    resize() {
        if (!this.canvas) return;
        this.canvas.width = innerWidth;
        this.canvas.height = innerHeight;
    },

    trigger(titleName) {
        if (!this.canvas || !this.ctx) this.init();
        const content = this.overlay.querySelector(".secret-content");
        content.classList.remove("revealed", "slam");
        this.overlay.classList.remove("flash", "hidden");
        this.titleText.textContent = titleName;
        void this.overlay.offsetWidth;
        this.overlay.classList.add("active");
        Object.assign(this, { phase: "implode", starScale: 0, starAlpha: 0, starRotation: 0 });
        this.spawnParticles("implode");
        this.loop();
        setTimeout(() => {
            this.phase = "burst";
            this.overlay.classList.add("flash");
            content.classList.add("slam");
            this.spawnParticles("burst");
            setTimeout(() => {
                this.overlay.classList.remove("active");
                setTimeout(() => {
                    this.overlay.classList.add("hidden");
                    content.classList.remove("slam");
                    this.phase = "idle";
                    cancelAnimationFrame(this.animFrame);
                }, 400);
            }, 5000);
        }, 10000);
    },

    spawnParticles(mode) {
        const cx = this.canvas.width / 2, cy = this.canvas.height / 2;
        if (mode === "implode") {
            const max = Math.max(cx, cy);
            this.particles = Array.from({ length: 350 }, () => {
                const a = Math.random() * Math.PI * 2, dist = Math.random() * max * 1.8 + 300;
                return {
                    x: cx + Math.cos(a) * dist, y: cy + Math.sin(a) * dist,
                    speed: dist / ((9 + Math.random()) * 60), accel: 1.002 + Math.random() * 0.004,
                    wobble: (Math.random() - 0.5) * 0.04, size: Math.random() * 3.5 + 1.5,
                    color: Math.random() > 0.4 ? "#fff" : "#aaa", reachedCenter: false
                };
            });
            return;
        }
        this.burstParticles = Array.from({ length: 220 }, () => {
            const a = Math.random() * Math.PI * 2, s = Math.random() * 24 + 4;
            return {
                x: cx, y: cy, vx: Math.cos(a) * s, vy: Math.sin(a) * s, size: Math.random() * 6 + 2,
                color: Math.random() > 0.3 ? "#fff" : "#888", alpha: 1, decay: Math.random() * 0.015 + 0.005
            };
        });
    },

    dot(x, y, size, color, alpha = 1, blur = 10) {
        const { ctx } = this;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        ctx.shadowBlur = blur;
        ctx.shadowColor = "#fff";
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    },

    star(cx, cy, r, rot) {
        const { ctx } = this, step = Math.PI / 5, ir = r * 0.45;
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            const o = rot + i * step * 2, inn = o + step;
            if (!i) ctx.moveTo(cx + Math.cos(o) * r, cy + Math.sin(o) * r);
            else ctx.lineTo(cx + Math.cos(o) * r, cy + Math.sin(o) * r);
            ctx.lineTo(cx + Math.cos(inn) * ir, cy + Math.sin(inn) * ir);
        }
        ctx.closePath();
        ctx.lineJoin = ctx.lineCap = "round";
        ctx.lineWidth = 12;
        ctx.strokeStyle = "#fff";
        ctx.stroke();
        ctx.fill();
    },

    loop() {
        if (this.phase === "idle") return;
        const { ctx, canvas } = this;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const cx = canvas.width / 2, cy = canvas.height / 2;

        if (this.phase === "implode") {
            for (const p of this.particles) {
                if (!p.reachedCenter) {
                    const dx = cx - p.x, dy = cy - p.y;
                    if (Math.hypot(dx, dy) > 6) {
                        const a = Math.atan2(dy, dx) + p.wobble;
                        p.x += Math.cos(a) * p.speed;
                        p.y += Math.sin(a) * p.speed;
                        p.speed *= p.accel;
                    } else p.reachedCenter = true, p.x = cx, p.y = cy;
                }
                this.dot(p.x, p.y, p.size, p.color);
            }
            if (this.starScale < 55) this.starScale += 0.09;
            if (this.starAlpha < 1) this.starAlpha += 0.003;
            this.starRotation += 0.015;
            ctx.save();
            ctx.globalAlpha = this.starAlpha;
            ctx.fillStyle = "#fff";
            ctx.shadowBlur = 35;
            ctx.shadowColor = "#fff";
            this.star(cx, cy, this.starScale, this.starRotation);
            ctx.restore();
        } else if (this.phase === "burst") {
            const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 450);
            g.addColorStop(0, "rgba(255,255,255,0.3)");
            g.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            for (let i = this.burstParticles.length - 1; i >= 0; i--) {
                const p = this.burstParticles[i];
                p.x += p.vx; p.y += p.vy; p.vx *= 0.94; p.vy *= 0.94;
                if ((p.alpha -= p.decay) <= 0) { this.burstParticles.splice(i, 1); continue; }
                this.dot(p.x, p.y, p.size, p.color, p.alpha, 14);
            }
        }
        this.animFrame = requestAnimationFrame(() => this.loop());
    }
};

window.SecretAnimation = SecretAnimation;
