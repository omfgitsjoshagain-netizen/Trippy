const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const cache = require('../cache');

/* ------------------ AUTOCOMPLETE HELPER ------------------ */
function getLastEntry(input) {
    const parts = input.split(',');
    return parts[parts.length - 1].trim().toLowerCase();
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

/* ------------------ MATCH ------------------ */
function findBestMatch(itemsList, input) {
    const normalized = input.toLowerCase();

    const exact = itemsList.find(i => i.name.toLowerCase() === normalized);
    if (exact) return exact;

    const partial = itemsList.filter(i =>
        i.name.toLowerCase().includes(normalized)
    );

    if (partial.length) return partial[0];

    return null;
}

/* ------------------ COLOR ------------------ */
function getColorByValue(value) {
    if (value >= 1e9) return 0xFFD700;
    if (value >= 100e6) return 0x0099FF;
    if (value >= 10e6) return 0x00FF00;
    return 0x808080;
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
                .setAutocomplete(true) // 🔥 ENABLE AUTOCOMPLETE
        ),

    /* ------------------ AUTOCOMPLETE ------------------ */
    async autocomplete(interaction) {
        const input = interaction.options.getFocused();
        const items = cache.getItems();

        if (!items.length) return;

        const last = getLastEntry(input);

        if (!last || last.length < 2) {
            return interaction.respond([]);
        }

        const matches = items
            .filter(i => i.name.toLowerCase().includes(last))
            .slice(0, 25);

        // rebuild full string
        const base = input.substring(0, input.lastIndexOf(last));

        const results = matches.map(item => ({
            name: item.name,
            value: base + item.name
        }));

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

                    if (isNaN(qty)) {
                        return interaction.editReply(`Invalid qty: ${entry}`);
                    }
                } else {
                    name = entry;
                }

                const item = findBestMatch(itemsList, name);

                if (!item) {
                    return interaction.editReply(`Item not found: ${name}`);
                }

                const price = prices[item.id];
                if (!price) {
                    return interaction.editReply(`No price: ${item.name}`);
                }

                const avg = Math.floor(((price.high ?? 0) + (price.low ?? 0)) / 2);
                const totalItem = avg * qty;

                total += totalItem;

                lines.push(
                    `• ${item.name} x${qty} → ${totalItem.toLocaleString()} gp`
                );
            }

            const embed = new EmbedBuilder()
                .setColor(getColorByValue(total))
                .setTitle('🧮 Total Value')
                .setDescription(lines.join('\n\n'))
                .addFields({
                    name: '💰 Total',
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
