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

/* ------------------ MATCH ------------------ */
function findBestMatch(itemsList, input) {
    const normalized = input.toLowerCase().trim();

    const exact = itemsList.find(i => i.name.toLowerCase() === normalized);
    if (exact) return exact;

    const partial = itemsList.filter(i =>
        i.name.toLowerCase().includes(normalized)
    );
    if (partial.length) return partial[0];

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

    if (/^\d+(\.\d+)?b$/.test(input)) return parseFloat(input) * 1e9;
    if (/^\d+(\.\d+)?m$/.test(input)) return parseFloat(input) * 1e6;
    if (/^\d+(\.\d+)?k$/.test(input)) return parseFloat(input) * 1e3;
    if (/^\d+$/.test(input)) return parseInt(input);

    return null;
}

/* ------------------ COMMAND ------------------ */

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sumitems')
        .setDescription('Sum OSRS items + GP')
        .addStringOption(option =>
            option.setName('items')
                .setDescription('item:qty, item, 10m')
                .setRequired(true)
                .setAutocomplete(true)
        ),

    /* ------------------ AUTOCOMPLETE ------------------ */
    async autocomplete(interaction) {
        const input = interaction.options.getFocused();
        const items = cache.getItems();

        if (!items.length) return;

        const parts = input.split(',');
        const last = parts[parts.length - 1].trim().toLowerCase();

        if (!last || last.length < 2) {
            return interaction.respond([]);
        }

        const matches = items
            .filter(i => i.name.toLowerCase().includes(last))
            .slice(0, 25);

        const results = matches.map(item => {
            const newParts = [...parts];
            newParts[newParts.length - 1] = item.name;

            return {
                name: item.name,
                value: newParts.join(', ')
            };
        });

        await interaction.respond(results);
    },

    /* ------------------ EXECUTE ------------------ */
    async execute(interaction) {
        try {
            await interaction.deferReply();

            const input = interaction.options.getString('items');
            const itemsList = cache.getItems();
            const prices = cache.getPrices();

            if (!itemsList.length || !Object.keys(prices).length) {
                return interaction.editReply('⏳ Loading data...');
            }

            const entries = input.split(',').map(e => e.trim());

            let total = 0;
            let lines = [];

            for (const entry of entries) {

                // GP
                const gp = parseGP(entry);
                if (gp !== null) {
                    total += gp;
                    lines.push(`💰 ${gp.toLocaleString()} gp`);
                    continue;
                }

                let name;
                let qty = 1;

                if (entry.includes(':')) {
                    const [n, q] = entry.split(':');
                    name = n.trim();
                    qty = parseInt(q);

                    if (isNaN(qty) || qty <= 0) {
                        return interaction.editReply(`❌ Invalid quantity: ${entry}`);
                    }
                } else {
                    name = entry;
                }

                const item = findBestMatch(itemsList, name);

                if (!item) {
                    return interaction.editReply(`❌ Item not found: ${name}`);
                }

                const price = prices[item.id];

                if (!price) {
                    return interaction.editReply(`❌ No price for ${item.name}`);
                }

                const avg = Math.floor(((price.high ?? 0) + (price.low ?? 0)) / 2);
                const totalItem = avg * qty;

                total += totalItem;

                lines.push(
                    `• **${item.name}** x${qty}\n   ${avg.toLocaleString()} → ${totalItem.toLocaleString()} gp`
                );
            }

            const embed = new EmbedBuilder()
                .setColor(getColorByValue(total))
                .setTitle('🧮 OSRS Total Calculator')
                .setDescription(lines.join('\n\n'))
                .addFields({
                    name: '💰 Grand Total',
                    value: `**${total.toLocaleString()} gp**`
                })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error("SUM ERROR:", error);

            if (interaction.deferred || interaction.replied) {
                await interaction.editReply('❌ Error calculating.');
            } else {
                await interaction.reply({
                    content: '❌ Error calculating.',
                    ephemeral: true
                });
            }
        }
    }
};
