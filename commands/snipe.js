const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const cache = require('../cache');

/* ------------------ RANK ------------------ */
function getRank(i) {
    return ["🥇", "🥈", "🥉"][i] || `#${i + 1}`;
}

/* ------------------ REALISTIC PRICING ------------------ */
function getRealisticMid(price) {
    const low = price.low;
    const high = price.high;

    if (!low || !high || high <= low) return null;

    const spread = high - low;

    // realistic mid price (not average, but tradable range)
    const mid = low + (spread * 0.5);

    return Math.floor(mid);
}

/* ------------------ SNIPE DETECTION ------------------ */
function getSnipeData(price) {
    const low = price.low;
    const high = price.high;

    if (!low || !high || high <= low) return null;

    const spread = high - low;

    if (spread < 2000) return null; // skip trash

    const realisticMid = getRealisticMid(price);

    const discount = realisticMid - low;
    const percent = (discount / realisticMid) * 100;

    return {
        buyPrice: low,
        expectedSell: Math.floor(high * 0.98), // realistic sell
        discount,
        percent,
        spread
    };
}

/* ------------------ COMMAND ------------------ */

module.exports = {
    data: new SlashCommandBuilder()
        .setName('snipe')
        .setDescription('🎯 Find underpriced OSRS items'),

    async execute(interaction) {
        await interaction.deferReply();

        const items = cache.getItems();
        const prices = cache.getPrices();

        if (!items.length || !Object.keys(prices).length) {
            return interaction.editReply('⏳ Loading market...');
        }

        const snipes = [];

        for (const item of items) {

            const price = prices[item.id];
            if (!price) continue;

            const snipe = getSnipeData(price);
            if (!snipe) continue;

            const { buyPrice, expectedSell, discount, percent } = snipe;

            // 🔥 STRICT SNIPE FILTERS
            if (discount < 5000) continue;
            if (percent < 2) continue;

            const profit = expectedSell - buyPrice;

            if (profit <= 0) continue;

            snipes.push({
                name: item.name,
                buyPrice,
                sellPrice: expectedSell,
                profit,
                percent
            });
        }

        /* ------------------ SORT ------------------ */
        snipes.sort((a, b) => b.percent - a.percent);

        const top = snipes.slice(0, 10);

        if (!top.length) {
            return interaction.editReply('❌ No snipes found.');
        }

        const lines = top.map((s, i) =>
            `${getRank(i)} **${s.name}**\n` +
            `└ 🎯 Snipe Buy: ${s.buyPrice.toLocaleString()} gp\n` +
            `└ 📈 Quick Sell: ${s.sellPrice.toLocaleString()} gp\n` +
            `└ 💰 Profit: ${s.profit.toLocaleString()} gp\n` +
            `└ ⚡ Undervalued: ${s.percent.toFixed(2)}%`
        );

        const embed = new EmbedBuilder()
            .setColor(0xFF4444)
            .setTitle('🎯 SNIPE OPPORTUNITIES — REALISTIC')
            .setDescription(lines.join('\n\n'))
            .setFooter({ text: 'TFTP Sniper System' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    }
};
