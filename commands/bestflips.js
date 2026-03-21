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

/* ------------------ VOLATILITY SYSTEM ------------------ */
function getVolatility(price) {
    const now = Date.now() / 1000;

    const buyAge = now - (price.highTime || 0);
    const sellAge = now - (price.lowTime || 0);

    const avg = (buyAge + sellAge) / 2;

    if (avg < 60) return "⚡ FAST";
    if (avg < 300) return "🔥 ACTIVE";
    if (avg < 900) return "🧊 SLOW";
    return "💀 DEAD";
}

/* ------------------ REAL TRADE ZONES ------------------ */
function getTradeZones(price) {
    const low = price.low;
    const high = price.high;

    if (!low || !high || high <= low) return null;

    const spread = high - low;

    if (spread < 2000) return null;

    const buyMin = low;
    const buyMax = low + Math.floor(spread * 0.25);

    const sellMin = high - Math.floor(spread * 0.25);
    const sellMax = high;

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
        .setName('bestflips')
        .setDescription('🔥 Flip scanner (zones + volatility)')
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

            const zone = getTradeZones(price);
            if (!zone) continue;

            const volatility = getVolatility(price);

            const { entry, exit, profit, percent } = zone;

            if (budget && entry > budget) continue;

            /* 🔥 FILTERS */
            if (profit < 2000) continue;
            if (percent < 1.2) continue;
            if (entry < 5000) continue;

            const limit = item.limit || 100;

            flips.push({
                name: item.name,
                ...zone,
                volatility,
                cycle: profit * limit,
                inv: profit * 28
            });
        }

        /* ------------------ SORT ------------------ */

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
            flips.sort((a, b) =>
                (b.profit * b.percent) - (a.profit * a.percent)
            );
        }

        const top = flips.slice(0, 10);

        if (!top.length) {
            return interaction.editReply('❌ No realistic flips found.');
        }

        const lines = top.map((f, i) =>
            `${getRank(i)} **${f.name}**\n` +
            `└ 🎯 Buy: ${f.buyMin.toLocaleString()} - ${f.buyMax.toLocaleString()}\n` +
            `└ 🎯 Sell: ${f.sellMin.toLocaleString()} - ${f.sellMax.toLocaleString()}\n` +
            `└ 💡 ${f.entry.toLocaleString()} → ${f.exit.toLocaleString()}\n` +
            `└ 💰 ${f.profit.toLocaleString()} gp (${f.percent.toFixed(2)}%)\n` +
            `└ ⚡ ${f.volatility}\n` +
            `└ 🎒 ${f.inv.toLocaleString()} | ⚡ ${f.cycle.toLocaleString()}\n` +
            `└ 🚦 ${getTier(f.percent)}`
        );

        const embed = new EmbedBuilder()
            .setColor(0x00FFAA)
            .setTitle('🔥 BEST FLIPS — VOLATILITY ENGINE')
            .setDescription(lines.join('\n\n'))
            .addFields({
                name: "⚙️ Mode",
                value: `**${mode.toUpperCase()}**`,
                inline: true
            })
            .setFooter({ text: 'TFTP Smart Flip System' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    }
};
