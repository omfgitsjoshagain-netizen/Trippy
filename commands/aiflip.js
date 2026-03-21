const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const cache = require('../cache');

/* ------------------ LEVENSHTEIN ------------------ */
function levenshtein(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b[i - 1] === a[j - 1]) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    return matrix[b.length][a.length];
}

/* ------------------ HYBRID MATCH ------------------ */
function findBestMatch(items, input) {
    const normalized = input.toLowerCase().trim();

    // Exact match
    const exact = items.find(i => i.name.toLowerCase() === normalized);
    if (exact) return exact;

    // Partial match
    const partial = items.filter(i =>
        i.name.toLowerCase().includes(normalized)
    );
    if (partial.length === 1) return partial[0];
    if (partial.length > 1) return partial[0];

    // Fuzzy fallback
    if (normalized.length < 3) return null;

    let best = null;
    let bestScore = Infinity;

    for (const item of items) {
        const score = levenshtein(normalized, item.name.toLowerCase());
        if (score < bestScore) {
            bestScore = score;
            best = item;
        }
    }

    const max = Math.floor(normalized.length * 0.3);
    return bestScore <= max ? best : null;
}

/* ------------------ AI SCORE ------------------ */
function getAIScore(percent, margin, price) {
    let score = 0;

    // Margin %
    if (percent >= 8) score += 35;
    else if (percent >= 5) score += 25;
    else if (percent >= 3) score += 15;
    else if (percent >= 1) score += 5;

    // Margin size
    if (margin >= 1_000_000) score += 25;
    else if (margin >= 100_000) score += 15;
    else if (margin >= 10_000) score += 5;

    // Price tier (stability)
    if (price >= 10_000_000) score += 20;
    else if (price >= 1_000_000) score += 10;

    // Fake margin protection
    if (percent > 15) score -= 20;

    return Math.max(0, Math.min(score, 100));
}

/* ------------------ TREND ENGINE ------------------ */
function getTrend(score, percent) {
    if (score >= 70 && percent >= 3) {
        return { label: "🟢 BUY PRESSURE", decision: "BUY", color: 0x00FF00 };
    }

    if (score >= 40) {
        return { label: "⚖️ STABLE", decision: "HOLD", color: 0xFFFF00 };
    }

    return { label: "🔴 DUMP RISK", decision: "AVOID", color: 0xFF0000 };
}

/* ------------------ COMMAND ------------------ */

module.exports = {
    data: new SlashCommandBuilder()
        .setName('aiflip')
        .setDescription('🧠 AI flip prediction system')
        .addStringOption(option =>
            option.setName('item')
                .setDescription('Item name (typos allowed)')
                .setRequired(true)
        ),

    async execute(interaction) {
        try {
            await interaction.deferReply();

            const input = interaction.options.getString('item');

            const items = cache.getItems();
            const prices = cache.getPrices();

            if (!items.length || !Object.keys(prices).length) {
                return interaction.editReply('⏳ Loading market data...');
            }

            const item = findBestMatch(items, input);

            if (!item) {
                return interaction.editReply(`❌ Item not found: ${input}`);
            }

            const price = prices[item.id];

            if (!price || !price.high || !price.low) {
                return interaction.editReply('❌ Price data unavailable.');
            }

            const buy = price.high;
            const sell = price.low;

            const margin = buy - sell;
            const percent = (margin / sell) * 100;

            const aiScore = getAIScore(percent, margin, buy);
            const trend = getTrend(aiScore, percent);

            const embed = new EmbedBuilder()
                .setColor(trend.color)
                .setTitle(`🧠 AI Flip Prediction: ${item.name}`)
                .addFields(
                    { name: "📈 Buy", value: `${buy.toLocaleString()} gp`, inline: true },
                    { name: "📉 Sell", value: `${sell.toLocaleString()} gp`, inline: true },
                    { name: "💰 Margin", value: `${margin.toLocaleString()} gp`, inline: true },

                    { name: "📊 Margin %", value: `${percent.toFixed(2)}%`, inline: true },
                    { name: "🧠 AI Score", value: `${aiScore}/100`, inline: true },
                    { name: "📡 Market Signal", value: trend.label },

                    { name: "🚦 Decision", value: `**${trend.decision}**` }
                )
                .setFooter({ text: "TFTP AI Flip Predictor" })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error("AI FLIP ERROR:", error);

            if (interaction.deferred || interaction.replied) {
                await interaction.editReply('❌ Error predicting flip.');
            } else {
                await interaction.reply({
                    content: '❌ Error predicting flip.',
                    ephemeral: true
                });
            }
        }
    }
};
