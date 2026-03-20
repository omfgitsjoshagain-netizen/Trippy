const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const path = require('path');
const cache = require('../cache');

/* ------------------ VALUE TIER SYSTEM ------------------ */
function getValueTier(value) {

    if (value >= 1_000_000_000) {
        return {
            color: 0xFF0000,
            emoji: "🔥",
            label: "LEGENDARY TIER (1B+)"
        };
    }

    if (value >= 100_000_000) {
        return {
            color: 0x0099FF,
            emoji: "💎",
            label: "ELITE TIER (100M+)"
        };
    }

    if (value >= 10_000_000) {
        return {
            color: 0x00FF00,
            emoji: "🟢",
            label: "HIGH VALUE (10M+)"
        };
    }

    return {
        color: 0x808080,
        emoji: "⚪",
        label: "STANDARD VALUE"
    };
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

/* ------------------ HYBRID MATCHER ------------------ */
function findBestMatch(itemsList, input) {

    if (!input || input.length < 2) return null;

    const normalizedInput = input.toLowerCase().trim();

    // 1️⃣ Exact match
    const exactMatch = itemsList.find(item =>
        item.name.toLowerCase() === normalizedInput
    );
    if (exactMatch) return exactMatch;

    // 2️⃣ Partial match
    const partialMatches = itemsList.filter(item =>
        item.name.toLowerCase().includes(normalizedInput)
    );

    if (partialMatches.length === 1) return partialMatches[0];

    if (partialMatches.length > 1) {
        return partialMatches.sort(
            (a, b) =>
                Math.abs(a.name.length - normalizedInput.length) -
                Math.abs(b.name.length - normalizedInput.length)
        )[0];
    }

    // 3️⃣ Fuzzy fallback
    if (normalizedInput.length < 4) return null;

    let bestMatch = null;
    let bestScore = Infinity;

    for (const item of itemsList) {
        const score = levenshtein(
            normalizedInput,
            item.name.toLowerCase()
        );

        if (score < bestScore) {
            bestScore = score;
            bestMatch = item;
        }
    }

    const maxAllowedDistance =
        normalizedInput.length <= 5
            ? 1
            : Math.floor(normalizedInput.length * 0.3);

    if (bestScore <= maxAllowedDistance) {
        return bestMatch;
    }

    return null;
}

/* ------------------ ICON ------------------ */
function getItemIcon(name) {
    return `https://oldschool.runescape.wiki/images/${name.replace(/ /g, '_')}.png`;
}

/* ------------------ COMMAND ------------------ */

module.exports = {
    data: new SlashCommandBuilder()
        .setName('price')
        .setDescription('Get OSRS item price (cached + tier system)')
        .addStringOption(option =>
            option.setName('item')
                .setDescription('Item name')
                .setRequired(true)
        ),

    async execute(interaction) {

        const itemName = interaction.options.getString('item');
        await interaction.deferReply();

        try {
            const itemsList = cache.getItems();
            const prices = cache.getPrices();

            if (!itemsList.length || !Object.keys(prices).length) {
                return interaction.editReply(
                    'Price data is still loading. Try again shortly.'
                );
            }

            const item = findBestMatch(itemsList, itemName);

            if (!item)
                return interaction.editReply('Item not found.');

            const priceData = prices[item.id];

            if (!priceData)
                return interaction.editReply('Price unavailable.');

            const buy = priceData.high ?? 0;
            const sell = priceData.low ?? 0;
            const average = Math.floor((buy + sell) / 2);

            const tier = getValueTier(average);

            const embed = new EmbedBuilder()
                .setColor(tier.color)
                .setTitle(`${tier.emoji} ${item.name}`)
                .setThumbnail(getItemIcon(item.name))
                .setImage('attachment://tftp_banner.gif')
                .addFields(
                    {
                        name: "📊 VALUE TIER",
                        value: `**${tier.label}**`
                    },
                    {
                        name: "📈 Buy",
                        value: `**${buy.toLocaleString()} gp**`,
                        inline: true
                    },
                    {
                        name: "📉 Sell",
                        value: `**${sell.toLocaleString()} gp**`,
                        inline: true
                    },
                    {
                        name: "📊 Average",
                        value: `**${average.toLocaleString()} gp**`
                    }
                )
                .setFooter({ text: "TFTP Trading System (Cached)" })
                .setTimestamp();

            await interaction.editReply({
                embeds: [embed],
                files: [path.join(__dirname, '../assets/tftp_banner.gif')]
            });

        } catch (error) {
            console.error(error);
            await interaction.editReply('Error fetching price.');
        }
    }
};