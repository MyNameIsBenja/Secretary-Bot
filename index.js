const { Client, GatewayIntentBits, Events, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, REST, Routes } = require('discord.js');
const { Token, RoleId, ClientId, GuildId } = require('./config.json');
const http = require('http');

// Create a new client instance
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent 
    ] 
});

// Create an HTTP server to keep the bot alive
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('the bot is working!');
});

// Listen on port 3000
server.listen(3000, () => {
    console.log('HTTP server is active on http://localhost:3000');
});

// Event when the bot is ready
client.once(Events.ClientReady, () => {
    console.log(`Bot connected as ${client.user.tag}`);
    client.user.setActivity('Watching the chat', { type: 'WATCHING' });
});

// In-memory databases for bans
const bansDatabase = [];  // Store banned user details

// Helper function to convert duration to milliseconds
const durationToMs = (duration) => {
    const match = duration.match(/^(\d+)([dhm]|(\d+mo))$/);
    if (!match) return null;

    const amount = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
        case 'd':
            return amount * 24 * 60 * 60 * 1000; // days
        case 'h':
            return amount * 60 * 60 * 1000; // hours
        case 'm':
            return amount * 60 * 1000; // minutes
        case 'mo':
            return amount * 30 * 24 * 60 * 60 * 1000; // months (approx.)
        default:
            return null;
    }
};

// Check for expired bans
const checkBans = () => {
    const now = Date.now();
    bansDatabase.forEach((ban, index) => {
        const banDuration = durationToMs(ban.duration);
        if (banDuration && now - new Date(ban.banDate).getTime() > banDuration) {
            // Unban user
            client.guilds.cache.first().members.unban(ban.userId)
                .then(() => {
                    console.log(`Unbanned ${ban.username} after ${ban.duration}`);
                    // Remove from the bansDatabase
                    bansDatabase.splice(index, 1);
                })
                .catch(err => console.error(`Failed to unban ${ban.username}:`, err));
        }
    });
};

// Set an interval to check for expired bans every hour
setInterval(checkBans, 3600000);

// Slash command setup
const commands = [
    {
        name: 'bl',
        description: 'Ban a specified user with details',
        options: [
            { name: 'id', type: 3, description: 'User ID to ban', required: true },
            { name: 'reason', type: 3, description: 'Reason for ban', required: true },
            { name: 'duration', type: 3, description: 'Ban duration (e.g. 14d)', required: true },
            {
                name: 'punishment',
                type: 3,
                description: 'Type of punishment',
                required: true,
                choices: [
                    { name: 'UAB', value: 'UAB' },
                    { name: 'AB', value: 'AB' }
                ]
            }
        ]
    },
    {
        name: 'probationary',
        description: 'Assign phases roles to a mentioned user for 8 days',
        options: [
            { name: 'user', type: 6, description: 'User to assign roles', required: true }
        ]
    },
    {
        name: 'ot',
        description: 'Send an Observational Tryout message',
        options: [
            { name: 'cohost', type: 6, description: 'User acting as Co-Host/Supervisor', required: false }
        ]
    },
    {
        name: 'blacklist-database',
        description: 'Show all banned users with their details',
    },
    {
        name: 'remove-blacklist',
        description: 'Remove a user from the blacklist using their ID',
        options: [
            { name: 'id', type: 3, description: 'User ID to remove', required: true }
            ]
    },
    {
            name: 'sendemail',
            description: 'Send an email notification',
            options: [
                { name: 'username', type: 3, description: 'Username to submit', required: true },
                { name: 'email', type: 3, description: 'Gmail address to submit', required: true }
            ]
        }
        ];
        

const rest = new REST({ version: '10' }).setToken(Token);

// Register commands on Discord
(async () => {
    try {
        console.log('Registering slash commands...');
        await rest.put(
            Routes.applicationGuildCommands(ClientId, GuildId),
            { body: commands }
        );
        console.log('Slash commands registered successfully.');
    } catch (error) {
        console.error('Error registering slash commands:', error);
    }
})();

