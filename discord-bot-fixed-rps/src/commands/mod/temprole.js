const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { logAction } = require('../../lib/audit');
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
const BACKUP_FILE = path.join(DATA_DIR, 'role_backups.json');
fs.mkdirSync(DATA_DIR, { recursive: true });

// helper backup store (file-backed)
function saveBackup(guildId, userId, roleIds){
  let db = {};
  try { if (fs.existsSync(BACKUP_FILE)) db = JSON.parse(fs.readFileSync(BACKUP_FILE,'utf8')); }catch(e){}
  db[guildId] = db[guildId] || {};
  db[guildId][userId] = roleIds;
  fs.writeFileSync(BACKUP_FILE, JSON.stringify(db, null, 2));
}
function popBackup(guildId, userId){
  try {
    if (!fs.existsSync(BACKUP_FILE)) return null;
    const db = JSON.parse(fs.readFileSync(BACKUP_FILE,'utf8'));
    const roles = db[guildId]?.[userId] || null;
    if (db[guildId]) delete db[guildId][userId];
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(db, null, 2));
    return roles;
  } catch(e){ return null; }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('temprole')
    .setDescription('Temporarily remove a role from a user (requires ManageRoles).')
    .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
    .addRoleOption(o => o.setName('role').setDescription('Role to remove').setRequired(true))
    .addIntegerOption(o => o.setName('minutes').setDescription('Minutes to restore').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
  async execute(interaction, client) {
    const target = interaction.options.getMember('user');
    const role = interaction.options.getRole('role');
    const minutes = interaction.options.getInteger('minutes');

    if (!target) return interaction.reply({ content: 'Member not found.', ephemeral: true });
    if (role.managed) return interaction.reply({ content: 'Cannot remove managed roles (bot/integration).', ephemeral: true});
    if (role.position >= interaction.guild.members.me.roles.highest.position) return interaction.reply({ content: 'Bot cannot manage that role.', ephemeral: true });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('confirm_temprole').setLabel('Confirm').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('cancel_temprole').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
    );
    await interaction.reply({ content: `Remove role **${role.name}** from ${target.user.tag} for ${minutes} minutes?`, components: [row], ephemeral: true });

    const filter = i => i.user.id === interaction.user.id && ['confirm_temprole','cancel_temprole'].includes(i.customId);
    const collector = interaction.channel.createMessageComponentCollector({ filter, time: 30_000, max: 1 });

    collector.on('collect', async i => {
      if (i.customId === 'cancel_temprole') {
        await i.update({ content: 'Cancelled.', components: [] });
        return;
      }
      try {
        const removable = target.roles.cache.filter(r => r.id !== interaction.guild.id && r.id !== role.id && r.position < interaction.guild.members.me.roles.highest.position).map(r => r.id);
        // backup user's roles + the target role as removed role
        saveBackup(interaction.guild.id, target.id, [role.id, ...removable]);
        await target.roles.remove(role, `Temprole by ${interaction.user.tag}`);
        await i.update({ content: `Role removed. Will be restored in ${minutes} minutes.`, components: [] });
        await logAction(interaction.guild, {
          type: 'temprole',
          moderator: interaction.user.tag,
          target: target.user.tag,
          role: role.name,
          duration_min: minutes,
          ts: Date.now()
        });
        setTimeout(async () => {
          const toRestore = popBackup(interaction.guild.id, target.id);
          if (!toRestore) return;
          try {
            await target.roles.add(toRestore, 'Restore temprole');
            await logAction(interaction.guild, { type:'restore', target: target.user.tag, role: role.name, ts: Date.now() });
          } catch(e){ console.warn('restore failed', e.message); }
        }, minutes * 60_000);
      } catch (err) {
        console.error(err);
        await i.update({ content: `Failed to remove role: ${err.message}`, components: [] });
      }
    });

    collector.on('end', collected => {
      if (collected.size === 0) interaction.editReply({ content: 'No response — cancelled.', components: [] }).catch(()=>{});
    });
  }
};
