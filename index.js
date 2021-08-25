// Main bot file that will also handle immediate responses.

console.log(
    "This is the Game Notifier Bot. It's meant for giving out turn notifications for asynchronous turns in games."
);
console.log(
    "Good examples of this are Sid Meier's Civilization 6 and Soren Johnson's Old World.\n"
);
console.log("Bot is now loading... Please wait...\n");
//console.log('...');

// Sensitive data goes into the .env file that's not included in git.
const dotenv = require("dotenv");
dotenv.config();
// Other config stuff goes into the config.json.
const { prefix } = require("./config.json");

const Discord = require("discord.js");
const client = new Discord.Client({
    intents: [
        Discord.Intents.FLAGS.GUILDS,
        Discord.Intents.FLAGS.GUILD_MESSAGES,
        Discord.Intents.FLAGS.GUILD_MESSAGE_TYPING,
        Discord.Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
        Discord.Intents.FLAGS.DIRECT_MESSAGES,
    ],
});

client.once("ready", () => {
    client.user.setActivity("for new turns!", { type: "WATCHING" });
    console.log("Bot is now finished loading and... Ready!");
    console.log(
        "----------------------------------------------------------------------------------------------------------------"
    );
});

client.on("interactionCreate", async (interaction) => {
    console.log(`Triggering interaction: ${interaction}`);
});

client.on("messageCreate", async (message) => {
    let messageSend;
    if (!message.content.startsWith(`${prefix}`) || message.author.bot) return;

    try {
        switch (message.content) {
            case `${prefix}ping`:
                //message.channel.send("Pong!");
                message.reply("Pong!");
                break;
            case `${prefix}beep`:
                message.author.send("Boop!");
                break;
            case `${prefix}keepalive`:
                //let turnThread = await client.channels.fetch('871100324742594660'); //Thread or Channel
                let turnThread = await client.channels.fetch(
                    "871112615680675940"
                ); //Test thread on my own server
                console.log(`turnThread object: ${turnThread}`);
                messageSend = turnThread.send(
                    "Stayin Alive! -- https://music.youtube.com/watch?v=vOIeXBEKeLc&list=RDAMVMvOIeXBEKeLc "
                );
                break;
            case `${prefix}gameinfo`:
                let channel = await client.channels.fetch("554035300444405780");
                let pinnedMessages = await channel.messages.fetchPinned();
                console.log(`Messages: ${pinnedMessages}`);
                messageSend = channel.send("The pinned messages were fetched!");
                break;
            default:
                console.log("ERR: not a recognized command!");
                message.reply(
                    "That is not a recognized command, feel free to try again :)"
                );
        }
    } catch (error) {
        console.log(`ERR : An error occurred: ${error}`);
    }
});

client.login(process.env.TOKEN);
