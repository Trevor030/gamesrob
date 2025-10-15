const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
function readConfig(){
  try { return fs.existsSync(CONFIG_FILE) ? JSON.parse(fs.readFileSync(CONFIG_FILE,'utf8')) : {}; }
  catch { return {}; }
}
function writeConfig(cfg){
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2)); } catch {}
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('modlog')
    .setDescription('Manage moderation log settings.')
    .addSubcommand(sc =>
      sc.setName('set')
        .setDescription('Silently set the moderation log channel.')
        .addChannelOption(o =>
          o.setName('channel')
           .setDescription('Channel to receive moderation logs')
           .setRequired(true)
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    // Silenzioso: ack ephemeral e lo elimino subito
    try { await interaction.deferReply({ ephemeral: true }); await interaction.deleteReply().catch(()=>{}); } catch {}
    if (interaction.options.getSubcommand() !== 'set') return;

    const ch = interaction.options.getChannel('channel');
    if (!ch || !ch.isTextBased()) return;

    const cfg = readConfig();
    cfg[interaction.guild.id] = cfg[interaction.guild.id] || {};
    cfg[interaction.guild.id].modlogChannelId = ch.id;
    writeConfig(cfg);
  }
};
