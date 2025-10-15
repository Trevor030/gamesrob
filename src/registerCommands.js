const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

function isValidCommand(cmd, file) {
  try {
    if (!cmd?.data?.name) throw new Error('missing data.name');
    if (typeof cmd.data.description !== 'string' || !cmd.data.description.trim()) {
      throw new Error('missing data.description');
    }
    // Prova di serializzazione (fa scattare validateDescription su subcmd/opzioni)
    cmd.data.toJSON();
    return true;
  } catch (e) {
    console.error(`[register] Skipping invalid command in ${file}: ${e.message}`);
    return false;
  }
}

module.exports = async function registerCommands(APP_ID, GUILD_ID, TOKEN){
  if (!APP_ID || !TOKEN) throw new Error('APP_ID and TOKEN required for registering commands');

  const commands = [];
  const commandsPath = path.join(__dirname, 'commands');

  function collect(dir){
    for (const f of fs.readdirSync(dir)) {
      const full = path.join(dir, f);
      if (fs.statSync(full).isDirectory()) { collect(full); continue; }
      if (!f.endsWith('.js')) continue;

      const cmd = require(full);
      if (cmd?.data) {
        if (isValidCommand(cmd, full)) commands.push(cmd.data.toJSON());
      } else {
        console.warn(`[register] File without export.data skipped: ${full}`);
      }
    }
  }
  collect(commandsPath);

  const rest = new REST({ version: '10' }).setToken(TOKEN);
  if (GUILD_ID) {
    console.log('Registering guild commands...');
    await rest.put(Routes.applicationGuildCommands(APP_ID, GUILD_ID), { body: commands });
    console.log(`Guild commands registered: ${commands.length}`);
  } else {
    console.log('Registering global commands (may take minutes)...');
    await rest.put(Routes.applicationCommands(APP_ID), { body: commands });
    console.log(`Global commands registered: ${commands.length}`);
  }
};
