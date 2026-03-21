const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const cache = require('../cache');

/* ------------------ TIER ------------------ */
function getTier(percent) {
    if (percent >= 8) return "🔥 INSANE";
    if (percent >= 5) return "💎 ELITE";
    if (percent >= 3) return "👍 GOOD";
    if (percent >= 1) return "⚠️ SAFE";
    return "❌ BAD";
}

/* ------------------ RANK ------------------ */
function getRankIcon(i) {
    if (i === 0) return "🥇";
    if (i === 1) return "🥈";
    if (i === 2) return "🥉";
    return `#${i + 1}`;
}

/* ------------------ VOLUME ------------------ */
function getVolumeLevel(highTime, lowTime) {
    const now = Date.now() / 1000;

    const lastBuy = now - (highTime || 0);
    const lastSell = now - (lowTime || 0);

    const avg = (lastBuy + lastSell) / 2;

    if (avg < 60) return "🔥 HIGH";
    if (avg < 300) return "⚡ MEDIUM";
    if (avg < 900) return "⚠️ LOW";
    return "❌ DEAD";
}

/* ------------------ TREND DETECTION ------------------ */
function getTrend(price) {
    const high = price.high || 0;
    const low = price.low || 0;

    if (!high || !low) return "UNKNOWN";

    const spread = high - low;
    const percent = (spread / low) * 100;

    if (percent > 5) return "📈 RISING";
    if (percent < 1.5) return "📉 FALLING";
    return "➡️ STABLE";
}

/* ------------------ ADAPTIVE PRICING ------------------ */
function getAdaptivePrices(priceData) {
    const low = priceData.low;
    const high = priceData.high;

    const spread = high - low;
    const volume = getVolumeLevel(priceData.highTime, priceData.lowTime);

    let buyMult = 1.0;
    let sellMult = 1.0;

    if (volume.includes("HIGH")) {
        buyMult = 1.005;
        sellMult = 0.995;
    } else if (volume.includes("MEDIUM")) {
        buyMult = 1.01;
        sellMult = 0.99;
    } else if (volume.includes("LOW")) {
        buyMult = 1.02;
        sellMult = 0.98;
    } else {
        buyMult = 1.03;
        sellMult = 0.97;
    }

    if (spread > 100_000) {
        buyMult += 0.005;
        sellMult -= 0.005;
    }

    if (spread < 10_000) {
        buyMult = 1.002;
        sellMult = 0.998;
    }

    return {
        buyPrice: Math.floor(low * buyMult),
        sellPrice: Math.floor(high * sellMult),
        volume
    };
}

/* ------------------ COMMAND ------------------ */

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bestflips')
        .setDescription('🔥 Smart Flip Scanner (AI + Trend + Volume)')
        .addStringOption(option =>
            option.setName('mode')
                .setDescription('Sorting mode')
                .addChoices(
                    { name: 'Best Overall', value: 'score' },
                    { name: 'High Profit', value: 'profit' },
                    { name: 'High %', value: 'margin' }
                )
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const mode = interaction.options.getString('mode') || 'score';

        const items = cache.getItems();
        const prices = cache.getPrices();

        if (!items.length || !Object.keys(prices).length) {
            return interaction.editReply('⏳ Loading market...');
        }

        const flips = [];

        for (const item of items) {

            const price = prices[item.id];
            if (!price || !price.high || !price.low) continue;

            const { buyPrice, sellPrice, volume } = getAdaptivePrices(price);

            if (buyPrice <= 0 || sellPrice <= 0) continue;

            const margin = sellPrice - buyPrice;
            const percent = (margin / buyPrice) * 100;

            if (margin < 1000 || percent < 1) continue;

            const trend = getTrend(price);
            const buyLimit = item.limit || 100;

            /* 🧠 SCORE */
            let score = percent * 5;

            if (trend.includes("RISING")) score += 20;
            if (trend.includes("FALLING")) score -= 20;

            if (volume.includes("HIGH")) score += 20;
            if (volume.includes("LOW")) score -= 10;

            flips.push({
                name: item.name,
                buyPrice,
                sellPrice,
                margin,
                percent,
                trend,
                volume,
                score,
                profitCycle: margin * buyLimit
            });
        }

        /* ------------------ SORT ------------------ */
        if (mode === 'profit') {
            flips.sort((a, b) => b.profitCycle - a.profitCycle);
        } else if (mode === 'margin') {
            flips.sort((a, b) => b.percent - a.percent);
        } else {
            flips.sort((a, b) => b.score - a.score);
        }

        const top = flips.slice(0, 10);

        if (!top.length) {
            return interaction.editReply('❌ No flips found.');
        }

        /* ------------------ DISPLAY ------------------ */

        const lines = top.map((f, i) => {
            return (
                `${getRankIcon(i)} **${f.name}**\n` +
                `└ 📉 Buy: ${f.buyPrice.toLocaleString()} gp\n` +
                `└ 📈 Sell: ${f.sellPrice.toLocaleString()} gp\n` +
                `└ 💰 Profit: ${f.margin.toLocaleString()} (${f.percent.toFixed(2)}%)\n` +
                `└ 📊 ${f.trend} • ${f.volume}\n` +
                `└ ⚡ Cycle: ${f.profitCycle.toLocaleString()} gp\n` +
                `└ 🧠 Score: ${Math.floor(f.score)} • ${getTier(f.percent)}`
            );
        });

        const embed = new EmbedBuilder()
            .setColor(0x00FFAA)
            .setTitle('🔥 BEST FLIPS — SMART ENGINE v4')
            .setDescription(lines.join('\n\n'))
            .setFooter({ text: 'TFTP AI Flip System' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    }
};
