import { CashflowHandler } from "./cashflowHandler.js";
import { SecretAnimation } from "./secretAnimation.js";

const titles = [
    ["Dusty Wayfarer", "Common", 4800, 2], ["Chimebound Gremlin", "Common", 3200, 3], ["Rusty Collector", "Common", 3100, 3],
    ["Wandering Sage", "Common", 2800, 4], ["Pocket Lantern", "Common", 2400, 4], ["Lucky Rookie", "Uncommon", 1600, 6],
    ["Frost Dancer", "Uncommon", 920, 10], ["Neon Sprinter", "Uncommon", 850, 11], ["Shadow Jester", "Uncommon", 780, 12],
    ["Sticker Bandit", "Uncommon", 700, 14], ["Crystal Gambler", "Rare", 380, 26], ["Void-Touched", "Rare", 220, 42],
    ["Ember Weaver", "Rare", 200, 46], ["Moonlit Dealer", "Rare", 160, 58], ["Hexed Collector", "Rare", 140, 66],
    ["Solar Royalty", "Epic", 85, 100], ["Thundercaller", "Epic", 45, 175], ["Abyss Skipper", "Epic", 38, 210],
    ["Runebreaker", "Epic", 32, 245], ["Velvet Catastrophe", "Epic", 26, 300], ["Jackpot Monarch", "Legendary", 14, 550],
    ["Fortune Weaver", "Legendary", 8, 950], ["Server Blessed", "Legendary", 6, 1250], ["Eclipse Emperor", "Legendary", 4, 1850],
    ["Echo of the Jackpot", "Legendary", 3, 2450], ["Dream Devourer", "Mythic", 2.8, 2600], ["Prism Reclaimer", "Mythic", 1.8, 4000],
    ["Chrono Harlequin", "Mythic", 1.5, 4800], ["Veilbreaker Sage", "Mythic", 1.2, 6000], ["Essence Thief", "Mythic", 1, 7200],
    ["Celestial Glitch", "Celestial", 0.9, 9500], ["Cosmic Throne", "Celestial", 0.8, 11000], ["Starforge Warden", "Celestial", 0.65, 13500],
    ["Aurora Vandal", "Celestial", 0.5, 17500], ["The Titled One", "Impossible", 0.22, 40000], ["Null Sovereign", "Impossible", 0.15, 88000],
    ["Paradox Crown", "Impossible", 0.1, 125000], ["Fatebreaker", "Impossible", 0.08, 175000], ["Omega Mirage", "Impossible", 0.05, 290000],
    ["Devourer of Names", "Impossible", 0.03, 850000], ["Arcane Executor", "Arcane", 0.02, 1050000, 5],
    ["Divine Harbinger", "Divine", 0.012, 2400000, 8], ["Blessed Savant", "Divine", 0.009, 4680000, 10],
    ["Zenith Ascendant", "Zenith", 0.006, 8100000, 10], ["Omniscient Judge", "Omniscient", 0.004, 18000000, 12],
    ["All-Seeing Eye", "Omniscient", 0.0025, 23060000, 13], ["Eternal Wanderer", "Eternity", 0.0018, 35000000, 14],
    ["Abyssal Leviathan", "Abyssal", 0.0012, 52000000, 15], ["Deep One", "Abyssal", 0.0008, 78000000, 15],
    ["Voidborn Horror", "Voidborn", 0.0005, 125000000, 16], ["Singularity Core", "Singularity", 0.0003, 210000000, 16],
    ["The Void", "Singularity", 0.0001, 650000000, 16], ["Secrets of Tomorrow", "Secret", 0.0000005, 1]
].map(([name, rarity, weight, value, requiredRebirths]) => ({ name, rarity, weight, value, ...(requiredRebirths != null && { requiredRebirths }) }));

const titleMap = new Map(titles.map((t) => [t.name, t]));
const rarityRank = { Common: 1, Uncommon: 2, Rare: 3, Epic: 4, Legendary: 5, Mythic: 6, Celestial: 7, Impossible: 8, Arcane: 9, Divine: 10, Zenith: 11, Omniscient: 12, Eternity: 13, Abyssal: 14, Voidborn: 15, Singularity: 16, Secret: 25 };
const rarityColors = { Common: "#dfe7ff", Uncommon: "#ffffff", Rare: "#ffffff", Epic: "#ffffff", Legendary: "#ffffff", Mythic: "#ffffff", Celestial: "#8dfff6", Impossible: "#ff6b6b", Arcane: "#ff9f43", Divine: "#ffe66d", Zenith: "#7bf1ff", Omniscient: "#b388ff", Eternity: "#ff5fd2", Abyssal: "#ff3d3d", Voidborn: "#8f7cff", Singularity: "#ffffff" };

