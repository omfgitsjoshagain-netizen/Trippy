const cache = require('./cache');
require('dotenv').config();
const fs = require('fs');
const { Client, GatewayIntentBits, Collection } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.commands = new Collection();

const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.data.name, command);
}

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);

    await cache.loadMapping(); // load once
    await cache.loadPrices();  // load once
    cache.startPriceUpdater(); // auto refresh
});

client.on('interactionCreate', async interaction => {

    if (interaction.isAutocomplete()) {
        const command = client.commands.get(interaction.commandName);
        if (!command || !command.autocomplete) return;

        try {
            await command.autocomplete(interaction);
        } catch (error) {
            console.error(error);
        }
        return;
    }

    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        await interaction.reply({
            content: 'Error executing command.',
            ephemeral: true
        });
    }
});
client.login(process.env.TOKEN);