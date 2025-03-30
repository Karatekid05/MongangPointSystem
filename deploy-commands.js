require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Get command files
const commands = [];
// Dynamically import all command files
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  if (command.data) {
    commands.push(command.data.toJSON());
    console.log(`✅ Command ${file} loaded.`);
  } else {
    console.log(`❌ Command ${file} is missing data and was not loaded.`);
  }
}

// Create a new REST instance
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

// Deploy commands
(async () => {
  try {
    console.log(`Started refreshing ${commands.length} application (/) commands.`);

    const data = await rest.put(
      // Use this for global commands (all servers)
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands },
    );

    // Use this for guild-specific commands (single server)
    // Replace YOUR_GUILD_ID with your server's ID
    /*
    const data = await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands },
    );
    */

    console.log(`Successfully reloaded ${data.length} application (/) commands.`);
  } catch (error) {
    console.error(error);
  }
})(); 