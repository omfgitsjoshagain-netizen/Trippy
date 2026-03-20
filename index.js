require('dotenv').config();
require('./cache'); // 🔥 THIS AUTO STARTS CACHE

const fs = require('fs');
const { Client, GatewayIntentBits, Collection } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.commands = new Collection();

// Load commands
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.data.name, command);
}

// Bot ready
client.once('ready', () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
});

// Handle interactions
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
        console.error("COMMAND ERROR:", error);

        if (interaction.deferred || interaction.replied) {
            await interaction.editReply('❌ Error executing command.');
        } else {
            await interaction.reply({
                content: '❌ Error executing command.',
                ephemeral: true
            });
        }
    }
});

client.login(process.env.TOKEN);
