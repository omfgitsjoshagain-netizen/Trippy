const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const path = require('path');
const cache = require('../cache');

/* ------------------ COLOR ------------------ */
function getColorByValue(value) {
    if (value >= 1_000_000_000) return 0xFFD700;
    if (value >= 100_000_000) return 0x0099FF;
    if (value >= 1_000_000) return 0x5C9E31;
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

/* ------------------ HYBRID MATCHER ------------------ */
function findBestMatch(itemsList, input) {

    if (!input || input.length < 2) return null;

    const normalizedInput = input.toLowerCase().trim();

    // Exact
    const exactMatch = itemsList.find(item =>
        item.name.toLowerCase() === normalizedInput
    );
    if (exactMatch) return exactMatch;

    // Partial
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

    // Fuzzy fallback
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

/* ------------------ GP PARSER ------------------ */
function parseGP(value) {
    const input = value.toLowerCase().trim();

    if (/^\d+(\.\d+)?m$/.test(input)) return parseFloat(input) * 1_000_000;
    if (/^\d+(\.\d+)?k$/.test(input)) return parseFloat(input) * 1_000;
    if (/^\d+(\.\d+)?b$/.test(input)) return parseFloat(input) * 1_000_000_000;
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
        .setDescription('Sum OSRS items using cached average price')
        .addStringOption(option =>
            option.setName('items')
                .setDescription('Format: item:qty, item, 10m, 500k')
                .setRequired(true)
        ),

    async execute(interaction) {

        const input = interaction.options.getString('items');
        await interaction.deferReply();

        try {
            const itemsList = cache.getItems();
            const prices = cache.getPrices();

            if (!itemsList.length || !Object.keys(prices).length) {
                return interaction.editReply('Price data is still loading. Try again shortly.');
            }

            const entries = input.split(',').map(e => e.trim());

            let totalValue = 0;
            let outputLines = [];
            let firstItemIcon = null;

            for (const entry of entries) {

                // Raw GP support
                const gpValue = parseGP(entry);
                if (gpValue !== null) {
                    totalValue += gpValue;
                    outputLines.push(`💰 GP Added: ${gpValue.toLocaleString()} gp`);
                    continue;
                }

                let name;
                let quantity = 1;

                if (entry.includes(':')) {
                    const parts = entry.split(':');
                    name = parts[0].trim();
                    quantity = parseInt(parts[1]);

                    if (isNaN(quantity) || quantity <= 0) {
                        return interaction.editReply(`Invalid quantity for ${name}`);
                    }
                } else {
                    name = entry.trim();
                }

                const item = findBestMatch(itemsList, name);

                if (!item)
                    return interaction.editReply(`Item not found: ${name}`);

                const priceData = prices[item.id];

                if (!priceData)
                    return interaction.editReply(`No price data for ${item.name}`);

                const buy = priceData.high ?? 0;
                const sell = priceData.low ?? 0;
                const average = Math.floor((buy + sell) / 2);

                const itemTotal = average * quantity;
                totalValue += itemTotal;

                if (!firstItemIcon)
                    firstItemIcon = getItemIcon(item.name);

                outputLines.push(
                    `• **${item.name}** x${quantity}\n   Avg: ${average.toLocaleString()} gp → ${itemTotal.toLocaleString()} gp`
                );
            }

            const embed = new EmbedBuilder()
                .setColor(getColorByValue(totalValue))
                .setTitle('🧮 OSRS Average Total Calculator (Cached)')
                .setDescription(outputLines.join('\n\n'))
                .addFields({
                    name: '💰 Grand Total',
                    value: `**${totalValue.toLocaleString()} gp**`
                })
                .setThumbnail(firstItemIcon)
                .setImage('attachment://tftp_banner.gif')
                .setFooter({ text: 'TFTP Price Checker' })
                .setTimestamp();

            await interaction.editReply({
                embeds: [embed],
                files: [path.join(__dirname, '../assets/tftp_banner.gif')]
            });

        } catch (error) {
            console.error(error);
            await interaction.editReply('Error calculating total.');
        }
    }
};