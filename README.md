# Discord Bot (games + safe moderation)

Minimal Discord bot with slash commands:
- Games: /coinflip, /rps
- Moderation: /temprole (safe: confirmation, logging, undo via scheduled restore)

**Environment variables**
- DISCORD_TOKEN (required)
- DISCORD_APP_ID (required)
- DISCORD_GUILD_ID (optional - fast guild command registration)
- RESTORE_DELAY_MINUTES (optional, default 5)

**Run with Docker / Portainer**
- Build & run with the provided Dockerfile + docker-compose.yml
- Use named volume `rolebot_data` for persistence

**Notes**
- This project uses slash commands; no Message Content Intent needed.
- Enable Server Members Intent in the Developer Portal if you want guild-wide member fetches (recommended for /temprole and batch ops).
- Customize embed styles, icons and branding. Do NOT impersonate other bots.
