// bot.js
const { Client, GatewayIntentBits, Partials, PermissionsBitField } = require('discord.js');
const fs = require('fs');

const TOKEN = process.env.DISCORD_TOKEN; // metti il token come variabile d'ambiente
const RESTORE_DELAY_MS = 1000 * 60 * 5; // default: 5 minuti (modifica se vuoi)

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

// Struttura in memoria per backup { guildId: { userId: [roleId, ...] } }
const backups = {};

// Utility: salva su file (opzionale, per persistenza)
function saveBackupsToFile() {
  try { fs.writeFileSync('./role_backups.json', JSON.stringify(backups, null, 2)); } 
  catch (e){ console.error('Errore salvataggio backup:', e); }
}
function loadBackupsFromFile() {
  try {
    if (fs.existsSync('./role_backups.json')) {
      Object.assign(backups, JSON.parse(fs.readFileSync('./role_backups.json', 'utf8')));
    }
  } catch(e){ console.error('Errore caricamento backup:', e); }
}
loadBackupsFromFile();

// Rimuove ruoli rimovibili da un membro e salva backup
async function stripRolesFromMember(guild, member) {
  const botMember = await guild.members.fetchMe();
  const botHighest = botMember.roles.highest;
  const removable = member.roles.cache.filter(r =>
    r.id !== guild.id && // esclude @everyone (guild.id)
    r.position < botHighest.position // solo ruoli inferiori al bot
  );

  if (removable.size === 0) return [];

  const roleIds = removable.map(r => r.id);
  // backup
  backups[guild.id] = backups[guild.id] || {};
  backups[guild.id][member.id] = roleIds;
  saveBackupsToFile();

  // rimuovi i ruoli (attenzione ai rate limits)
  for (const roleId of roleIds) {
    try {
      await member.roles.remove(roleId, 'Temporary strip by bot');
      // breve pausa per attenuare rate limit (aggiusta se necessario)
      await new Promise(res => setTimeout(res, 200));
    } catch (err) {
      console.warn(`Impossibile rimuovere ruolo ${roleId} da ${member.user.tag}:`, err.message);
    }
  }

  return roleIds;
}

// Ripristina i ruoli dal backup
async function restoreRolesForMember(guild, memberId) {
  if (!backups[guild.id] || !backups[guild.id][memberId]) return false;
  const botMember = await guild.members.fetchMe();
  const botHighest = botMember.roles.highest;
  const roleIds = backups[guild.id][memberId];

  // fetch member
  let member;
  try { member = await guild.members.fetch(memberId); }
  catch (e) { console.warn('Membro non raggiungibile durante il restore:', e.message); delete backups[guild.id][memberId]; saveBackupsToFile(); return false; }

  for (const roleId of roleIds) {
    const role = guild.roles.cache.get(roleId);
    if (!role) continue;
    if (role.position >= botHighest.position) continue; // non può ripristinare ruoli superiori
    try {
      await member.roles.add(roleId, 'Restore roles after temporary strip');
      await new Promise(res => setTimeout(res, 200));
    } catch (err) {
      console.warn(`Impossibile aggiungere ruolo ${roleId} a ${member.user.tag}:`, err.message);
    }
  }

  delete backups[guild.id][memberId];
  saveBackupsToFile();
  return true;
}

// Comandi testuali semplici: !strip @user [minuti], !restore @user, !stripall [minuti]
client.on('messageCreate', async (message) => {
  if (!message.guild || message.author.bot) return;
  if (!message.content.startsWith('!')) return;

  const [cmd, ...args] = message.content.trim().split(/\s+/);

  // Permessi moderatore: require ManageRoles
  const authorMember = await message.guild.members.fetch(message.author.id);
  if (!authorMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
    return message.reply('Hai bisogno del permesso **Manage Roles** per usare questi comandi.');
  }

  if (cmd === '!strip') {
    // usage: !strip @user 10
    const target = message.mentions.members.first();
    const minutes = parseInt(args[1]) || (RESTORE_DELAY_MS / 60000);
    if (!target) return message.reply('Menzione un utente: `!strip @user [minuti]`');

    const rolesRemoved = await stripRolesFromMember(message.guild, target);
    if (rolesRemoved.length === 0) return message.reply(`Nessun ruolo rimovibile da ${target.user.tag}.`);
    message.reply(`Rimossi ${rolesRemoved.length} ruoli da ${target.user.tag}. Verranno ripristinati tra ${minutes} minuti (se possibile).`);

    setTimeout(async () => {
      await restoreRolesForMember(message.guild, target.id);
      message.channel.send(`Ruoli di ${target.user.tag} ripristinati (se possibile).`);
    }, minutes * 60 * 1000);

  } else if (cmd === '!restore') {
    const target = message.mentions.members.first();
    if (!target) return message.reply('Menzione un utente: `!restore @user`');
    const ok = await restoreRolesForMember(message.guild, target.id);
    return message.reply(ok ? `Ruoli ripristinati per ${target.user.tag}.` : `Nessun backup trovato per ${target.user.tag}.`);
  } else if (cmd === '!stripall') {
    // usage: !stripall 5  => rimuove ruoli da tutti i membri (attenzione)
    const minutes = parseInt(args[0]) || (RESTORE_DELAY_MS / 60000);
    message.reply(`Avvio rimozione ruoli da tutti i membri (potrebbe richiedere molto tempo). Ripristino in ${minutes} minuti.`);

    // per evitare blocchi, processiamo i membri in batch
    const members = await message.guild.members.fetch();
    for (const [id, member] of members) {
      // skip bot and admins maybe? qui non skippiamo per scelta dell'utente
      try {
        await stripRolesFromMember(message.guild, member);
        await new Promise(res => setTimeout(res, 300)); // pausa per mitigare rate limits
      } catch (e) {
        console.warn('Errore stripall su', member.user.tag, e.message);
      }
    }

    setTimeout(async () => {
      // ripristino batch
      const toRestore = backups[message.guild.id] ? Object.keys(backups[message.guild.id]) : [];
      for (const userId of toRestore) {
        try {
          await restoreRolesForMember(message.guild, userId);
          await new Promise(res => setTimeout(res, 300));
        } catch (e) {
          console.warn('Errore ripristino batch per', userId, e.message);
        }
      }
      message.channel.send('Ripristino ruoli completato (se possibile).');
    }, minutes * 60 * 1000);
  }
});

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.login(TOKEN);
