import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { Collection } from 'discord.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getSubcommandInfo(commandData) {
    const subcommands = [];
    if (commandData.options) {
        for (const option of commandData.options) {
            if (option.type === 1) subcommands.push(option.name);
            else if (option.type === 2 && option.options) {
                for (const subOption of option.options) {
                    if (subOption.type === 1) subcommands.push(`${option.name}/${subOption.name}`);
                }
            }
        }
    }
    return subcommands;
}

async function getAllFiles(directory, fileList = []) {
    const files = await fs.readdir(directory, { withFileTypes: true });
    for (const file of files) {
        const filePath = path.join(directory, file.name);
        if (file.isDirectory()) {
            if (file.name === 'modules') continue;
            await getAllFiles(filePath, fileList);
        } else if (file.name.endsWith('.js')) {
            fileList.push(filePath);
        }
    }
    return fileList;
}

export async function loadCommands(client) {
    client.commands = new Collection();
    const commandsPath = path.join(__dirname, '../commands');
    const commandFiles = await getAllFiles(commandsPath);
    logger.info(`Found ${commandFiles.length} command files to load`);

    const uniqueCommandNames = new Set();
    for (const filePath of commandFiles) {
        try {
            const normalizedPath = filePath.replace(/\\/g, '/');
            const commandDir = path.dirname(filePath);
            const category = path.basename(commandDir);
            const commandModule = await import(`file://${filePath}`);
            const command = commandModule.default || commandModule;

            if (!command.data || !command.execute) {
                logger.warn(`Command at ${filePath} is missing required "data" or "execute" property.`);
                continue;
            }

            command.category = category;
            command.filePath = normalizedPath;
            const primaryCommandName = command.data.name;

            if (!uniqueCommandNames.has(primaryCommandName)) {
                uniqueCommandNames.add(primaryCommandName);
                client.commands.set(primaryCommandName, command);
            }

            const subcommands = getSubcommandInfo(command.data.toJSON());
            logger.info(`Loaded command: ${primaryCommandName} from ${normalizedPath} (category: ${category})`);
            if (subcommands.length > 0) logger.info(`  - Subcommands: ${subcommands.join(', ')}`);
        } catch (error) {
            logger.error(`Error loading command from ${filePath}:`, error);
        }
    }

    logger.info(`Loaded ${client.commands.size} commands`);
    return client.commands;
}

export async function registerCommands(client, guildId) {
    try {
        const commands = [];
        const registeredNames = new Set();

        for (const command of client.commands.values()) {
            if (!command.data || typeof command.data.toJSON !== 'function') {
                logger.warn(`Command missing data or toJSON method: ${command}`);
                continue;
            }
            const commandName = command.data.name;
            if (registeredNames.has(commandName)) continue;
            registeredNames.add(commandName);
            commands.push(command.data.toJSON());
        }

        if (guildId) {
            logger.info(`Preparing to register ${commands.length} commands for guild ${guildId}`);
            const guild = await client.guilds.fetch(guildId);
            await guild.commands.set(commands.slice(0, 100));
            const registeredCommands = await guild.commands.fetch();
            logger.info(`Verification: Discord reports ${registeredCommands.size} guild commands`);
        } else {
            let globalCommands = commands;
            if (globalCommands.length > 100) {
                logger.warn(`Global command count (${globalCommands.length}) exceeds Discord limit (100), truncating to 100`);
                globalCommands = globalCommands.slice(0, 100);
            }

            const localNames = new Set(globalCommands.map(command => command.name));
            logger.info(`Registering ${globalCommands.length} commands GLOBALLY (all servers)...`);
            await client.application.commands.set(globalCommands);
            logger.info(`Successfully registered ${globalCommands.length} global commands`);

            // Verify the commands Discord actually has for this application.
            const registeredGlobal = await client.application.commands.fetch();
            const registeredGlobalNames = new Set(registeredGlobal.map(command => command.name));
            logger.info(`Global command verification: Discord reports ${registeredGlobal.size} commands`);
            logger.info(`Global command 'antispam': local=${localNames.has('antispam')} discord=${registeredGlobalNames.has('antispam')}`);
            if (localNames.has('antispam') && !registeredGlobalNames.has('antispam')) {
                throw new Error("Global command verification failed: 'antispam' was not returned by Discord after registration.");
            }
        }
    } catch (error) {
        logger.error('Error registering commands:', error);
        throw error;
    }
}

export async function reloadCommand(client, commandName) {
    const command = client.commands.get(commandName);
    if (!command) return { success: false, message: `Command "${commandName}" not found` };
    try {
        const commandPath = path.resolve(command.filePath);
        const moduleUrl = pathToFileURL(commandPath);
        moduleUrl.searchParams.set('t', Date.now().toString());
        const newCommand = (await import(moduleUrl.href)).default;
        client.commands.set(commandName, newCommand);
        logger.info(`Reloaded command: ${commandName}`);
        return { success: true, message: `Successfully reloaded command "${commandName}"` };
    } catch (error) {
        logger.error(`Error reloading command "${commandName}":`, error);
        return { success: false, message: `Error reloading command: ${error.message}` };
    }
}
