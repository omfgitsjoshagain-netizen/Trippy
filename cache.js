const axios = require('axios');

let itemsCache = [];
let pricesCache = {};

/* ------------------ LOAD ITEM MAPPING ------------------ */
async function loadMapping() {
    try {
        const res = await axios.get(
            'https://prices.runescape.wiki/api/v1/osrs/mapping'
        );
        itemsCache = res.data;
        console.log('✅ Item mapping cached.');
    } catch (err) {
        console.error('❌ Mapping error:', err.message);
    }
}

/* ------------------ LOAD PRICES ------------------ */
async function loadPrices() {
    try {
        const res = await axios.get(
            'https://prices.runescape.wiki/api/v1/osrs/latest'
        );
        pricesCache = res.data.data;
        console.log('💰 Prices cache updated.');
    } catch (err) {
        console.error('❌ Price error:', err.message);
    }
}

/* ------------------ AUTO REFRESH ------------------ */
function startPriceUpdater() {
    setInterval(loadPrices, 60 * 1000);
}

/* ------------------ GETTERS ------------------ */
function getItems() {
    return itemsCache;
}

function getPrices() {
    return pricesCache;
}

/* ------------------ EXPORTS ------------------ */
module.exports = {
    loadMapping,
    loadPrices,
    startPriceUpdater,
    getItems,
    getPrices
};
