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
    if (!input) return null;

    const normalized = input.toLowerCase().trim();

    // Exact
    const exact = items.find(i => i.name.toLowerCase() === normalized);
    if (exact) return exact;

    // Partial
    const partial = items.filter(i =>
        i.name.toLowerCase().includes(normalized)
    );

    if (partial.length === 1) return partial[0];

    if (partial.length > 1) {
        return partial.sort(
            (a, b) =>
                Math.abs(a.name.length - normalized.length) -
                Math.abs(b.name.length - normalized.length)
        )[0];
    }

    // Fuzzy
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

    const maxDistance = Math.floor(normalized.length * 0.3);
    return bestScore <= maxDistance ? best : null;
}

/* ------------------ AI SCORE ------------------ */
function calculateScore(percent, margin, price) {
    let score = 0;

    if (percent >= 8) score += 40;
    else if (percent >= 5) score += 30;
    else if (percent >= 3) score += 20;
    else if (percent >= 1) score += 10;

    if (margin >= 1_000_000) score += 30;
    else if (margin >= 100_000) score += 20;
    else if (margin >= 10_000) score += 10;

    if (price >= 10_000_000) score += 30;
    else if (price >= 1_000_000) score += 20;
    else if (price >= 100_000) score += 10;

    if (percent > 15) score -= 20;

    return Math.max(0, Math.min(score, 100));
}

/* ------------------ SIGNAL ------------------ */
function getSignal(score, percent) {
    if (score >= 80 && percent >= 3) {
        return { label: "🟢 BUY", color: 0x00FF00 };
    }

    if (score >= 50) {
        return { label: "⚖️ HOLD", color: 0xFFFF00 };
    }

    return { label: "🔴 AVOID", color: 0xFF0000 };
}

/* ------------------ TIER ------------------ */
function getTier(score) {
    if (score >= 90) return "🔥 GOD FLIP";
    if (score >= 75) return "💎 ELITE FLIP";
    if (score >= 60) return "👍 GOOD FLIP";
    if (score >= 40) return "⚠️ DECENT";
    return "❌ BAD FLIP";
}

/* ------------------ COMMAND ------------------ */

module.exports = {
    data: new SlashCommandBuilder()
        .setName('flip')
        .setDescription('🔥 Ultimate OSRS flip analyzer (no utils)')
        .addStringOption(option =>
            option.setName('item')
                .setDescription('Item name')
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addIntegerOption(option =>
            option.setName('qty')
                .setDescription('Quantity')
        ),

    /* ------------------ AUTOCOMPLETE ------------------ */
    async autocomplete(interaction) {
        try {
            const items = cache.getItems();
            if (!items.length) return interaction.respond([]);

            const input = interaction.options.getFocused() || "";
            const query = input.toLowerCase();

            const results = items
                .filter(i => i.name.toLowerCase().includes(query))
                .slice(0, 25)
                .map(i => ({
                    name: i.name,
                    value: i.name
                }));

            await interaction.respond(results);
        } catch {
            await interaction.respond([]);
        }
    },

    /* ------------------ EXECUTE ------------------ */
    async execute(interaction) {
        try {
            await interaction.deferReply();

            const input = interaction.options.getString('item');
            const qty = interaction.options.getInteger('qty') || 1;

            const items = cache.getItems();
            const prices = cache.getPrices();

            if (!items.length || !Object.keys(prices).length) {
                return interaction.editReply('⏳ Loading market...');
            }

            const item = findBestMatch(items, input);

            if (!item) {
                return interaction.editReply(`❌ Item not found: ${input}`);
            }

            const price = prices[item.id];

            if (!price || !price.high || !price.low) {
                return interaction.editReply('❌ Price unavailable.');
            }

            const buy = price.high;
            const sell = price.low;

            const margin = buy - sell;
            const percent = (margin / sell) * 100;

            const score = calculateScore(percent, margin, buy);
            const signal = getSignal(score, percent);
            const tier = getTier(score);

            const profitEach = margin;
            const profitInv = margin * 28;
            const profitTotal = margin * qty;

            const embed = new EmbedBuilder()
                .setColor(signal.color)
                .setTitle(`📊 ${item.name} — Flip Analysis`)
                .addFields(
                    { name: "📈 Buy", value: `${buy.toLocaleString()} gp`, inline: true },
                    { name: "📉 Sell", value: `${sell.toLocaleString()} gp`, inline: true },
                    { name: "💰 Margin", value: `${margin.toLocaleString()} gp`, inline: true },

                    { name: "📊 Margin %", value: `${percent.toFixed(2)}%`, inline: true },
                    { name: "🧠 Score", value: `${score}/100`, inline: true },
                    { name: "🚦 Signal", value: signal.label },

                    { name: "🪙 x1 Profit", value: `${profitEach.toLocaleString()} gp`, inline: true },
                    { name: "🎒 x28 Profit", value: `${profitInv.toLocaleString()} gp`, inline: true },
                    { name: "📦 Your Qty", value: `${profitTotal.toLocaleString()} gp`, inline: true },

                    { name: "🏆 Tier", value: `**${tier}**` }
                )
                .setFooter({ text: "TFTP Flip Engine" })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error("FLIP ERROR:", error);

            if (interaction.deferred || interaction.replied) {
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
