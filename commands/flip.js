const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const cache = require('../cache');

/* ------------------ LEVENSHTEIN ------------------ */
function levenshtein(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            matrix[i][j] =
                b[i - 1] === a[j - 1]
                    ? matrix[i - 1][j - 1]
                    : Math.min(
                          matrix[i - 1][j - 1] + 1,
                          matrix[i][j - 1] + 1,
                          matrix[i - 1][j] + 1
                      );
        }
    }
    return matrix[b.length][a.length];
}

/* ------------------ MATCH ------------------ */
function findBestMatch(items, input) {
    const normalized = input.toLowerCase();

    const exact = items.find(i => i.name.toLowerCase() === normalized);
    if (exact) return exact;

    const partial = items.filter(i =>
        i.name.toLowerCase().includes(normalized)
    );
    if (partial.length) return partial[0];

    let best = null;
    let bestScore = Infinity;

    for (const item of items) {
        const score = levenshtein(normalized, item.name.toLowerCase());
        if (score < bestScore) {
            bestScore = score;
            best = item;
        }
    }

    return best;
}

/* ------------------ VOLATILITY ------------------ */
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

/* ------------------ TRADE ZONES ------------------ */
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

/* ------------------ TIER ------------------ */
function getTier(percent) {
    if (percent >= 6) return "🔥 INSANE";
    if (percent >= 4) return "💎 ELITE";
    if (percent >= 2.5) return "👍 GOOD";
    if (percent >= 1.5) return "⚠️ SAFE";
    return "❌ BAD";
}

/* ------------------ COMMAND ------------------ */

module.exports = {
    data: new SlashCommandBuilder()
        .setName('flip')
        .setDescription('Analyze a single OSRS flip')
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

            const item = findBestMatch(items, input);
            if (!item) {
                return interaction.editReply('❌ Item not found.');
            }

            const price = prices[item.id];
            if (!price) {
                return interaction.editReply('❌ Price unavailable.');
            }

            const zone = getTradeZones(price);
            if (!zone) {
                return interaction.editReply('❌ Not flippable (low spread).');
            }

            const volatility = getVolatility(price);

            const limit = item.limit || 100;

            const embed = new EmbedBuilder()
                .setColor(0x00FFAA)
                .setTitle(`📊 ${item.name} Flip Analysis`)
                .addFields(
                    {
                        name: "🎯 Buy Zone",
                        value: `${zone.buyMin.toLocaleString()} - ${zone.buyMax.toLocaleString()} gp`
                    },
                    {
                        name: "🎯 Sell Zone",
                        value: `${zone.sellMin.toLocaleString()} - ${zone.sellMax.toLocaleString()} gp`
                    },
                    {
                        name: "💡 Suggested Flip",
                        value: `${zone.entry.toLocaleString()} → ${zone.exit.toLocaleString()} gp`
                    },
                    {
                        name: "💰 Profit Each",
                        value: `${zone.profit.toLocaleString()} gp`,
                        inline: true
                    },
                    {
                        name: "📈 Margin",
                        value: `${zone.percent.toFixed(2)}%`,
                        inline: true
                    },
                    {
                        name: "⚡ Volatility",
                        value: volatility,
                        inline: true
                    },
                    {
                        name: "🎒 Inventory Profit",
                        value: `${(zone.profit * 28).toLocaleString()} gp`,
                        inline: true
                    },
                    {
                        name: "📦 Limit Profit",
                        value: `${(zone.profit * limit).toLocaleString()} gp`,
                        inline: true
                    },
                    {
                        name: "🚦 Rating",
                        value: getTier(zone.percent),
                        inline: true
                    }
                )
                .setFooter({ text: 'TFTP Pro Flip Analyzer' })
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
