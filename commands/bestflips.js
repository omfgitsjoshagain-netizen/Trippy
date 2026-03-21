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

function getRankIcon(i) {
    if (i === 0) return "🥇";
    if (i === 1) return "🥈";
    if (i === 2) return "🥉";
    return `#${i + 1}`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bestflips')
        .setDescription('🔥 Flip scanner with buy/sell guidance')
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

            const buyPrice = price.low;   // 📉 YOU BUY HERE
            const sellPrice = price.high; // 📈 YOU SELL HERE

            if (buyPrice <= 0 || sellPrice <= 0) continue;

            const margin = sellPrice - buyPrice;
            const percent = (margin / buyPrice) * 100;

            if (margin < 1000 || percent < 1) continue;

            const buyLimit = item.limit || 100;

            flips.push({
                name: item.name,
                buyPrice,
                sellPrice,
                margin,
                percent,
                buyLimit,
                profitCycle: margin * buyLimit
            });
        }

        /* ------------------ SORT ------------------ */
        if (mode === 'profit') {
            flips.sort((a, b) => b.profitCycle - a.profitCycle);
        } else if (mode === 'margin') {
            flips.sort((a, b) => b.percent - a.percent);
        } else {
            flips.sort((a, b) => b.percent * b.margin - a.percent * a.margin);
        }

        const top = flips.slice(0, 10);

        if (!top.length) {
            return interaction.editReply('❌ No flips found.');
        }

        /* ------------------ FORMAT ------------------ */

        const lines = top.map((f, i) => {
            return (
                `${getRankIcon(i)} **${f.name}**\n` +
                `└ 📉 Buy: **${f.buyPrice.toLocaleString()} gp**\n` +
                `└ 📈 Sell: **${f.sellPrice.toLocaleString()} gp**\n` +
                `└ 💰 Profit: ${f.margin.toLocaleString()} gp (${f.percent.toFixed(2)}%)\n` +
                `└ 📦 Limit: ${f.buyLimit}\n` +
                `└ ⚡ Cycle: ${f.profitCycle.toLocaleString()} gp\n` +
                `└ 🚦 ${getTier(f.percent)}`
            );
        });

        const embed = new EmbedBuilder()
            .setColor(0x00FFAA)
            .setTitle('🔥 BEST FLIPS — BUY & SELL GUIDE')
            .setDescription(lines.join('\n\n'))
            .setFooter({ text: 'TFTP Flip Assistant' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    }
};