const config = {
    autoRollCost: 150, 
    baseCooldownMs: 800, 
    autoRollCheckMs: 100, 
    maxLogItems: 8, 
    coinRewardRate: 0.85,
    rebirthBaseCoinCost: 1200,
    rebirthCoinCostGrowth: 1.5,
    rebirthMultiplier: 0.50,
    outgrowStartLuck: 2.0, 
    outgrowStep: 1.5, 
    auraCoinBoostPerRank: 0.08,
    auraLuckBoostPerRank: 0.05, 
    autoSaveMs: 45000
};

const upgrades = [
    {
        id: "luck1",
        name: "Luck Boost 1",
        type: "luck_flat",
        maxLevel: 50,
        baseCost: 25,
        costScale: 1.35,
        costFormula: (lvl, base, scale) => Math.floor(base * (scale ** lvl)),
        effectFormula: (lvl) => lvl <= 0 ? 0 : Math.pow(lvl, 1.8) * 0.5
    },
    {
        id: "luck2",
        name: "Luck Boost 2",
        type: "luck_mult",
        maxLevel: 10,
        baseCost: 400,
        costScale: 1.85,
        costFormula: (lvl, base, scale) => Math.floor(base * (scale ** lvl)),
        effectFormula: (lvl) => 1 + (lvl * 0.5)
    }
];

const saveKey = "titledRngGameSave";
const state = {
    upgrades: {},
    rebirths: 0, rolls: 0, rollCooldownMs: config.baseCooldownMs, rollOnCooldown: false, rollCooldownTimer: null,
    autoRoll: false, autoRollUnlocked: false, autoRollTimer: null, equippedTitle: null, bestTitle: null, inventory: new Map(), log: []
};

const initUpgrades = () => {
    upgrades.forEach((u) => { state.upgrades[u.id] = state.upgrades[u.id] ?? 0; });
};
initUpgrades();

const $ = (s) => document.querySelector(s);
const el = {
    coinsDisplay: $("#coinsDisplay"), luckDisplay: $("#luckDisplay"), rollsDisplay: $("#rollsDisplay"), bestDisplay: $("#bestDisplay"),
    rebirthsDisplay: $("#rebirthsDisplay"), rollPanel: $("#rollPanel"), currentTitle: $("#currentTitle"), currentRarity: $("#currentRarity"),
    currentOdds: $("#currentOdds"), auraBoosts: $("#auraBoosts"), rollButton: $("#rollButton"), autoRollButton: $("#autoRollButton"),
    sellDuplicatesButton: $("#sellDuplicatesButton"), unlockAutoRollButton: $("#unlockAutoRollButton"), rebirthButton: $("#rebirthButton"),
    inventoryCount: $("#inventoryCount"), inventoryList: $("#inventoryList"), inventoryEmptyState: $("#inventoryEmptyState"), rollLog: $("#rollLog"),
    rollLogEmptyState: $("#rollLogEmptyState"), shopCompleted: $("#shopCompleted"), masteredLuckCard: $("#masteredLuckCard"),
    tabButtons: document.querySelectorAll(".tab-button"), tabPanels: document.querySelectorAll(".tab-panel")
};
const tpl = {
    boostPill: document.getElementById("boostPillTemplate"),
    inventoryItem: document.getElementById("inventoryItemTemplate"),
    rollLogItem: document.getElementById("rollLogItemTemplate")
};

const getUpgradeLevel = (id) => state.upgrades[id] ?? 0;

const getUpgradeCost = (u) => {
    const currentLvl = getUpgradeLevel(u.id);
    return u.costFormula(currentLvl, u.baseCost, u.costScale);
};

const getUpgradeEffectByType = (type) => {
    return upgrades
        .filter(u => u.type === type)
        .reduce((sum, u) => {
            const lvl = getUpgradeLevel(u.id);
            const effect = u.effectFormula(lvl);
            return type.includes("mult") ? sum * (effect || 1) : sum + effect;
        }, type.includes("mult") ? 1 : 0);
};

