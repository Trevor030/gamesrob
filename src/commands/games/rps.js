const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rps')
    .setDescription('Play rock-paper-scissors')
    .addStringOption(o =>
      o.setName('move')
       .setDescription('Your move')
       .setRequired(true)
       .addChoices(
         { name: 'Rock', value: 'rock' },
         { name: 'Paper', value: 'paper' },
         { name: 'Scissors', value: 'scissors' }
       )
    ),
  async execute(interaction) {
    const user = interaction.options.getString('move');
    const choices = ['rock','paper','scissors'];
    const bot = choices[Math.floor(Math.random()*3)];
    const result = (user===bot) ? 'Draw'
      : (user==='rock'&&bot==='scissors'||user==='scissors'&&bot==='paper'||user==='paper'&&bot==='rock')
      ? 'You win!' : 'You lose!';
    await interaction.reply({ content: `You: **${user}** • Bot: **${bot}** — ${result}` });
  }
};
