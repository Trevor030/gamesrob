// bot.js
const { Client, GatewayIntentBits, Partials, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');

const TOKEN = process.env.DISCORD_TOKEN;
if (!TOKEN) {
  console.error('Missing DISCORD_TOKEN env var. Exiting.');
  process.exit(1);
}

const DEFAULT_DELAY_MIN = parseInt(process.env.RESTORE_DELAY_MINUTES || '5', 10);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const BACKUP_FILE = path.join(DATA_DIR, 'role_backups.json');

// assicurati che la cartella data esista
fs.mkdirSync(DATA_DIR, { recursive: true });

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

function saveBackupsToFile() {
  try { fs.writeFileSync(BACKUP_FILE, JSON.stringify(backups, null, 2)); }
  catch (e){ console.error('Errore salvataggio backup:', e); }
}
function loadBackupsFromFile() {
  try {
    if (fs.existsSync(BACKUP_FILE)) {
      Object.assign(backups, JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8')));
    }
  } catch(e){ console.error('Errore caricamento backup:', e); }
}
loadBackupsFromFile();

async function stripRolesFromMember(guild, member) {
  const botMember = await guild.members.fetchMe();
  const botHighest = botMember.roles.highest;
  const removable = member.roles.cache.filter(r =>
    r.id !== guild.id && r.position < botHighest.position
  );
  if (removable.size === 0) return [];

  const roleIds = removable.map(r => r.id);
  backups[guild.id] = backups[guild.id] || {};
  backups[guild.id][member.id] = roleIds;
  saveBackupsToFile();

  for (const roleId of roleIds) {
    try {
      await member.roles.remove(roleId, 'Temporary strip by bot');
      await new Promise(res => setTimeout(res, 200));
    } catch (err) {
      console.warn(`Impossibile rimuovere ruolo ${roleId} da ${member.user.tag}: ${err.message}`);
    }
  }
  return roleIds;
}

async function restoreRolesForMember(guild, memberId) {
  if (!backups[guild.id] || !backups[guild.id][memberId]) return false;
  const botMember = await guild.members.fetchMe();
  const botHighest = botMember.roles.highest;
  const roleIds = backups[guild.id][memberId];

  let member;
  try { member = await guild.members.fetch(memberId); }
  catch (e) {
    console.warn('Membro non raggiungibile durante il restore:', e.message);
    delete backups[guild.id][memberId]; saveBackupsToFile();
    return false;
  }

  for (const roleId of roleIds) {
    const role = guild.roles.cache.get(roleId);
    if (!role) continue;
    if (role.position >= botHighest.position) continue;
    try {
      await member.roles.add(roleId, 'Restore roles after temporary strip');
      await new Promise(res => setTimeout(res, 200));
    } catch (err) {
      console.warn(`Impossibile aggiungere ruolo ${roleId} a ${member.user.tag}: ${err.message}`);
    }
  }

  delete backups[guild.id][memberId];
  saveBackupsToFile();
  return true;
}

client.on('messageCreate', async (message) => {
  if (!message.guild || message.author.bot) return;
  if (!message.content.startsWith('!')) return;

  const [cmd, ...args] = message.content.trim().split(/\s+/);
  const authorMember = await message.guild.members.fetch(message.author.id);
  if (!authorMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
    return message.reply('Serve il permesso **Manage Roles** per usare questi comandi.');
  }

  if (cmd === '!strip') {
    const target = message.mentions.members.first();
    const minutes = Number.isFinite(parseInt(args[1])) ? parseInt(args[1]) : DEFAULT_DELAY_MIN;
    if (!target) return message.reply('Usa: `!strip @user [minuti]`');

    const rolesRemoved = await stripRolesFromMember(message.guild, target);
    if (rolesRemoved.length === 0) return message.reply(`Nessun ruolo rimovibile da ${target.user.tag}.`);
    message.reply(`Rimossi ${rolesRemoved.length} ruoli da ${target.user.tag}. Ripristino tra ${minutes} minuti.`);

    setTimeout(async () => {
      await restoreRolesForMember(message.guild, target.id);
      message.channel.send(`Ruoli di ${target.user.tag} ripristinati (se possibile).`);
    }, minutes * 60 * 1000);

  } else if (cmd === '!restore') {
    const target = message.mentions.members.first();
    if (!target) return message.reply('Usa: `!restore @user`');
    const ok = await restoreRolesForMember(message.guild, target.id);
    return message.reply(ok ? `Ruoli ripristinati per ${target.user.tag}.` : `Nessun backup trovato per ${target.user.tag}.`);

  } else if (cmd === '!stripall') {
    const minutes = Number.isFinite(parseInt(args[0])) ? parseInt(args[0]) : DEFAULT_DELAY_MIN;
    message.reply(`Avvio rimozione ruoli da tutti i membri. Ripristino in ${minutes} minuti.`);

    const members = await message.guild.members.fetch();
    for (const [id, member] of members) {
      try {
        await stripRolesFromMember(message.guild, member);
        await new Promise(res => setTimeout(res, 300));
      } catch (e) {
        console.warn('Errore stripall su', member.user?.tag || id, e.message);
      }
    }

    setTimeout(async () => {
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

client.on('clientReady', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// Simple health endpoint via stdout trigger (per healthcheck)
setInterval(() => console.log('HEALTH_OK'), 60_000);

client.login(TOKEN);
