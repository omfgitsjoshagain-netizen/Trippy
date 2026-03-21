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

/* ------------------ VOLUME SCORE ------------------ */
function getVolumeScore(highTime, lowTime) {
    const now = Date.now() / 1000;

    const lastBuy = now - (highTime || 0);
    const lastSell = now - (lowTime || 0);

    const avg = (lastBuy + lastSell) / 2;

    if (avg < 60) return { score: 100, label: "🔥 VERY HIGH" };
    if (avg < 300) return { score: 80, label: "⚡ HIGH" };
    if (avg < 900) return { score: 60, label: "👍 MEDIUM" };
    if (avg < 3600) return { score: 30, label: "⚠️ LOW" };
    return { score: 10, label: "❌ DEAD" };
}

/* ------------------ FLIP SCORE ------------------ */
function getFlipScore(percent, margin, volumeScore) {
    let score = 0;

    // Margin %
    if (percent >= 8) score += 40;
    else if (percent >= 5) score += 30;
    else if (percent >= 3) score += 20;
    else if (percent >= 1) score += 10;

    // Raw profit
    if (margin >= 1_000_000) score += 30;
    else if (margin >= 100_000) score += 20;
    else if (margin >= 10_000) score += 10;

    // Volume weight
    score += volumeScore * 0.3;

    return Math.min(100, Math.floor(score));
}

/* ------------------ HOT DETECTOR ------------------ */
function isHotFlip(score, volumeScore) {
    return score >= 70 && volumeScore >= 60;
}

/* ------------------ COMMAND ------------------ */

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bestflips')
        .setDescription('🔥 AI + Volume Flip Scanner')
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

            const buy = price.high;
            const sell = price.low;

            if (buy <= 0 || sell <= 0) continue;

            const margin = buy - sell;
            const percent = (margin / sell) * 100;

            if (margin < 1000 || percent < 1) continue;

            const buyLimit = item.limit || 100;

            /* 🔥 VOLUME */
            const volume = getVolumeScore(price.highTime, price.lowTime);

            /* 🧠 SCORE */
            const score = getFlipScore(percent, margin, volume.score);

            flips.push({
                name: item.name,
                margin,
                percent,
                buyLimit,
                volume,
                score,
                hot: isHotFlip(score, volume.score),
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

        const lines = top.map((f, i) => {
            return (
                `${getRankIcon(i)} ${f.hot ? "🔥" : ""} **${f.name}**\n` +
                `└ 💰 ${f.margin.toLocaleString()} gp • ${f.percent.toFixed(2)}%\n` +
                `└ ⚡ Vol: ${f.volume.label}\n` +
                `└ 📦 Limit: ${f.buyLimit}\n` +
                `└ 💸 Cycle: ${f.profitCycle.toLocaleString()} gp\n` +
                `└ 🧠 Score: ${f.score}/100 • ${getTier(f.percent)}`
            );
        });

        const embed = new EmbedBuilder()
            .setColor(0x00FFAA)
            .setTitle('🔥 BEST FLIPS — AI + VOLUME ENGINE')
            .setDescription(lines.join('\n\n'))
            .setFooter({ text: 'TFTP Smart Flip System v3' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    }
};
