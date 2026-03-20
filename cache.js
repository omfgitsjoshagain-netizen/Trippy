const axios = require('axios');

let itemsCache = [];
let pricesCache = {};

/* ------------------ LOAD DATA ------------------ */

async function loadMapping() {
    try {
        const response = await axios.get(
            'https://prices.runescape.wiki/api/v1/osrs/mapping'
        );
        itemsCache = response.data;
        console.log('✅ Item mapping cached.');
    } catch (error) {
        console.error('❌ Failed to load mapping:', error.message);
    }
}

async function loadPrices() {
    try {
        const response = await axios.get(
            'https://prices.runescape.wiki/api/v1/osrs/latest'
        );
        pricesCache = response.data.data;
        console.log('💰 Prices cache updated.');
    } catch (error) {
        console.error('❌ Failed to load prices:', error.message);
    }
}

/* ------------------ START CACHE ------------------ */

async function initCache() {
    console.log('🚀 Initializing cache...');

    await loadMapping();
    await loadPrices();

    // Refresh prices every 60 seconds
    setInterval(loadPrices, 60 * 1000);
}

/* ------------------ GETTERS ------------------ */

function getItems() {
    return itemsCache;
}

function getPrices() {
    return pricesCache;
}

/* ------------------ AUTO START ON IMPORT ------------------ */
initCache();

module.exports = {
    getItems,
    getPrices
};}

function getPrices() {
    return pricesCache;
}

module.exports = {
    loadMapping,
    loadPrices,
    startPriceUpdater,
    getItems,
    getPrices
};
