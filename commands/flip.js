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

    const exact = items.find(i => i.name.toLowerCase() === normalized);
    if (exact) return exact;

    const partial = items.filter(i =>
        i.name.toLowerCase().includes(normalized)
    );
    if (partial.length) return partial[0];

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

/* ------------------ SMART RATING ------------------ */
function getFlipTier(percent, margin, price) {

    // Filter trash flips
    if (margin < 50 || price < 1000) {
        return { label: "❌ TRASH FLIP", color: 0x555555 };
    }

    if (percent >= 8) {
        return { label: "🔥 INSANE FLIP", color: 0xFF0000 };
    }

    if (percent >= 5) {
        return { label: "💎 ELITE FLIP", color: 0x0099FF };
    }

    if (percent >= 3) {
        return { label: "👍 GOOD FLIP", color: 0x00FF00 };
    }

    if (percent >= 1) {
        return { label: "⚠️ LOW MARGIN", color: 0xFFA500 };
    }

    return { label: "❌ BAD FLIP", color: 0x808080 };
}

/* ------------------ COMMAND ------------------ */

module.exports = {
    data: new SlashCommandBuilder()
        .setName('flip')
        .setDescription('🔥 Advanced OSRS flipping analyzer')
        .addStringOption(option =>
            option.setName('item')
                .setDescription('item:qty (example: dragon claws:1)')
                .setRequired(true)
        ),

    async execute(interaction) {
        try {
            await interaction.deferReply();

            const input = interaction.options.getString('item');

            const items = cache.getItems();
            const prices = cache.getPrices();

            if (!items.length || !Object.keys(prices).length) {
                return interaction.editReply('⏳ Loading price data...');
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

            if (!item) {
                return interaction.editReply('❌ Item not found.');
            }

            const price = prices[item.id];

            if (!price || !price.high || !price.low) {
                return interaction.editReply('❌ Price data unavailable.');
            }

            const buy = price.high;
            const sell = price.low;

            const margin = buy - sell;
            const percent = (margin / sell) * 100;

            const profitEach = margin;
            const profitTotal = margin * qty;
            const profitInv = margin * 28;

            const tier = getFlipTier(percent, margin, buy);

            const embed = new EmbedBuilder()
                .setColor(tier.color)
                .setTitle(`📊 ${item.name} Flip Analyzer`)
                .addFields(
                    { name: "📈 Buy", value: `${buy.toLocaleString()} gp`, inline: true },
                    { name: "📉 Sell", value: `${sell.toLocaleString()} gp`, inline: true },
                    { name: "💰 Margin", value: `${margin.toLocaleString()} gp`, inline: true },

                    { name: "📊 Margin %", value: `${percent.toFixed(2)}%`, inline: true },
                    { name: "🪙 Profit (x1)", value: `${profitEach.toLocaleString()} gp`, inline: true },
                    { name: "🎒 Profit (x28)", value: `${profitInv.toLocaleString()} gp`, inline: true },

                    { name: "📦 Your Qty", value: `${profitTotal.toLocaleString()} gp`, inline: true },
                    { name: "🚦 Rating", value: `**${tier.label}**` }
                )
                .setFooter({ text: "TFTP Pro Flipper Engine" })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error("FLIP ERROR:", error);

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