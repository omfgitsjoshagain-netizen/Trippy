const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const cache = require('../cache');

/* ------------------ SCORE ------------------ */
function getSnipeScore(percent, margin, price) {
    let score = 0;

    // Undervalue %
    if (percent >= 10) score += 40;
    else if (percent >= 6) score += 30;
    else if (percent >= 3) score += 20;
    else if (percent >= 1) score += 10;

    // Margin size
    if (margin >= 1_000_000) score += 30;
    else if (margin >= 100_000) score += 20;
    else if (margin >= 10_000) score += 10;

    // Price tier (avoid junk)
    if (price >= 10_000_000) score += 30;
    else if (price >= 1_000_000) score += 20;
    else if (price >= 100_000) score += 10;

    return Math.min(score, 100);
}

/* ------------------ LABEL ------------------ */
function getLabel(score) {
    if (score >= 90) return "🔥 GOD SNIPE";
    if (score >= 70) return "💎 ELITE SNIPE";
    if (score >= 50) return "🎯 GOOD SNIPE";
    return "⚠️ WEAK SNIPE";
}

/* ------------------ COMMAND ------------------ */

module.exports = {
    data: new SlashCommandBuilder()
        .setName('snipe')
        .setDescription('🎯 Find underpriced OSRS items'),

    async execute(interaction) {
        try {
            await interaction.deferReply();

            const items = cache.getItems();
            const prices = cache.getPrices();

            if (!items.length || !Object.keys(prices).length) {
                return interaction.editReply('⏳ Scanning market...');
            }

            const snipes = [];

            for (const item of items) {

                const price = prices[item.id];
                if (!price || !price.high || !price.low) continue;

                const buy = price.high;
                const sell = price.low;

                if (buy <= 0 || sell <= 0) continue;

                const average = (buy + sell) / 2;
                const margin = buy - sell;

                const undervalue = ((average - sell) / average) * 100;

                // 🔥 FILTER TRASH
                if (undervalue < 2) continue;
                if (margin < 5000) continue;
                if (buy < 10000) continue;

                const score = getSnipeScore(undervalue, margin, buy);

                snipes.push({
                    name: item.name,
                    margin,
                    undervalue,
                    score,
                    price: buy
                });
            }

            // 🔥 SORT BEST SNIPES
            snipes.sort((a, b) => b.score - a.score);

            const top = snipes.slice(0, 10);

            if (!top.length) {
                return interaction.editReply('❌ No snipes found.');
            }

            const lines = top.map((s, i) => {
                return `**${i + 1}. ${s.name}**\n` +
                       `💰 ${s.margin.toLocaleString()} gp\n` +
                       `📉 ${s.undervalue.toFixed(2)}% undervalued\n` +
                       `🧠 Score: ${s.score}/100 | ${getLabel(s.score)}\n`;
            });

            const embed = new EmbedBuilder()
                .setColor(0xFF00FF)
                .setTitle('🎯 OSRS SNIPER SYSTEM')
                .setDescription(lines.join('\n'))
                .setFooter({ text: 'TFTP Sniper Engine' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error("SNIPE ERROR:", error);

            if (interaction.deferred) {
                await interaction.editReply('❌ Error scanning snipes.');
            } else {
                await interaction.reply({
                    content: '❌ Error scanning snipes.',
                    ephemeral: true
                });
            }
        }
    }
};