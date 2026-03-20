const axios = require('axios');

let itemsCache = [];
let pricesCache = {};

// Load item mapping
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

// Load prices
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

// Initialize cache
async function initCache() {
    console.log('🚀 Initializing cache...');

    await loadMapping();
    await loadPrices();

    // Refresh prices every 60 seconds
    setInterval(loadPrices, 60 * 1000);
}

// Start cache automatically
initCache();

// Export functions
module.exports = {
    getItems: () => itemsCache,
    getPrices: () => pricesCache
};
