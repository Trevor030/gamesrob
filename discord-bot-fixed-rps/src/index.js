const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection } = require('discord.js');
require('dotenv').config();

const TOKEN = process.env.DISCORD_TOKEN;
const APP_ID = process.env.DISCORD_APP_ID;
const GUILD_ID = process.env.DISCORD_GUILD_ID;

if (!TOKEN || !APP_ID) {
  console.error('DISCORD_TOKEN and DISCORD_APP_ID are required.');
  process.exit(1);
}

const client = new Client({
  intents: [ GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers ]
});

client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
function loadCommands(dir){
  for(const f of fs.readdirSync(dir)){
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) loadCommands(full);
    else if (f.endsWith('.js')){
      const cmd = require(full);
      client.commands.set(cmd.data.name, cmd);
    }
  }
}
loadCommands(commandsPath);

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const cmd = client.commands.get(interaction.commandName);
  if (!cmd) return interaction.reply({ content: 'Command not found', ephemeral: true });
  try { await cmd.execute(interaction, client); }
  catch (err) { console.error(err); interaction.reply({ content: 'Error', ephemeral: true }); }
});

client.once('ready', () => console.log(`Logged in as ${client.user.tag}`));

setInterval(() => console.log('HEALTH_OK'), 60_000);

// register commands at startup (best-effort)
(async () => {
  try {
    await require('./registerCommands')(APP_ID, GUILD_ID, process.env.DISCORD_TOKEN);
    await client.login(TOKEN);
  } catch (e) {
    console.error('Startup error', e);
    process.exit(1);
  }
})();
