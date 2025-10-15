const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = async function registerCommands(APP_ID, GUILD_ID, TOKEN){
  if (!APP_ID || !TOKEN) {
    throw new Error('APP_ID and TOKEN required for registering commands');
  }
  const commands = [];
  const commandsPath = path.join(__dirname, 'commands');
  function collect(dir){
    for(const f of fs.readdirSync(dir)){
      const full = path.join(dir, f);
      if (fs.statSync(full).isDirectory()) collect(full);
      else if (f.endsWith('.js')){
        const cmd = require(full);
        if (cmd.data) commands.push(cmd.data.toJSON());
      }
    }
  }
  collect(commandsPath);
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  if (GUILD_ID) {
    console.log('Registering guild commands...');
    await rest.put(Routes.applicationGuildCommands(APP_ID, GUILD_ID), { body: commands });
    console.log('Guild commands registered.');
  } else {
    console.log('Registering global commands (may take minutes)...');
    await rest.put(Routes.applicationCommands(APP_ID), { body: commands });
    console.log('Global commands registered.');
  }
};
