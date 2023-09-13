const { SlashCommandBuilder } = require('@discordjs/builders');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { botId, serverId, Token } = require('./config.json');

const commands = [
	new SlashCommandBuilder().setName('ping').setDescription('Replies with pong!'),
	//new SlashCommandBuilder().setName('server').setDescription('Replies with server info!'),
	//new SlashCommandBuilder().setName('user').setDescription('Replies with user info!'),
	new SlashCommandBuilder()
		.setName('info')
		.setDescription('Returns some nice info!')
		.addSubcommand(subCommand => subCommand
			.setName('user')
			.setDescription('Info about a user')
			.addUserOption(option => option
				.setName('target')
				.setDescription('The user')))
		.addSubcommand(subCommand => subCommand
			.setName('server')
			.setDescription('Info about the server')),
]
	.map(command => command.toJSON());

const rest = new REST({ version: '9' }).setToken(Token);

(async () => {
	try {
		await rest.put(
			Routes.applicationGuildCommands(botId, serverId),
			{ body: commands },
		);
		console.log(`${new Date().toUTCString()} : Successfully registered application commands.`);
	} catch (error) {
		console.error(`${new Date().toUTCString()} : ${error}`);
    };
})();
