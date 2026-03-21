const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const cache = require('../cache');

/* ------------------ TIER ------------------ */
function getTier(score) {
    if (score >= 85) return "🔥 GOD FLIP";
    if (score >= 70) return "💎 ELITE";
    if (score >= 55) return "👍 GOOD";
    if (score >= 40) return "⚠️ DECENT";
    return "❌ AVOID";
}

/* ------------------ RANK ------------------ */
function getRank(i) {
    return ["🥇", "🥈", "🥉"][i] || `#${i + 1}`;
}

/* ------------------ VOLUME ------------------ */
function getVolume(price) {
    const now = Date.now() / 1000;

    const buyAge = now - (price.highTime || 0);
    const sellAge = now - (price.lowTime || 0);

    const avg = (buyAge + sellAge) / 2;

    if (avg < 60) return { score: 100, label: "🔥 HIGH" };
    if (avg < 300) return { score: 80, label: "⚡ MEDIUM" };
    if (avg < 900) return { score: 60, label: "👍 LOW" };
    return { score: 20, label: "❌ DEAD" };
}

/* ------------------ TREND ------------------ */
function getTrend(price) {
    const spread = price.high - price.low;
    const percent = (spread / price.low) * 100;

    if (percent > 5) return { score: 20, label: "📈 RISING" };
    if (percent < 1.5) return { score: -10, label: "📉 FALLING" };
    return { score: 5, label: "➡️ STABLE" };
}

/* ------------------ REAL PRICES ------------------ */
function getRealisticPrices(price) {
    const low = price.low;
    const high = price.high;

    const spread = high - low;
    if (spread <= 0) return null;

    let buy, sell;

    if (spread < 5000) {
        buy = low + 1;
        sell = high - 1;
    } else if (spread < 50000) {
        buy = low + Math.floor(spread * 0.1);
        sell = high - Math.floor(spread * 0.1);
    } else {
        buy = low + Math.floor(spread * 0.2);
        sell = high - Math.floor(spread * 0.2);
    }

    if (sell <= buy) return null;

    return { buyPrice: buy, sellPrice: sell, spread };
}

/* ------------------ AI SCORE ------------------ */
function getScore(percent, margin, volume, trend) {
    let score = 0;

    if (percent >= 5) score += 30;
    else if (percent >= 3) score += 20;
    else if (percent >= 1) score += 10;

    if (margin >= 1000000) score += 30;
    else if (margin >= 100000) score += 20;
    else if (margin >= 10000) score += 10;

    score += volume.score * 0.3;
    score += trend.score;

    return Math.min(100, Math.floor(score));
}

/* ------------------ COMMAND ------------------ */

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bestflips')
        .setDescription('🔥 GOD MODE Flip Predictor'),

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
            if (!price || !price.high || !price.low) continue;

            const pricing = getRealisticPrices(price);
            if (!pricing) continue;

            const { buyPrice, sellPrice, spread } = pricing;

            const margin = sellPrice - buyPrice;
            const percent = (margin / buyPrice) * 100;

            if (margin < 1000 || percent < 1) continue;

            const volume = getVolume(price);
            const trend = getTrend(price);

            const score = getScore(percent, margin, volume, trend);

            const limit = item.limit || 100;

            flips.push({
                name: item.name,
                buyPrice,
                sellPrice,
                margin,
                percent,
                volume,
                trend,
                score,
                cycle: margin * limit
            });
        }

        flips.sort((a, b) => b.score - a.score);

        const top = flips.slice(0, 10);

        const lines = top.map((f, i) =>
            `${getRank(i)} **${f.name}**\n` +
            `└ 📉 Buy: ${f.buyPrice.toLocaleString()}\n` +
            `└ 📈 Sell: ${f.sellPrice.toLocaleString()}\n` +
            `└ 💰 Profit: ${f.margin.toLocaleString()} (${f.percent.toFixed(2)}%)\n` +
            `└ 📊 ${f.trend.label} • ${f.volume.label}\n` +
            `└ ⚡ Cycle: ${f.cycle.toLocaleString()}\n` +
            `└ 🧠 ${f.score}/100 • ${getTier(f.score)}`
        );

        const embed = new EmbedBuilder()
            .setColor(0x00FFAA)
            .setTitle('🔥 GOD MODE FLIP PREDICTOR')
            .setDescription(lines.join('\n\n'))
            .setFooter({ text: 'TFTP AI Trading Engine' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    }
};
