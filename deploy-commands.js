const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { Token, ClientId, GuildId } = require('./config.json'); // Asegúrate de que tengas estos valores en tu config.json

const commands = [
    {
        name: 'ping',
        description: 'El bot responde con pong',
    },
];

const rest = new REST({ version: '9' }).setToken(Token);

(async () => {
    try {
        console.log('Iniciando la actualización de comandos de slash...');

        await rest.put(Routes.applicationGuildCommands(ClientId, GuildId), { body: commands });

        console.log('Comandos de slash registrados con éxito.');
    } catch (error) {
        console.error(error);
    }
})();