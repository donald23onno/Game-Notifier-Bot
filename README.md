# Game-Notifier-Bot
A Discord bot, created with discord.js and running on NodeJS, that is meant to notify game turns as they happen.
Started out for Civilization 6 and is able to expand to other games, for example Old World.

### Environment file
To use this bot, you'll need an access token from Discord and have your bot registered with them.
The access token is needed for the bot to communicate on Discord after it's been added to a server.
To feed the token to the bot on your own deployment, create a `.env` file in the root and make sure it contains a `TOKEN` variable.

Example contents of a `.env`-file for this bot:
```
TOKEN=123abc456def789ghi
```
