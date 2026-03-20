async execute(interaction) {

    try {
        // 🔥 ALWAYS FIRST
        await interaction.deferReply();

        const itemName = interaction.options.getString('item');

        const itemsList = cache.getItems();
        const prices = cache.getPrices();

        if (!itemsList.length || !Object.keys(prices).length) {
            return interaction.editReply(
                '⏳ Price system is warming up, try again in a few seconds...'
            );
        }

        const item = findBestMatch(itemsList, itemName);

        if (!item) {
            return interaction.editReply('❌ Item not found.');
        }

        const priceData = prices[item.id];

        if (!priceData || (!priceData.high && !priceData.low)) {
            return interaction.editReply('❌ Price unavailable.');
        }

        const buy = priceData.high ?? 0;
        const sell = priceData.low ?? 0;
        const average = Math.floor((buy + sell) / 2);

        const tier = getValueTier(average);

        const embed = new EmbedBuilder()
            .setColor(tier.color)
            .setTitle(`${tier.emoji} ${item.name}`)
            .setThumbnail(getItemIcon(item.name))
            // 🔥 TEMP REMOVE IMAGE (prevents timeout)
            //.setImage('attachment://tftp_banner.gif')
            .addFields(
                { name: "📊 VALUE TIER", value: `**${tier.label}**` },
                { name: "📈 Buy", value: `**${buy.toLocaleString()} gp**`, inline: true },
                { name: "📉 Sell", value: `**${sell.toLocaleString()} gp**`, inline: true },
                { name: "📊 Average", value: `**${average.toLocaleString()} gp**` }
            )
            .setFooter({ text: "TFTP Trading System (Cached)" })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error("PRICE ERROR:", error);

        // 🔥 SAFE RESPONSE HANDLING
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
