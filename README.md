# Game-Notifier-Bot

A Discord bot, created with discord.js and running on NodeJS, that is meant to notify game turns as they happen.
Started out for Civilization 6 and currently also supports Old World.
Depending on the format of notification a game sends out, it should be relatively easy to add a function and check for that specific game.


## Current version and credits

Current version is stable and working and can be used if you have a 24/7 small server somewhere and register your bot with Discord.
Version number is 2.0.3

Programming is done by Onno "donald23" Zaal with some help from the Civ community I am a member of: WePlayCiv.
Join us and play some games with us here: **[WePlayCiv Discord](https://discord.gg/E7WFYzNEBm)** 


## Environment file

To use this bot, you'll need an access token from Discord and have your bot registered with them.
The access token is needed for the bot to communicate on Discord after it's been added to a server.
To feed the token to the bot on your own deployment, create a `.env` file in the root and make sure it contains a `TOKEN` variable.

Additionally, the bot needs a MySQL database with two tables (`Games` and `Players`). A base-starting file is included in the repository.
The connection details for the database go in the `.env` files as well.


### Example `.env` file

Example contents of a `.env`-file for this bot:
```
TOKEN=123abc456def789ghi
PORT=3333
DB_USER=<your database user>
DB_HOST=localhost
DB_PORT=3306
DB_PASS=<password going with your database user>
DB_NAME=gamenotifierbot_v1
```


### Compatibility

So far I have ran this bot successfully on node v16, v18 and v20. Latest npm that I have this running with is 10.1.0.
It should work with newer versions as well, but might need slight tweaking.
The bot is developed and tested on my debian distro.