const luckUpgradeMult = () => {
    const flatLuck = getUpgradeEffectByType("luck_flat");
    const luckMult = getUpgradeEffectByType("luck_mult");
    return (1 + flatLuck) * luckMult;
};

const buyUpgrade = (id) => {
    const u = upgrades.find((up) => up.id === id);
    if (!u) return;

    const currentLvl = getUpgradeLevel(id);
    const cost = getUpgradeCost(u);

    if (currentLvl < u.maxLevel && CashflowHandler.spend(cost)) {
        state.upgrades[id] = currentLvl + 1;
        rollPoolCache = null;
        render();
    }
};

const fmt = (v) => Math.floor(v).toLocaleString();
const rClass = (r) => `rarity-${r.toLowerCase()}`;
const rankOf = (t) => rarityRank[t.rarity];
const rebirthMult = () => 1 + state.rebirths * config.rebirthMultiplier;

const triggerPanelFlash = () => {
    el.rollPanel.classList.remove("flash");
    requestAnimationFrame(() => el.rollPanel.classList.add("flash"));
};

const auraBoosts = (title = state.equippedTitle) => {
    if (!title) return { coin: 1, luck: 1 };
    const r = rankOf(title);
    return { coin: 1 + Math.max(0, r - 1) * config.auraCoinBoostPerRank, luck: 1 + Math.max(0, r - 2) * config.auraLuckBoostPerRank };
};

const effectiveLuck = () => (1 * luckUpgradeMult() * auraBoosts().luck) * rebirthMult();

const rebirthCost = () => {
    const baseCost = config.rebirthBaseCoinCost * Math.pow(config.rebirthCoinCostGrowth, state.rebirths);
    return Math.floor(baseCost);
};

let rollPoolCache;
const minOutgrownValue = () => { const x = effectiveLuck() - config.outgrowStartLuck; return x < 0 ? 0 : Math.floor(x / config.outgrowStep) + 1; };
const isOutgrown = (title) => title.rarity !== "Secret" && title.value <= minOutgrownValue();

const titleWeight = (title) => {
    if (isOutgrown(title) || (title.requiredRebirths && state.rebirths < title.requiredRebirths)) return 0;
    const rankBonus = Math.pow(rankOf(title), 1.35) * effectiveLuck();
    return title.weight * (1 + rankBonus);
};
const rollPool = () => {
    if (rollPoolCache) return rollPoolCache;
    let entries = titles.map((title) => ({ title, weight: titleWeight(title) })).filter((e) => e.weight > 0);
    if (!entries.length) entries = [{ title: titles.at(-1), weight: 1 }];
    return rollPoolCache = { entries, totalWeight: entries.reduce((s, e) => s + e.weight, 0) };
};

const oddsText = (title) => {
    if (title.requiredRebirths && state.rebirths < title.requiredRebirths) return `Requires ${title.requiredRebirths} Rebirths`;
    if (isOutgrown(title)) return "Odds: Outgrown";
    const { entries, totalWeight } = rollPool();
    const chance = (entries.find((e) => e.title.name === title.name)?.weight ?? 0) / totalWeight;
    if (chance >= 0.99) return "Odds: Guaranteed";
    if (chance <= 0) return "Odds: Unavailable";
    const denominator = 1 / chance;
    if (denominator >= 1000000) {
        return `Odds: 1 in ${(denominator / 1000000).toFixed(2)}M`;
    } else if (denominator >= 1000) {
        return `Odds: 1 in ${(denominator / 1000).toFixed(1)}K`;
    }
    
    return `Odds: 1 in ${Math.round(denominator).toLocaleString()}`;
};
const clone = (t) => t.content.firstElementChild.cloneNode(true);
const renderList = (container, items, build, empty) => {
    container.replaceChildren();
    if (!items.length) return empty && container.appendChild(empty);
    const frag = document.createDocumentFragment();
    items.forEach((item) => frag.appendChild(build(item)));
    container.appendChild(frag);
};

