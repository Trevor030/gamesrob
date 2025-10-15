const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rps')
    .setDescription('Play rock–paper–scissors against the bot.')
    .addStringOption(option =>
      option
        .setName('move')
        .setDescription('Choose your move')
        .setRequired(true)
        .addChoices(
          { name: 'Rock', value: 'rock' },
          { name: 'Paper', value: 'paper' },
          { name: 'Scissors', value: 'scissors' }
        )
    ),
  async execute(interaction) {
    const userMove = interaction.options.getString('move');
    const choices = ['rock', 'paper', 'scissors'];
    const botMove = choices[Math.floor(Math.random() * choices.length)];
    let outcome = 'Draw';
    if (
      (userMove === 'rock' && botMove === 'scissors') ||
      (userMove === 'scissors' && botMove === 'paper') ||
      (userMove === 'paper' && botMove === 'rock')
    ) outcome = 'You win!';
    else if (userMove !== botMove) outcome = 'You lose!';

    await interaction.reply({ content: `You: **${userMove}** • Bot: **${botMove}** — ${outcome}` });
  },
};
