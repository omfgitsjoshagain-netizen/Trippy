const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const cache = require('../cache');

/* ------------------ RANK ------------------ */
function getRank(i) {
    return ["🥇", "🥈", "🥉"][i] || `#${i + 1}`;
}

/* ------------------ REAL MARKET ZONES ------------------ */
function getTradeZones(price) {
    const low = price.low;
    const high = price.high;

    if (!low || !high || high <= low) return null;

    const spread = high - low;

    if (spread < 2000) return null;

    /* 🔥 BUY ZONE (where you realistically get filled) */
    const buyMin = low;
    const buyMax = low + Math.floor(spread * 0.25);

    /* 🔥 SELL ZONE (where items realistically sell) */
    const sellMin = high - Math.floor(spread * 0.25);
    const sellMax = high;

    /* 💰 EXPECTED FLIP (middle ground) */
    const entry = Math.floor((buyMin + buyMax) / 2);
    const exit = Math.floor((sellMin + sellMax) / 2);

    const profit = exit - entry;
    const percent = (profit / entry) * 100;

    return {
        buyMin,
        buyMax,
        sellMin,
        sellMax,
        entry,
        exit,
        profit,
        percent
    };
}

/* ------------------ COMMAND ------------------ */

module.exports = {
    data: new SlashCommandBuilder()
        .setName('snipe')
        .setDescription('🎯 REALISTIC OSRS sniper (price zones)'),

    async execute(interaction) {
        await interaction.deferReply();

        const items = cache.getItems();
        const prices = cache.getPrices();

        if (!items.length || !Object.keys(prices).length) {
            return interaction.editReply('⏳ Loading market...');
        }

        const snipes = [];

        for (const item of items) {

            const price = prices[item.id];
            if (!price) continue;

            const zone = getTradeZones(price);
            if (!zone) continue;

            const { entry, exit, profit, percent } = zone;

            /* 🔥 FILTER REAL SNIPES */
            if (profit < 5000) continue;
            if (percent < 2) continue;

            snipes.push({
                name: item.name,
                ...zone
            });
        }

        snipes.sort((a, b) => b.percent - a.percent);

        const top = snipes.slice(0, 10);

        if (!top.length) {
            return interaction.editReply('❌ No real snipes found.');
        }

        const lines = top.map((s, i) =>
            `${getRank(i)} **${s.name}**\n` +
            `└ 🎯 Buy Zone: ${s.buyMin.toLocaleString()} - ${s.buyMax.toLocaleString()}\n` +
            `└ 📈 Sell Zone: ${s.sellMin.toLocaleString()} - ${s.sellMax.toLocaleString()}\n` +
            `└ 💡 Suggested: ${s.entry.toLocaleString()} → ${s.exit.toLocaleString()}\n` +
            `└ 💰 Profit: ${s.profit.toLocaleString()} gp\n` +
            `└ ⚡ Edge: ${s.percent.toFixed(2)}%`
        );

        const embed = new EmbedBuilder()
            .setColor(0xFF4444)
            .setTitle('🎯 SNIPE OPPORTUNITIES — REAL MARKET MODE')
            .setDescription(lines.join('\n\n'))
            .setFooter({ text: 'TFTP Sniper (Zone-Based Trading)' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    }
};