const buildInventoryRow = (title, count, equipped, boosts) => {
    const node = clone(tpl.inventoryItem);
    node.dataset.equipTitle = title.name;
    node.classList.toggle("equipped", equipped);
    node.querySelector(".inventory-item-title").textContent = title.name;
    node.querySelector(".inventory-item-count").textContent = `x${count}`;
    const rEl = node.querySelector(".inventory-item-rarity");
    rEl.textContent = title.rarity;
    rEl.className = `inventory-item-rarity ${rClass(title.rarity)}`;
    node.querySelector(".inventory-item-meta").textContent = `${fmt(title.value)} sell value - ${oddsText(title)} - Coins x${boosts.coin.toFixed(2)} / Luck x${boosts.luck.toFixed(2)}`;
    
    const btnEquip = node.querySelector(".equip-button");
    btnEquip.textContent = equipped ? "Equipped" : "Equip";
    btnEquip.classList.toggle("equipped", equipped);
    
    const btnSell = node.querySelector(".sell-button");
    btnSell.textContent = `Sell (+${fmt(title.value)})`;
    btnSell.addEventListener("click", (e) => {
        e.stopPropagation();
        sellTitle(title.name);
    });

    return node;
};

const buildLogRow = (title) => {
    const node = clone(tpl.rollLogItem);
    node.querySelector(".roll-log-name").textContent = title.name;
    const rEl = node.querySelector(".roll-log-rarity");
    rEl.textContent = ` - ${title.rarity}`;
    rEl.className = rClass(title.rarity);
    return node;
};

const clearRollCooldown = () => {
    state.rollOnCooldown = false;
    clearTimeout(state.rollCooldownTimer);
    el.rollButton.classList.remove("cooling-down");
};

const startRollCooldown = () => {
    clearRollCooldown();
    state.rollOnCooldown = true;
    el.rollButton.style.setProperty("--roll-cooldown-ms", `${state.rollCooldownMs}ms`);
    void el.rollButton.offsetWidth;
    el.rollButton.classList.add("cooling-down");
    state.rollCooldownTimer = setTimeout(() => { clearRollCooldown(); render(); }, state.rollCooldownMs);
};

const stopAutoRoll = () => { state.autoRoll = false; clearInterval(state.autoRollTimer); state.autoRollTimer = null; };

const performRoll = () => {
    const pool = rollPool();
    let roll = Math.random() * pool.totalWeight;
    let title = pool.entries.at(-1).title;
    for (const entry of pool.entries) {
        if ((roll -= entry.weight) <= 0) { title = entry.title; break; }
    }

    state.rolls++;
    const item = state.inventory.get(title.name) ?? { title, count: 0 };
    item.count++;
    state.inventory.set(title.name, item);

    if (title.rarity === "Secret") SecretAnimation.trigger(title.name);

    const beatsBest = !state.bestTitle || (() => {
        const d = rankOf(title) - rankOf(state.bestTitle);
        return d ? d > 0 : title.value > state.bestTitle.value;
    })();
    if (beatsBest) state.bestTitle = state.equippedTitle = title;
    else if (!state.equippedTitle) state.equippedTitle = title;

    state.log = [title, ...state.log].slice(0, config.maxLogItems);
    triggerPanelFlash();
};

const attemptRoll = () => {
    if (state.rollOnCooldown) return false;
    performRoll();
    startRollCooldown();
    render();
    return true;
};

const getSellReward = (value, count) => 
    Math.max(1, Math.floor(count * value * config.coinRewardRate * auraBoosts().coin * rebirthMult()));

const sellDuplicates = () => {
    let earned = 0;
    for (const item of state.inventory.values()) {
        if (item.count > 1) {
            earned += getSellReward(item.title.value, item.count - 1);
            item.count = 1;
        }
    }
    if (earned) CashflowHandler.__applyReward(earned);
    render();
};

const sellTitle = (name) => {
    const item = state.inventory.get(name);
    if (!item || item.count <= 0) return;

    CashflowHandler.__applyReward(getSellReward(item.title.value, 1));

    if (item.count === 1) {
        state.inventory.delete(name);
        if (state.equippedTitle?.name === name) state.equippedTitle = null;
    } else {
        item.count--;
    }
    render();
    saveGame();
};

const unlockAutoRoll = () => {
    if (state.autoRollUnlocked || !CashflowHandler.spend(config.autoRollCost)) return;
    state.autoRollUnlocked = true;
    render();
};

const rebirth = () => {
    if (!CashflowHandler.canAfford(rebirthCost())) return;
    stopAutoRoll();
    clearRollCooldown();
    
    upgrades.forEach((u) => { state.upgrades[u.id] = 0; });

    Object.assign(state, { rebirths: state.rebirths + 1, rolls: 0, equippedTitle: null, bestTitle: null, log: [] });
    state.inventory.clear();
    CashflowHandler.__resetCoins();
    render();
};

