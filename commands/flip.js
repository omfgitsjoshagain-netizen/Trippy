const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const cache = require('../cache');
const { findBestMatch } = require('../utils/matcher');

/* ------------------ AI SCORE ------------------ */
function calculateScore(percent, margin, price) {
    let score = 0;

    // Margin %
    if (percent >= 8) score += 40;
    else if (percent >= 5) score += 30;
    else if (percent >= 3) score += 20;
    else if (percent >= 1) score += 10;

    // Margin size
    if (margin >= 1_000_000) score += 30;
    else if (margin >= 100_000) score += 20;
    else if (margin >= 10_000) score += 10;

    // Price tier (stability)
    if (price >= 10_000_000) score += 30;
    else if (price >= 1_000_000) score += 20;
    else if (price >= 100_000) score += 10;

    // Fake margin protection
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

/* ------------------ GP PARSER ------------------ */
function parseQty(input) {
    if (!input) return 1;
    const n = parseInt(input);
    return isNaN(n) || n <= 0 ? 1 : n;
}

/* ------------------ COMMAND ------------------ */

module.exports = {
    data: new SlashCommandBuilder()
        .setName('flip')
        .setDescription('🔥 Ultimate OSRS flip analyzer')
        .addStringOption(option =>
            option.setName('item')
                .setDescription('Item name')
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addIntegerOption(option =>
            option.setName('qty')
                .setDescription('Quantity (default = 1)')
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
            const qty = parseQty(interaction.options.getInteger('qty'));

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
            const profitCycle = margin * 100;

            const embed = new EmbedBuilder()
                .setColor(signal.color)
                .setTitle(`📊 ${item.name} — Ultimate Flip Analysis`)
                .addFields(
                    { name: "📈 Buy", value: `${buy.toLocaleString()} gp`, inline: true },
                    { name: "📉 Sell", value: `${sell.toLocaleString()} gp`, inline: true },
                    { name: "💰 Margin", value: `${margin.toLocaleString()} gp`, inline: true },

                    { name: "📊 Margin %", value: `${percent.toFixed(2)}%`, inline: true },
                    { name: "🧠 AI Score", value: `${score}/100`, inline: true },
                    { name: "🚦 Signal", value: signal.label },

                    { name: "🪙 Profit (x1)", value: `${profitEach.toLocaleString()} gp`, inline: true },
                    { name: "🎒 Profit (x28)", value: `${profitInv.toLocaleString()} gp`, inline: true },
                    { name: "📦 Your Qty", value: `${profitTotal.toLocaleString()} gp`, inline: true },

                    { name: "⚡ GE Cycle Est.", value: `${profitCycle.toLocaleString()} gp`, inline: true },
                    { name: "🏆 Tier", value: `**${tier}**` }
                )
                .setFooter({ text: "TFTP Ultimate Flip Engine" })
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