// Handle command interactions
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isCommand()) return;

    const { commandName, options } = interaction;
    const member = interaction.guild.members.cache.get(interaction.user.id);

    // Check if the user has the required role
    if (!member.roles.cache.has(RoleId)) {
        return interaction.reply({ content: "You don't have permission to run this command.", ephemeral: true });
    }

    if (commandName === 'bl') {
        const userIdToBan = options.getString('id');
        const reason = options.getString('reason');
        const duration = options.getString('duration');
        const punishment = options.getString('punishment');

        // Fetch the user from the Discord API using their ID
        const userToBan = await client.users.fetch(userIdToBan).catch(() => null);
        const username = userToBan ? userToBan.username : 'Unknown User';

        // Validate duration format
        if (!/^(\d+)([dhm]|(\d+mo))$/.test(duration)) {
            return interaction.reply({ content: "Duration must be a number followed by 'd', 'h', 'm', or 'mo'.", ephemeral: true });
        }

        // Get current date and time
        const banDate = new Date().toISOString();

        // Create the embed message
        const embed = new EmbedBuilder()
            .setColor(000000)
            .setTitle('BLACKLIST')
            .addFields(
                { name: 'USERNAME', value: username, inline: true },
                { name: 'ID', value: userIdToBan, inline: true },
                { name: 'REASON', value: reason, inline: true },
                { name: 'DURATION', value: duration, inline: true },
                { name: 'PUNISHMENT', value: punishment, inline: true },
                { name: 'BAN DATE', value: banDate, inline: true }
            );

        // Create approval and denial buttons
        const approvedButton = new ButtonBuilder()
            .setCustomId('approved')
            .setLabel('APPROVED')
            .setStyle(ButtonStyle.Success);

        const deniedButton = new ButtonBuilder()
            .setCustomId('denied')
            .setLabel('DENIED')
            .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(approvedButton, deniedButton);

        // Send the embed and buttons
        const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

        // Handle button interactions
        const filter = i => ['approved', 'denied'].includes(i.customId);
        const collector = msg.createMessageComponentCollector({ filter, time: 15000 });

        collector.on('collect', async (buttonInteraction) => {
            if (!buttonInteraction.member.roles.cache.has(RoleId)) {
                return buttonInteraction.reply({ content: "You don't have permission to use these buttons.", ephemeral: true });
            }

            await msg.edit({ components: [] }); // Disable buttons after click

            if (buttonInteraction.customId === 'approved') {
                try {
                    await buttonInteraction.guild.members.ban(userIdToBan, { reason: `${punishment}, Duration: ${duration}` });

                    // Save the ban details
                    bansDatabase.push({
                        username: username,
                        userId: userIdToBan,
                        approvedBy: buttonInteraction.user.username,
                        duration: duration,
                        reason: reason,
                        banDate: banDate // Store ban date
                    });

                    const confirmationEmbed = new EmbedBuilder()
                        .setColor(000000)
                        .setTitle('Punishment Accepted')
                        .setDescription(`${buttonInteraction.user.username} has accepted the punishment.`)
                        .addFields(
                            { name: 'Banned User', value: username, inline: true },
                            { name: 'Ban ID', value: userIdToBan, inline: true },
                            { name: 'Reason', value: punishment, inline: true },
                            { name: 'Duration', value: duration, inline: true },
                            { name: 'Ban Date', value: banDate, inline: true }
                        );

                    await buttonInteraction.reply({ embeds: [confirmationEmbed] });
                } catch (error) {
                    console.error(error);
                    await buttonInteraction.reply({ content: `Failed to ban ${username}.`, ephemeral: true });
                }
            } else if (buttonInteraction.customId === 'denied') {
                const denialEmbed = new EmbedBuilder()
                    .setColor(000000)
                    .setTitle('Punishment Denied')
                    .setDescription(`${buttonInteraction.user.username} has denied the punishment.`);

                await buttonInteraction.reply({ embeds: [denialEmbed] });
            }
        });

        collector.on('end', collected => {
            if (collected.size === 0) msg.edit({ components: [] }); // Disable buttons if no clicks
        });
    }
});

client.login(Token);
