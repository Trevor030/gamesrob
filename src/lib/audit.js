async function logAction(guild, data){
  try {
    const fs = require('fs');
    const path = require('path');
    const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
    const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
    let cfg = {};
    try { cfg = fs.existsSync(CONFIG_FILE) ? JSON.parse(fs.readFileSync(CONFIG_FILE,'utf8')) : {}; } catch {}
    const channelId = cfg[guild.id]?.modlogChannelId;
    let channel = null;
    if (channelId) channel = guild.channels.cache.get(channelId);
    if (!channel || !channel.isTextBased()) {
      channel = guild.channels.cache.find(c => c.name === 'mod-log' && c.isTextBased());
    }
    if (!channel) return;
    const embed = {
      title: `Mod action: ${data.type}`,
      fields: Object.entries(data).map(([k,v])=>({ name: k, value: String(v).slice(0,1024), inline: true })),
      timestamp: new Date()
    };
    await channel.send({ embeds: [embed] });
  } catch (e){ /* stay silent on failure */ }
}
module.exports = { logAction };
