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

/* ------------------ MATCH ------------------ */
function findBestMatch(items, input) {
    const name = input.toLowerCase().trim();

    const exact = items.find(i => i.name.toLowerCase() === name);
    if (exact) return exact;

    const partial = items.filter(i =>
        i.name.toLowerCase().includes(name)
    );
    if (partial.length) return partial[0];

    let best = null;
    let bestScore = Infinity;

    for (const item of items) {
        const score = levenshtein(name, item.name.toLowerCase());
        if (score < bestScore) {
            bestScore = score;
            best = item;
        }
    }

    return best;
}

/* ------------------ GOD SCORE ------------------ */
function calculateScore(percent, margin, price) {
    let score = 0;

    // Margin %
    if (percent >= 8) score += 40;
    else if (percent >= 5) score += 30;
    else if (percent >= 3) score += 20;
    else if (percent >= 1) score += 10;

    // Raw margin
    if (margin >= 1_000_000) score += 30;
    else if (margin >= 100_000) score += 20;
    else if (margin >= 10_000) score += 10;

    // Price tier (avoid junk items)
    if (price >= 10_000_000) score += 30;
    else if (price >= 1_000_000) score += 20;
    else if (price >= 100_000) score += 10;

    return Math.min(score, 100);
}

/* ------------------ SIGNAL ------------------ */
function getSignal(score) {
    if (score >= 90) return "🔥 GOD FLIP";
    if (score >= 70) return "💎 ELITE FLIP";
    if (score >= 50) return "👍 GOOD FLIP";
    return "❌ AVOID";
}

/* ------------------ COMMAND ------------------ */

module.exports = {
    data: new SlashCommandBuilder()
        .setName('flip')
        .setDescription('🔥 GOD MODE flip analyzer')
        .addStringOption(option =>
            option.setName('item')
                .setDescription('item:qty')
                .setRequired(true)
        ),

    async execute(interaction) {
        try {
            await interaction.deferReply();

            const input = interaction.options.getString('item');
            const items = cache.getItems();
            const prices = cache.getPrices();

            if (!items.length || !Object.keys(prices).length) {
                return interaction.editReply('⏳ Loading market...');
            }

            let name;
            let qty = 1;

            if (input.includes(':')) {
                const [n, q] = input.split(':');
                name = n.trim();
                qty = parseInt(q);
            } else {
                name = input.trim();
            }

            const item = findBestMatch(items, name);
            if (!item) return interaction.editReply('❌ Item not found.');

            const price = prices[item.id];
            if (!price || !price.high || !price.low) {
                return interaction.editReply('❌ No price data.');
            }

            const buy = price.high;
            const sell = price.low;

            const margin = buy - sell;
            const percent = (margin / sell) * 100;

            const score = calculateScore(percent, margin, buy);
            const signal = getSignal(score);

            const profitEach = margin;
            const profitInv = margin * 28;
            const profitTotal = margin * qty;
            const profitCycle = margin * 100;

            const embed = new EmbedBuilder()
                .setColor(score >= 70 ? 0x00FF00 : 0xFF0000)
                .setTitle(`📊 ${item.name} GOD FLIP ANALYSIS`)
                .addFields(
                    { name: "📈 Buy", value: `${buy.toLocaleString()} gp`, inline: true },
                    { name: "📉 Sell", value: `${sell.toLocaleString()} gp`, inline: true },
                    { name: "💰 Margin", value: `${margin.toLocaleString()} gp`, inline: true },

                    { name: "📊 Margin %", value: `${percent.toFixed(2)}%`, inline: true },
                    { name: "🧠 Flip Score", value: `${score}/100`, inline: true },
                    { name: "🚦 Signal", value: signal },

                    { name: "🪙 Profit (x1)", value: `${profitEach.toLocaleString()} gp`, inline: true },
                    { name: "🎒 Profit (x28)", value: `${profitInv.toLocaleString()} gp`, inline: true },
                    { name: "📦 Your Qty", value: `${profitTotal.toLocaleString()} gp`, inline: true },

                    { name: "⚡ GE Cycle Est.", value: `${profitCycle.toLocaleString()} gp` }
                )
                .setFooter({ text: "TFTP GOD MODE ENGINE" })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (err) {
            console.error("FLIP ERROR:", err);

            if (interaction.deferred) {
                await interaction.editReply('❌ Error analyzing flip.');
            } else {
                await interaction.reply({
                    content: '❌ Error analyzing flip.',
                    ephemeral: true
                });
            }
        }
    }
};
