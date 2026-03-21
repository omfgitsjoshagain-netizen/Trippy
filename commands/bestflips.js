const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const cache = require('../cache');

/* ------------------ RANK ------------------ */
function getRank(i) {
    return ["🥇", "🥈", "🥉"][i] || `#${i + 1}`;
}

/* ------------------ TIER ------------------ */
function getTier(percent) {
    if (percent >= 6) return "🔥 INSANE";
    if (percent >= 4) return "💎 ELITE";
    if (percent >= 2.5) return "👍 GOOD";
    if (percent >= 1.5) return "⚠️ SAFE";
    return "❌ BAD";
}

/* ------------------ REALISTIC PRICING ------------------ */
function getRealisticPrices(price) {
    const low = price.low;
    const high = price.high;

    if (!low || !high || high <= low) return null;

    const spread = high - low;

    let buyPrice;
    let sellPrice;

    if (spread <= 1000) {
        buyPrice = low;
        sellPrice = high;
    } else if (spread <= 10000) {
        buyPrice = low + Math.floor(spread * 0.05);
        sellPrice = high - Math.floor(spread * 0.05);
    } else if (spread <= 100000) {
        buyPrice = low + Math.floor(spread * 0.1);
        sellPrice = high - Math.floor(spread * 0.1);
    } else {
        buyPrice = low + Math.floor(spread * 0.15);
        sellPrice = high - Math.floor(spread * 0.15);
    }

    if (sellPrice <= buyPrice) return null;

    return {
        buyPrice,
        sellPrice,
        spread
    };
}

/* ------------------ COMMAND ------------------ */

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bestflips')
        .setDescription('🔥 Realistic flip finder with modes')
        .addStringOption(option =>
            option.setName('mode')
                .setDescription('Sorting mode')
                .addChoices(
                    { name: 'Best Overall', value: 'score' },
                    { name: 'High Profit GP', value: 'profit' },
                    { name: 'High Margin %', value: 'margin' },
                    { name: 'Safe Flips', value: 'safe' }
                )
        )
        .addIntegerOption(option =>
            option.setName('budget')
                .setDescription('Max item price (optional)')
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const mode = interaction.options.getString('mode') || 'score';
        const budget = interaction.options.getInteger('budget');

        const items = cache.getItems();
        const prices = cache.getPrices();

        if (!items.length || !Object.keys(prices).length) {
            return interaction.editReply('⏳ Loading market...');
        }

        const flips = [];

        for (const item of items) {
            const price = prices[item.id];
            if (!price) continue;

            const pricing = getRealisticPrices(price);
            if (!pricing) continue;

            const { buyPrice, sellPrice } = pricing;

            if (budget && buyPrice > budget) continue;

            const margin = sellPrice - buyPrice;
            const percent = (margin / buyPrice) * 100;

            if (margin < 2000) continue;
            if (percent < 1.2) continue;
            if (buyPrice < 5000) continue;

            const limit = item.limit || 100;

            flips.push({
                name: item.name,
                buyPrice,
                sellPrice,
                margin,
                percent,
                cycle: margin * limit,
                inv: margin * 28
            });
        }

        /* ------------------ SORTING ------------------ */

        if (mode === 'profit') {
            flips.sort((a, b) => b.cycle - a.cycle);
        } 
        else if (mode === 'margin') {
            flips.sort((a, b) => b.percent - a.percent);
        } 
        else if (mode === 'safe') {
            flips.sort((a, b) => a.percent - b.percent);
        } 
        else {
            // Best overall
            flips.sort((a, b) =>
                (b.margin * b.percent) - (a.margin * a.percent)
            );
        }

        const top = flips.slice(0, 10);

        if (!top.length) {
            return interaction.editReply('❌ No realistic flips found.');
        }

        const lines = top.map((f, i) =>
            `${getRank(i)} **${f.name}**\n` +
            `└ 📉 Buy: ${f.buyPrice.toLocaleString()} gp\n` +
            `└ 📈 Sell: ${f.sellPrice.toLocaleString()} gp\n` +
            `└ 💰 Profit: ${f.margin.toLocaleString()} gp (${f.percent.toFixed(2)}%)\n` +
            `└ 🎒 Inv: ${f.inv.toLocaleString()} gp\n` +
            `└ ⚡ Cycle: ${f.cycle.toLocaleString()} gp\n` +
            `└ 🚦 ${getTier(f.percent)}`
        );

        const embed = new EmbedBuilder()
            .setColor(0x00FFAA)
            .setTitle('🔥 BEST FLIPS — REALISTIC + MODES')
            .setDescription(lines.join('\n\n'))
            .addFields({
                name: "⚙️ Mode",
                value: `**${mode.toUpperCase()}**`,
                inline: true
            })
            .setFooter({ text: 'TFTP Flip Engine' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    }
};
