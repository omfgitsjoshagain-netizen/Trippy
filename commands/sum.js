const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const cache = require('../cache');

/* ------------------ COLOR ------------------ */
function getColorByValue(value) {
    if (value >= 1_000_000_000) return 0xFFD700;
    if (value >= 100_000_000) return 0x0099FF;
    if (value >= 10_000_000) return 0x00FF00;
    return 0x808080;
}

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
function findBestMatch(itemsList, input) {
    const normalized = input.toLowerCase().trim();

    // Exact
    const exact = itemsList.find(i => i.name.toLowerCase() === normalized);
    if (exact) return exact;

    // Partial
    const partial = itemsList.filter(i =>
        i.name.toLowerCase().includes(normalized)
    );
    if (partial.length === 1) return partial[0];
    if (partial.length > 1) return partial[0];

    // Light fuzzy
    if (normalized.length < 4) return null;

    let best = null;
    let bestScore = Infinity;

    for (const item of itemsList) {
        const score = levenshtein(normalized, item.name.toLowerCase());
        if (score < bestScore) {
            bestScore = score;
            best = item;
        }
    }

    const max = Math.floor(normalized.length * 0.3);
    return bestScore <= max ? best : null;
}

/* ------------------ GP PARSER ------------------ */
function parseGP(value) {
    const input = value.toLowerCase().trim();

    if (/^\d+(\.\d+)?b$/.test(input)) return parseFloat(input) * 1_000_000_000;
    if (/^\d+(\.\d+)?m$/.test(input)) return parseFloat(input) * 1_000_000;
    if (/^\d+(\.\d+)?k$/.test(input)) return parseFloat(input) * 1_000;
    if (/^\d+$/.test(input)) return parseInt(input);

    return null;
}

/* ------------------ ICON ------------------ */
function getItemIcon(name) {
    return `https://oldschool.runescape.wiki/images/${name.replace(/ /g, '_')}.png`;
}

/* ------------------ COMMAND ------------------ */

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sumitems')
        .setDescription('Sum OSRS items + GP using cached prices')
        .addStringOption(option =>
            option.setName('items')
                .setDescription('item:qty, item, 10m, 500k')
                .setRequired(true)
        ),

    async execute(interaction) {
        try {
            await interaction.deferReply();

            const input = interaction.options.getString('items');

            const itemsList = cache.getItems();
            const prices = cache.getPrices();

            if (!itemsList.length || !Object.keys(prices).length) {
                return interaction.editReply('⏳ Price data still loading...');
            }

            const entries = input.split(',').map(e => e.trim());

            let totalValue = 0;
            let outputLines = [];
            let firstItemIcon = null;

            for (const entry of entries) {

                /* ------------------ GP INPUT ------------------ */
                const gpValue = parseGP(entry);
                if (gpValue !== null) {
                    totalValue += gpValue;
                    outputLines.push(`💰 GP: ${gpValue.toLocaleString()} gp`);
                    continue;
                }

                /* ------------------ ITEM PARSE ------------------ */
                let name;
                let quantity = 1;

                if (entry.includes(':')) {
                    const [n, q] = entry.split(':');
                    name = n.trim();
                    quantity = parseInt(q);

                    if (isNaN(quantity) || quantity <= 0) {
                        return interaction.editReply(`❌ Invalid quantity for ${name}`);
                    }
                } else {
                    name = entry.trim();
                }

                const item = findBestMatch(itemsList, name);

                if (!item) {
                    return interaction.editReply(`❌ Item not found: ${name}`);
                }

                const priceData = prices[item.id];

                if (!priceData) {
                    return interaction.editReply(`❌ No price data for ${item.name}`);
                }

                const buy = priceData.high ?? 0;
                const sell = priceData.low ?? 0;
                const avg = Math.floor((buy + sell) / 2);

                const itemTotal = avg * quantity;
                totalValue += itemTotal;

                if (!firstItemIcon) {
                    firstItemIcon = getItemIcon(item.name);
                }

                outputLines.push(
                    `• **${item.name}** x${quantity}\n   Avg: ${avg.toLocaleString()} → ${itemTotal.toLocaleString()} gp`
                );
            }

            const embed = new EmbedBuilder()
                .setColor(getColorByValue(totalValue))
                .setTitle('🧮 OSRS Total Calculator')
                .setDescription(outputLines.join('\n\n'))
                .addFields({
                    name: '💰 Grand Total',
                    value: `**${totalValue.toLocaleString()} gp**`
                })
                .setThumbnail(firstItemIcon)
                // 🔥 keep disabled until stable
                //.setImage('attachment://tftp_banner.gif')
                .setFooter({ text: 'TFTP System (Cached Prices)' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error("SUM ERROR:", error);

            if (interaction.deferred || interaction.replied) {
                await interaction.editReply('❌ Error calculating total.');
            } else {
                await interaction.reply({
                    content: '❌ Error calculating total.',
                    ephemeral: true
                });
            }
        }
    }
};
