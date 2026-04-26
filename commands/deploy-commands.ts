import dotenv from 'dotenv';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { REST, Routes, SlashCommandBuilder } from 'discord.js';

interface LocalDeployConfig {
  botId?: string;
  serverId?: string;
  Token?: string;
  token?: string;
}

dotenv.config();

const loadLocalDeployConfig = (): LocalDeployConfig => {
  const configPath = path.resolve(process.cwd(), 'commands', 'config.json');

  if (!existsSync(configPath)) {
    return {};
  }

  return JSON.parse(readFileSync(configPath, 'utf8')) as LocalDeployConfig;
};

const localConfig = loadLocalDeployConfig();
const botId = process.env.DISCORD_APP_ID ?? localConfig.botId;
const serverId = process.env.DISCORD_GUILD_ID ?? localConfig.serverId;
const token = process.env.DISCORD_TOKEN ?? process.env.TOKEN ?? localConfig.Token ?? localConfig.token;

if (!botId || !serverId || !token) {
  throw new Error('Missing slash command deployment config. Provide DISCORD_APP_ID, DISCORD_GUILD_ID, and DISCORD_TOKEN/TOKEN, or commands/config.json.');
}

const commands = [
  new SlashCommandBuilder().setName('ping').setDescription('Replies with pong!'),
  new SlashCommandBuilder()
    .setName('info')
    .setDescription('Returns some nice info!')
    .addSubcommand((subCommand) => subCommand
      .setName('user')
      .setDescription('Info about a user')
      .addUserOption((option) => option
        .setName('target')
        .setDescription('The user')))
    .addSubcommand((subCommand) => subCommand
      .setName('server')
      .setDescription('Info about the server')),
].map((command) => command.toJSON());

const rest = new REST().setToken(token);

void (async () => {
  try {
    await rest.put(Routes.applicationGuildCommands(botId, serverId), { body: commands });
    console.log(`${ new Date().toUTCString() } : Successfully registered application commands.`);
  } catch (error) {
    console.error(`${ new Date().toUTCString() } : ${ error }`);
    process.exitCode = 1;
  }
})();