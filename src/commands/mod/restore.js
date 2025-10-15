const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
const BACKUP_FILE = path.join(DATA_DIR, 'role_backups.json');

function readDb(){
  try { return fs.existsSync(BACKUP_FILE) ? JSON.parse(fs.readFileSync(BACKUP_FILE,'utf8')) : {}; }
  catch { return {}; }
}
function popBackup(guildId, userId){
  const db = readDb();
  if (!db[guildId] || !db[guildId][userId]) return null;
  const roles = db[guildId][userId];
  delete db[guildId][userId];
  try { fs.writeFileSync(BACKUP_FILE, JSON.stringify(db, null, 2)); } catch {}
  return roles;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('restore')
    .setDescription('Silently restore roles for a user from backup (no visible feedback).')
    .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
  async execute(interaction) {
    // Silent: acknowledge ephemerally then delete immediately
    try {
      await interaction.deferReply({ ephemeral: true });
      await interaction.deleteReply().catch(()=>{});
    } catch {}

    const target = interaction.options.getMember('user');
    if (!target) return; // silent exit

    const toRestore = popBackup(interaction.guild.id, target.id);
    if (!toRestore || !Array.isArray(toRestore) || toRestore.length === 0) return;

    const me = interaction.guild.members.me;
    for (const roleId of toRestore) {
      const role = interaction.guild.roles.cache.get(roleId);
      if (!role) continue;
      if (role.position >= me.roles.highest.position) continue;
      try { await target.roles.add(role, 'Silent restore via /restore'); }
      catch {}
    }
  }
};
