const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const cache = require('../cache');

/* ------------------ RANK ------------------ */
function getRank(i) {
    return ["🥇", "🥈", "🥉"][i] || `#${i + 1}`;
}

/* ------------------ TIER ------------------ */
function getTier(percent) {
    if (percent >= 6) return "🔥 INSANE";
    if (percent >= 4) return "💎 ELITE";
    if (percent >= 2.5) return "👍 GOOD";
    if (percent >= 1.5) return "⚠️ SAFE";
    return "❌ BAD";
}

/* ------------------ REALISTIC PRICING ENGINE ------------------ */
function getRealisticPrices(price) {
    const low = price.low;
    const high = price.high;

    if (!low || !high || high <= low) return null;

    const spread = high - low;

    let buyPrice;
    let sellPrice;

    /* 🔥 VERY SMALL SPREAD */
    if (spread <= 1000) {
        buyPrice = low;
        sellPrice = high;
    }

    /* ⚡ SMALL SPREAD */
    else if (spread <= 10000) {
        buyPrice = low + Math.floor(spread * 0.05);
        sellPrice = high - Math.floor(spread * 0.05);
    }

    /* 💰 MEDIUM SPREAD */
    else if (spread <= 100000) {
        buyPrice = low + Math.floor(spread * 0.1);
        sellPrice = high - Math.floor(spread * 0.1);
    }

    /* 🚀 LARGE SPREAD */
    else {
        buyPrice = low + Math.floor(spread * 0.15);
        sellPrice = high - Math.floor(spread * 0.15);
    }

    if (sellPrice <= buyPrice) return null;

    return {
        buyPrice,
        sellPrice,
        spread
    };
}

/* ------------------ COMMAND ------------------ */

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bestflips')
        .setDescription('🔥 REALISTIC Flip Finder'),

    async execute(interaction) {
        await interaction.deferReply();

        const items = cache.getItems();
        const prices = cache.getPrices();

        if (!items.length || !Object.keys(prices).length) {
            return interaction.editReply('⏳ Loading market...');
        }

        const flips = [];

        for (const item of items) {
            const price = prices[item.id];
            if (!price) continue;

            const pricing = getRealisticPrices(price);
            if (!pricing) continue;

            const { buyPrice, sellPrice } = pricing;

            const margin = sellPrice - buyPrice;
            const percent = (margin / buyPrice) * 100;

            /* 🔥 STRICT FILTERS (IMPORTANT) */
            if (margin < 2000) continue;
            if (percent < 1.2) continue;
            if (buyPrice < 5000) continue;

            const limit = item.limit || 100;
            const cycle = margin * limit;
            const inv = margin * 28;

            flips.push({
                name: item.name,
                buyPrice,
                sellPrice,
                margin,
                percent,
                cycle,
                inv
            });
        }

        /* 🔥 SORT BY BEST REAL PROFIT */
        flips.sort((a, b) => (b.percent * b.margin) - (a.percent * a.margin));

        const top = flips.slice(0, 10);

        if (!top.length) {
            return interaction.editReply('❌ No realistic flips found.');
        }

        const lines = top.map((f, i) =>
            `${getRank(i)} **${f.name}**\n` +
            `└ 📉 Buy: ${f.buyPrice.toLocaleString()} gp\n` +
            `└ 📈 Sell: ${f.sellPrice.toLocaleString()} gp\n` +
            `└ 💰 Profit: ${f.margin.toLocaleString()} gp (${f.percent.toFixed(2)}%)\n` +
            `└ 🎒 Inv: ${f.inv.toLocaleString()} gp\n` +
            `└ ⚡ Cycle: ${f.cycle.toLocaleString()} gp\n` +
            `└ 🚦 ${getTier(f.percent)}`
        );

        const embed = new EmbedBuilder()
            .setColor(0x00FFAA)
            .setTitle('🔥 BEST FLIPS — REALISTIC MODE')
            .setDescription(lines.join('\n\n'))
            .setFooter({ text: 'TFTP Real Flip Engine' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    }
};
