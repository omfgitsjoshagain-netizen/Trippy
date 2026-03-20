const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const cache = require('../cache');

/* ------------------ TIER SYSTEM ------------------ */
function getTier(percent) {
    if (percent >= 8) return "🔥 INSANE";
    if (percent >= 5) return "💎 ELITE";
    if (percent >= 3) return "👍 GOOD";
    if (percent >= 1) return "⚠️ SAFE";
    return "❌ BAD";
}

/* ------------------ COMMAND ------------------ */

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bestflips')
        .setDescription('🔥 Advanced OSRS flip scanner')
        .addStringOption(option =>
            option.setName('mode')
                .setDescription('Flip type')
                .addChoices(
                    { name: 'High Margin %', value: 'margin' },
                    { name: 'High Profit GP', value: 'profit' },
                    { name: 'Safe Flips', value: 'safe' }
                )
        )
        .addIntegerOption(option =>
            option.setName('budget')
                .setDescription('Max item price (optional)')
        ),

    async execute(interaction) {
        try {
            await interaction.deferReply();

            const mode = interaction.options.getString('mode') || 'margin';
            const budget = interaction.options.getInteger('budget');

            const items = cache.getItems();
            const prices = cache.getPrices();

            if (!items.length || !Object.keys(prices).length) {
                return interaction.editReply('⏳ Loading market data...');
            }

            const flips = [];

            for (const item of items) {

                const price = prices[item.id];
                if (!price || !price.high || !price.low) continue;

                const buy = price.high;
                const sell = price.low;

                if (buy <= 0 || sell <= 0) continue;

                // 💰 Budget filter
                if (budget && buy > budget) continue;

                const margin = buy - sell;
                const percent = (margin / sell) * 100;

                // 🔥 HARD FILTERS
                if (margin < 1000) continue;
                if (percent < 1) continue;
                if (buy < 5000) continue;

                const profitEach = margin;
                const profitInv = margin * 28;
                const profitCycle = margin * 100; // estimate GE limit

                flips.push({
                    name: item.name,
                    margin,
                    percent,
                    buy,
                    profitEach,
                    profitInv,
                    profitCycle
                });
            }

            /* ------------------ SORT MODES ------------------ */

            if (mode === 'profit') {
                flips.sort((a, b) => b.profitEach - a.profitEach);
            } else if (mode === 'safe') {
                flips.sort((a, b) => a.percent - b.percent);
            } else {
                flips.sort((a, b) => b.percent - a.percent);
            }

            const top = flips.slice(0, 10);

            if (!top.length) {
                return interaction.editReply('❌ No flips found.');
            }

            const lines = top.map((f, i) => {
                return `**${i + 1}. ${f.name}**\n` +
                       `💰 ${f.margin.toLocaleString()} gp | ${f.percent.toFixed(2)}%\n` +
                       `🎒 Inv: ${f.profitInv.toLocaleString()} gp\n` +
                       `📦 Cycle: ${f.profitCycle.toLocaleString()} gp\n` +
                       `🚦 ${getTier(f.percent)}\n`;
            });

            const embed = new EmbedBuilder()
                .setColor(0x00FFAA)
                .setTitle('🔥 BEST FLIPS (PRO MODE)')
                .setDescription(lines.join('\n'))
                .addFields({
                    name: "⚙️ Mode",
                    value: mode.toUpperCase(),
                    inline: true
                })
                .setFooter({ text: 'TFTP Flip Engine v2' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error("BESTFLIPS ERROR:", error);

            if (interaction.deferred) {
                await interaction.editReply('❌ Error scanning flips.');
            } else {
                await interaction.reply({
                    content: '❌ Error scanning flips.',
                    ephemeral: true
                });
            }
        }
    }
};
