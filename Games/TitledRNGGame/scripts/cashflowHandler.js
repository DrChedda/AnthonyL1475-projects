// scripts/cashflowHandler.js
let coins = 0;
const listeners = new Set();

const clampMoney = (value) => Math.max(0, Math.floor(Number(value) || 0));
const emit = () => listeners.forEach((listener) => listener(coins));

const applyCoins = (value) => {
    coins = clampMoney(value);
    emit();
    return coins;
};

const changeCoins = (amount) => applyCoins(coins + clampMoney(amount));

export const CashflowHandler = Object.freeze({
    getCoins() {
        return coins;
    },

    canAfford(cost) {
        return coins >= clampMoney(cost);
    },

    spend(cost) {
        const price = clampMoney(cost);

        if (!this.canAfford(price)) {
            return false;
        }

        coins -= price;
        emit();
        return true;
    },

    onChange(listener) {
        listeners.add(listener);
        listener(coins);
        return () => listeners.delete(listener);
    },

    format(value = coins) {
        return clampMoney(value).toLocaleString();
    },

    __applyReward(amount) {
        return changeCoins(amount);
    },

    __setCoins(amount) {
        return applyCoins(amount);
    },

    __resetCoins() {
        return applyCoins(0);
    }
});
