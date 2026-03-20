require('dotenv').config();

const fs = require('fs');
const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const cache = require('./cache');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.commands = new Collection();

/* ------------------ LOAD COMMANDS ------------------ */
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

const commandsJSON = [];

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.data.name, command);
    commandsJSON.push(command.data.toJSON());
}

/* ------------------ AUTO DEPLOY ------------------ */
async function deployCommands() {
    try {
        console.log("🚀 Deploying slash commands...");

        const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

        await rest.put(
            Routes.applicationGuildCommands(
                process.env.CLIENT_ID,
                process.env.GUILD_ID
            ),
            { body: commandsJSON }
        );

        console.log("✅ Commands deployed successfully.");
    } catch (error) {
        console.error("❌ Deploy error:", error);
    }
}

/* ------------------ READY ------------------ */
client.once('ready', async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);

    // 🔥 AUTO DEPLOY HERE
    await deployCommands();

    // 🔥 CACHE SYSTEM
    console.log("🚀 Initializing cache...");
    await cache.loadMapping();
    await cache.loadPrices();
    cache.startPriceUpdater();
});

/* ------------------ INTERACTIONS ------------------ */
client.on('interactionCreate', async interaction => {

    // 🔥 AUTOCOMPLETE HANDLER
    if (interaction.isAutocomplete()) {
        const command = client.commands.get(interaction.commandName);
        if (!command || !command.autocomplete) return;

        try {
            await command.autocomplete(interaction);
        } catch (error) {
            console.error("AUTOCOMPLETE ERROR:", error);
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

/* ------------------ LOGIN ------------------ */
client.login(process.env.TOKEN);
