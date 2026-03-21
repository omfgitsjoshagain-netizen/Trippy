const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const cache = require('../cache');

/* ------------------ MATCH ------------------ */
function findItem(items, input) {
    const name = input.toLowerCase();
    return items.find(i => i.name.toLowerCase().includes(name));
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

    // Price stability
    if (price >= 10_000_000) score += 20;
    else if (price >= 1_000_000) score += 10;

    // Spread sanity (fake margin check)
    if (percent > 15) score -= 20; // likely unstable

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
                .setDescription('Item name')
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

            const item = findItem(items, input);

            if (!item) {
                return interaction.editReply('❌ Item not found.');
            }

            const price = prices[item.id];

            if (!price || !price.high || !price.low) {
                return interaction.editReply('❌ Price unavailable.');
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

            if (interaction.deferred) {
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