const toggleAutoRoll = () => {
    if (!state.autoRollUnlocked) return switchTab("shop");
    state.autoRoll = !state.autoRoll;
    if (state.autoRoll) { attemptRoll(); state.autoRollTimer = setInterval(attemptRoll, config.autoRollCheckMs); }
    else stopAutoRoll();
    render();
};

const equipTitle = (name) => {
    const item = state.inventory.get(name);
    if (!item) return;
    state.equippedTitle = item.title;
    render();
    triggerPanelFlash();
};

const switchTab = (tab) => {
    el.tabButtons.forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    el.tabPanels.forEach((p) => p.classList.toggle("active", p.id === `${tab}Tab`));
};

const serializeState = () => ({
    version: 1, upgrades: state.upgrades, rebirths: state.rebirths, rolls: state.rolls,
    equippedTitle: state.equippedTitle?.name ?? null, bestTitle: state.bestTitle?.name ?? null,
    inventory: [...state.inventory.entries()].map(([name, item]) => ({ name, count: item.count })),
    log: state.log.map((t) => t.name), autoRollUnlocked: state.autoRollUnlocked, autoRoll: state.autoRoll,
    coins: CashflowHandler.getCoins()
});

const restoreState = (saved) => {
    if (!saved || typeof saved !== "object") return false;
    
    state.upgrades = saved.upgrades ?? {
        luck1: Number(saved.luckLevel) || 0,
        luck2: Number(saved.luckLevel2) || 0
    };
    initUpgrades();

    Object.assign(state, {
        rebirths: Number(saved.rebirths) || 0,
        rolls: Number(saved.rolls) || 0,
        autoRollUnlocked: Boolean(saved.autoRollUnlocked),
        autoRoll: Boolean(saved.autoRoll),
        equippedTitle: titleMap.get(saved.equippedTitle) ?? null,
        bestTitle: titleMap.get(saved.bestTitle) ?? null,
        log: (saved.log || []).map((name) => titleMap.get(name)).filter(Boolean)
    });

    state.inventory = new Map(
        (saved.inventory || [])
            .filter((i) => titleMap.has(i.name) && Number(i.count) > 0)
            .map((i) => [i.name, { title: titleMap.get(i.name), count: Math.max(1, Math.floor(Number(i.count) || 1)) }])
    );

    CashflowHandler.__setCoins(Number(saved.coins) || 0);
    return true;
};

const saveGame = () => { try { localStorage.setItem(saveKey, JSON.stringify(serializeState())); } catch (e) { console.warn("Game save failed", e); } };
const loadGame = () => { try { return restoreState(JSON.parse(localStorage.getItem(saveKey))); } catch (e) { console.warn("Game load failed", e); return false; } };

