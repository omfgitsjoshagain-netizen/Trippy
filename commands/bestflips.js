const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const cache = require('../cache');

/* ------------------ RATING ------------------ */
function getTier(percent) {
    if (percent >= 8) return "🔥 INSANE";
    if (percent >= 5) return "💎 ELITE";
    if (percent >= 3) return "👍 GOOD";
    if (percent >= 1) return "⚠️ OK";
    return "❌ BAD";
}

/* ------------------ COMMAND ------------------ */

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bestflips')
        .setDescription('🔥 Find best OSRS flips right now'),

    async execute(interaction) {
        try {
            await interaction.deferReply();

            const items = cache.getItems();
            const prices = cache.getPrices();

            if (!items.length || !Object.keys(prices).length) {
                return interaction.editReply('⏳ Loading price data...');
            }

            const flips = [];

            for (const item of items) {

                const price = prices[item.id];
                if (!price || !price.high || !price.low) continue;

                const buy = price.high;
                const sell = price.low;

                const margin = buy - sell;
                if (margin <= 0) continue;

                const percent = (margin / sell) * 100;

                // 🔥 FILTER BAD ITEMS
                if (margin < 1000) continue;        // too low profit
                if (percent < 1) continue;          // too low margin
                if (buy < 5000) continue;           // junk items

                flips.push({
                    name: item.name,
                    margin,
                    percent,
                    buy
                });
            }

            // 🔥 SORT BEST FIRST
            flips.sort((a, b) => {
                // prioritize % first, then margin
                if (b.percent === a.percent) {
                    return b.margin - a.margin;
                }
                return b.percent - a.percent;
            });

            const top = flips.slice(0, 10);

            if (!top.length) {
                return interaction.editReply('❌ No good flips found.');
            }

            const lines = top.map((f, i) => {
                return `**${i + 1}. ${f.name}**\n` +
                       `💰 Margin: ${f.margin.toLocaleString()} gp\n` +
                       `📊 ${f.percent.toFixed(2)}% | ${getTier(f.percent)}\n`;
            });

            const embed = new EmbedBuilder()
                .setColor(0x00FFAA)
                .setTitle('🔥 BEST FLIPS RIGHT NOW')
                .setDescription(lines.join('\n'))
                .setFooter({ text: 'TFTP Flip Scanner' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error("BESTFLIPS ERROR:", error);

            if (interaction.deferred) {
                await interaction.editReply('❌ Error finding flips.');
            } else {
                await interaction.reply({
                    content: '❌ Error finding flips.',
                    ephemeral: true
                });
            }
        }
    }
};