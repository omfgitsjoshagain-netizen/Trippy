const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const cache = require('../cache');

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

    // Fuzzy (light)
    if (normalized.length < 3) return null;

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

/* ------------------ VALUE TIERS ------------------ */
function getValueTier(value) {
    if (value >= 1_000_000_000) return { color: 0xFF0000, emoji: "🔥", label: "LEGENDARY" };
    if (value >= 100_000_000) return { color: 0x0099FF, emoji: "💎", label: "ELITE" };
    if (value >= 10_000_000) return { color: 0x00FF00, emoji: "🟢", label: "HIGH" };
    return { color: 0x808080, emoji: "⚪", label: "STANDARD" };
}

/* ------------------ COMMAND ------------------ */

module.exports = {
    data: new SlashCommandBuilder()
        .setName('price')
        .setDescription('Get OSRS item price')
        .addStringOption(option =>
            option.setName('item')
                .setDescription('Start typing item...')
                .setRequired(true)
                .setAutocomplete(true)
        ),

    /* ------------------ AUTOCOMPLETE ------------------ */
    async autocomplete(interaction) {
        try {
            const focused = interaction.options.getFocused().toLowerCase();
            const items = cache.getItems();

            if (!items.length) {
                return interaction.respond([]);
            }

            if (!focused || focused.length < 1) {
                return interaction.respond([]);
            }

            const results = items
                .filter(i => i.name.toLowerCase().includes(focused))
                .slice(0, 25)
                .map(i => ({
                    name: i.name,
                    value: i.name
                }));

            await interaction.respond(results);

        } catch (err) {
            console.error("AUTOCOMPLETE ERROR:", err);
        }
    },

    /* ------------------ EXECUTE ------------------ */
    async execute(interaction) {
        try {
            await interaction.deferReply();

            const itemName = interaction.options.getString('item');
            const itemsList = cache.getItems();
            const prices = cache.getPrices();

            if (!itemsList.length || !Object.keys(prices).length) {
                return interaction.editReply('⏳ Loading price data...');
            }

            const item = findBestMatch(itemsList, itemName);

            if (!item) {
                return interaction.editReply('❌ Item not found.');
            }

            const priceData = prices[item.id];

            if (!priceData) {
                return interaction.editReply('❌ Price unavailable.');
            }

            const buy = priceData.high ?? 0;
            const sell = priceData.low ?? 0;
            const avg = Math.floor((buy + sell) / 2);

            const tier = getValueTier(avg);

            const embed = new EmbedBuilder()
                .setColor(tier.color)
                .setTitle(`${tier.emoji} ${item.name}`)
                .addFields(
                    { name: "📈 Buy", value: `${buy.toLocaleString()} gp`, inline: true },
                    { name: "📉 Sell", value: `${sell.toLocaleString()} gp`, inline: true },
                    { name: "📊 Average", value: `${avg.toLocaleString()} gp` }
                )
                .setFooter({ text: tier.label })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error("PRICE ERROR:", error);

            if (interaction.deferred || interaction.replied) {
                await interaction.editReply('❌ Error fetching price.');
            } else {
                await interaction.reply({
                    content: '❌ Error fetching price.',
                    ephemeral: true
                });
            }
        }
    }
};
