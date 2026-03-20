const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const cache = require('../cache');

/* ------------------ VALUE TIER ------------------ */
function getValueTier(value) {
    if (value >= 1_000_000_000) return { color: 0xFF0000, emoji: "🔥", label: "LEGENDARY (1B+)" };
    if (value >= 100_000_000) return { color: 0x0099FF, emoji: "💎", label: "ELITE (100M+)" };
    if (value >= 10_000_000) return { color: 0x00FF00, emoji: "🟢", label: "HIGH (10M+)" };
    return { color: 0x808080, emoji: "⚪", label: "STANDARD" };
}

/* ------------------ MATCH ------------------ */
function findBestMatch(itemsList, input) {
    const normalized = input.toLowerCase().trim();

    // exact
    const exact = itemsList.find(i => i.name.toLowerCase() === normalized);
    if (exact) return exact;

    // partial
    const partial = itemsList.filter(i =>
        i.name.toLowerCase().includes(normalized)
    );
    if (partial.length) return partial[0];

    return null;
}

/* ------------------ COMMAND ------------------ */

module.exports = {
    data: new SlashCommandBuilder()
        .setName('price')
        .setDescription('Get OSRS item price')
        .addStringOption(option =>
            option.setName('item')
                .setDescription('Item name')
                .setRequired(true)
        ),

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

            if (!item) return interaction.editReply('❌ Item not found.');

            const priceData = prices[item.id];

            if (!priceData) return interaction.editReply('❌ Price unavailable.');

            const buy = priceData.high ?? 0;
            const sell = priceData.low ?? 0;
            const avg = Math.floor((buy + sell) / 2);

            const tier = getValueTier(avg);

            const embed = new EmbedBuilder()
                .setColor(tier.color)
                .setTitle(`${tier.emoji} ${item.name}`)
                .addFields(
                    { name: "Buy", value: `${buy.toLocaleString()} gp`, inline: true },
                    { name: "Sell", value: `${sell.toLocaleString()} gp`, inline: true },
                    { name: "Average", value: `${avg.toLocaleString()} gp` }
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
