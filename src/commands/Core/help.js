import {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} from "discord.js";
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { createEmbed } from "../../utils/embeds.js";
import { createSelectMenu } from "../../utils/components.js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { t, pickLanguage } from '../../services/i18n.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CATEGORY_SELECT_ID = "help-category-select";
const ALL_COMMANDS_ID = "help-all-commands";
const BUG_REPORT_BUTTON_ID = "help-bug-report";
const HELP_MENU_TIMEOUT_MS = 5 * 60 * 1000;

const CATEGORY_ICONS = {
    Core: "ℹ️",
    Moderation: "🛡️",
    Economy: "💰",
    Fun: "🎮",
    Leveling: "📊",
    Utility: "🔧",
    Ticket: "🎫",
    Welcome: "👋",
    Giveaway: "🎉",
    Counter: "🔢",
    Tools: "🛠️",
    Search: "🔍",
    Reaction_Roles: "🎭",
    Community: "👥",
    Birthday: "🎂",
    Config: "⚙️",
};

export async function createInitialHelpMenu(client, lang = 'es') {
    const commandsPath = path.join(__dirname, "../../commands");
    const categoryDirs = (
        await fs.readdir(commandsPath, { withFileTypes: true })
    )
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name)
        .sort();

    const options = [
        {
            label: t(lang, 'wolf.cmd.help.allCommands'),
            description: t(lang, 'wolf.cmd.help.allCommandsDesc'),
            value: ALL_COMMANDS_ID,
        },
        ...categoryDirs.map((category) => {
            const categoryKey = Object.keys(CATEGORY_ICONS).find(
                (key) => key.toLowerCase() === category.toLowerCase()
            ) || category;
            const categoryText = t(lang, `wolf.cmd.help.categories.${categoryKey}`);
            const icon = CATEGORY_ICONS[categoryKey] || "🔍";
            return {
                label: `${icon} ${categoryText.name || categoryKey}`,
                description: categoryText.description || t(lang, 'wolf.cmd.help.categoryDesc', { name: categoryKey }),
                value: category,
            };
        }),
    ];

    const botName = client?.user?.username || "Bot";
    const embed = createEmbed({
        title: t(lang, 'wolf.cmd.help.title', { bot: botName }),
        description: t(lang, 'wolf.cmd.help.description'),
        color: 'primary'
    });

    const categoryFields = categoryDirs
        .map((category) => {
            const categoryKey = Object.keys(CATEGORY_ICONS).find(
                (key) => key.toLowerCase() === category.toLowerCase()
            ) || category;
            const categoryText = t(lang, `wolf.cmd.help.categories.${categoryKey}`);
            if (!categoryText || typeof categoryText !== 'object') return null;
            const icon = CATEGORY_ICONS[categoryKey] || "🔍";
            return {
                name: `${icon} **${categoryText.name || categoryKey}**`,
                value: categoryText.description || '',
                inline: true,
            };
        })
        .filter(Boolean);

    embed.addFields(categoryFields);

    embed.setFooter({ text: t(lang, 'wolf.cmd.help.footer') });
    embed.setTimestamp();

    const bugReportButton = new ButtonBuilder()
        .setCustomId(BUG_REPORT_BUTTON_ID)
        .setLabel(t(lang, 'wolf.cmd.help.reportBug'))
        .setStyle(ButtonStyle.Danger);

    const components = [];
    const buttons = [bugReportButton];

    const supportInvite = (await import('../../config/bot.js')).botConfig.brand?.supportInvite;
    if (supportInvite) {
        buttons.push(
            new ButtonBuilder()
                .setLabel(t(lang, 'wolf.cmd.help.supportServer'))
                .setURL(supportInvite)
                .setStyle(ButtonStyle.Link),
        );
    }

    const selectRow = createSelectMenu(
        CATEGORY_SELECT_ID,
        t(lang, 'wolf.cmd.help.selectPlaceholder'),
        options,
    );

    components.push(new ActionRowBuilder().addComponents(buttons), selectRow);

    return { embeds: [embed], components };
}

export default {
    data: new SlashCommandBuilder()
        .setName("help")
        .setDescription("Displays the help menu with all available commands"),

    async execute(interaction, guildConfig, client) {
        const lang = pickLanguage(guildConfig, interaction.guild);
        await InteractionHelper.safeDefer(interaction);

        const { embeds, components } = await createInitialHelpMenu(client, lang);

        await InteractionHelper.safeEditReply(interaction, {
            embeds,
            components,
        });

        setTimeout(async () => {
            try {
                const closedEmbed = createEmbed({
                    title: t(lang, 'wolf.cmd.help.closedTitle'),
                    description: t(lang, 'wolf.cmd.help.closedDesc'),
                    color: "secondary",
                });

                await InteractionHelper.safeEditReply(interaction, {
                    embeds: [closedEmbed],
                    components: [],
                });
            } catch (error) {
                /* timeout cleanup, ignore */
            }
        }, HELP_MENU_TIMEOUT_MS);
    },
};
