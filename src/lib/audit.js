async function logAction(guild, data){
  try {
    const channel = guild.channels.cache.find(c => c.name === 'mod-log' && c.isTextBased());
    if (!channel) return;
    const embed = {
      title: `Mod action: ${data.type}`,
      fields: Object.entries(data).map(([k,v])=>({ name: k, value: String(v).slice(0,1024), inline: true })),
      timestamp: new Date()
    };
    await channel.send({ embeds: [embed] });
  } catch (e){ console.warn('logAction failed', e.message); }
}
module.exports = { logAction };