function render() {
    rollPoolCache = null;
    const luck = effectiveLuck();
    const aura = auraBoosts();
    const coinMult = aura.coin * rebirthMult();
    const upgrade = luckUpgradeMult();

    el.coinsDisplay.textContent = `${CashflowHandler.format()} (x${coinMult.toFixed(2)})`;
    el.coinsDisplay.title = `Coin Multiplier: ${coinMult.toFixed(2)}x\nAura/Title: ${aura.coin.toFixed(2)}x\nRebirth: ${rebirthMult().toFixed(2)}x`;
    el.luckDisplay.textContent = `${luck.toFixed(2)}x`;
    el.luckDisplay.title = `Luck Multiplier: ${luck.toFixed(2)}x\nBase: 1.00x\nUpgrades: ${upgrade.toFixed(2)}x\nAura/Title: ${aura.luck.toFixed(2)}x\nRebirth (Top Multiplier): x${rebirthMult().toFixed(2)}`;
    el.rollsDisplay.textContent = fmt(state.rolls);
    el.bestDisplay.textContent = state.bestTitle?.name ?? "None";
    el.rebirthsDisplay.textContent = fmt(state.rebirths);

    el.rollPanel.style.setProperty("--aura-color", state.equippedTitle ? rarityColors[state.equippedTitle.rarity] : "#ffffff");
    if (!state.equippedTitle) {
        el.currentTitle.textContent = "Click roll to begin";
        el.currentRarity.textContent = "No title equipped";
        el.currentRarity.className = "";
        el.currentOdds.textContent = "Odds: -";
        el.auraBoosts.replaceChildren();
    } else {
        el.currentTitle.textContent = state.equippedTitle.name;
        el.currentRarity.textContent = `Equipped - ${state.equippedTitle.rarity}`;
        el.currentRarity.className = rClass(state.equippedTitle.rarity);
        el.currentOdds.textContent = oddsText(state.equippedTitle);
        el.auraBoosts.replaceChildren(
            Object.assign(clone(tpl.boostPill), { textContent: `Aura Coins x${aura.coin.toFixed(2)}` }),
            Object.assign(clone(tpl.boostPill), { textContent: `Aura Luck x${aura.luck.toFixed(2)}` })
        );
    }

    const items = [...state.inventory.values()].sort((a, b) => {
        const d = rankOf(b.title) - rankOf(a.title);
        return d || b.title.value - a.title.value;
    });
    el.inventoryCount.textContent = `${fmt(items.reduce((s, i) => s + i.count, 0))} owned`;
    renderList(el.inventoryList, items, ({ title, count }) => buildInventoryRow(title, count, state.equippedTitle?.name === title.name, auraBoosts(title)), el.inventoryEmptyState);
    renderList(el.rollLog, state.log, buildLogRow, el.rollLogEmptyState);

    upgrades.forEach((u) => {
        const btn = document.querySelector(`[data-upgrade-btn="${u.id}"]`);
        const label = document.querySelector(`[data-upgrade-label="${u.id}"]`);
        const level = getUpgradeLevel(u.id);
        const cost = getUpgradeCost(u);
        const isMaxed = level >= u.maxLevel;

        if (btn) {
            btn.textContent = isMaxed ? "Max Level Reached" : `Purchase - ${fmt(cost)} coins`;
            btn.disabled = isMaxed || !CashflowHandler.canAfford(cost);
        }
        if (label) {
            label.textContent = `Level ${level} / ${u.maxLevel}`;
        }
    });

    const prestige = rebirthCost();
    const luck1Maxed = getUpgradeLevel("luck1") >= upgrades.find((u) => u.id === "luck1").maxLevel;

    el.unlockAutoRollButton.textContent = state.autoRollUnlocked ? "Auto Roll Unlocked" : `Unlock Auto Roll - ${fmt(config.autoRollCost)} coins`;
    el.unlockAutoRollButton.disabled = state.autoRollUnlocked || !CashflowHandler.canAfford(config.autoRollCost);
    el.autoRollButton.textContent = state.autoRollUnlocked ? `Auto Roll: ${state.autoRoll ? "On" : "Off"}` : "Auto Roll: Locked";
    el.autoRollButton.disabled = !state.autoRollUnlocked;
    el.rebirthButton.textContent = `Rebirth - ${fmt(prestige)} coins`;
    el.rebirthButton.disabled = !CashflowHandler.canAfford(prestige);
    el.masteredLuckCard.style.display = luck1Maxed ? "grid" : "none";
    el.shopCompleted.style.display = luck1Maxed ? "block" : "none";
    el.rollButton.disabled = state.rollOnCooldown;
    el.rollButton.textContent = state.rollOnCooldown ? "Rolling..." : "Roll";
}

el.rollButton.addEventListener("click", attemptRoll);
el.autoRollButton.addEventListener("click", toggleAutoRoll);
el.sellDuplicatesButton.addEventListener("click", sellDuplicates);
el.unlockAutoRollButton.addEventListener("click", unlockAutoRoll);
el.rebirthButton.addEventListener("click", rebirth);

document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-upgrade-btn]");
    if (btn) {
        buyUpgrade(btn.dataset.upgradeBtn);
    }
});

el.inventoryList.addEventListener("click", (e) => { const row = e.target.closest("[data-equip-title]"); if (row) equipTitle(row.dataset.equipTitle); });
el.tabButtons.forEach((b) => b.addEventListener("click", () => switchTab(b.dataset.tab)));

document.addEventListener("DOMContentLoaded", () => SecretAnimation.init());
loadGame();
if (state.autoRollUnlocked && state.autoRoll) { attemptRoll(); state.autoRollTimer = setInterval(attemptRoll, config.autoRollCheckMs); }
CashflowHandler.onChange(render);
render();
setInterval(saveGame, config.autoSaveMs);
addEventListener("beforeunload", saveGame);