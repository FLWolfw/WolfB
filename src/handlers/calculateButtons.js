import { errorEmbed, successEmbed } from '../utils/embeds.js';
import { logger } from '../utils/logger.js';
import { evaluateMathExpression } from '../utils/safeMathParser.js';
import { t, pickLanguage } from '../services/i18n.js';
import { getGuildConfig } from '../services/guildConfig.js';

function evaluate(expression) {
    return evaluateMathExpression(expression);
}

async function calculateModalHandler(interaction, client, args) {
    try {
        const operation = args[0];
        const operandInput = interaction.fields.first();
        const contextKey = operandInput?.customId?.split(':')[1];
        
        let lang = 'en';
        try {
            const config = await getGuildConfig(client, interaction.guildId);
            lang = pickLanguage(config, interaction.guild);
        } catch (err) {
            logger.error('Failed to get guild config or language in calculateModalHandler:', err);
        }
        
        if (!contextKey) {
            return await interaction.reply({
                embeds: [errorEmbed(
                    t(lang, 'wolf.cmd.tools.calculate.contextErrorTitle'), 
                    t(lang, 'wolf.cmd.tools.calculate.contextErrorDesc')
                )],
                flags: ['Ephemeral']
            });
        }

        const { calculationContexts } = await import('../commands/Tools/calculate.js');
        const context = calculationContexts.get(contextKey);
        
        if (!context) {
            return await interaction.reply({
                embeds: [errorEmbed(
                    t(lang, 'wolf.cmd.tools.calculate.contextExpiredTitle'), 
                    t(lang, 'wolf.cmd.tools.calculate.contextExpiredDesc')
                )],
                flags: ['Ephemeral']
            });
        }

        await interaction.deferReply({ ephemeral: false });

        const operand = interaction.fields.getTextInputValue(operandInput.customId);
        
        if (!operand || isNaN(operand)) {
            return await interaction.editReply({
                embeds: [errorEmbed(
                    t(lang, 'wolf.cmd.tools.calculate.invalidInputTitle'), 
                    t(lang, 'wolf.cmd.tools.calculate.invalidInputDesc')
                )]
            });
        }

        const { expression, formattedResult, operator } = context;
        const newExpression = `(${expression}) ${operator} (${operand})`;

        let newResult;
        try {
            newResult = evaluate(newExpression);
            
            let formattedNewResult;
            if (typeof newResult === "number") {
                formattedNewResult = newResult.toLocaleString("en-US", {
                    maximumFractionDigits: 10,
                });

                if (
                    Math.abs(newResult) > 0 &&
                    (Math.abs(newResult) >= 1e10 || Math.abs(newResult) < 1e-3)
                ) {
                    formattedNewResult = newResult.toExponential(6);
                }
            } else {
                formattedNewResult = String(newResult);
            }

            const updatedEmbed = successEmbed(
                t(lang, 'wolf.cmd.tools.calculate.title'),
                t(lang, 'wolf.cmd.tools.calculate.desc', {
                    expression: newExpression.replace(/`/g, "\`"),
                    result: formattedNewResult
                })
            );

            try {
                if (context.messageId && context.channelId) {
                    const channel = await client.channels.fetch(context.channelId);
                    const message = await channel.messages.fetch(context.messageId);
                    await message.edit({
                        embeds: [updatedEmbed],
                    });
                }
            } catch (editError) {
                logger.warn(`${t(lang, 'wolf.cmd.tools.calculate.originalMsgWarn')} ${editError.message}`);
            }

            calculationContexts.delete(contextKey);

            await interaction.editReply({
                embeds: [successEmbed(
                    t(lang, 'wolf.cmd.tools.calculate.calculatedTitle'), 
                    `\`${newExpression}\` = \`${formattedNewResult}\``
                )],
            });

        } catch (calcError) {
            logger.error('Calculate evaluation error:', calcError);
            await interaction.editReply({
                embeds: [errorEmbed(
                    t(lang, 'wolf.cmd.tools.calculate.evalErrorTitle'), 
                    t(lang, 'wolf.cmd.tools.calculate.errCheckSyntax')
                )],
            });
        }
    } catch (error) {
        logger.error('Calculate modal handler error:', error);
        try {
            let errLang = 'en';
            try {
                const config = await getGuildConfig(client, interaction.guildId);
                errLang = pickLanguage(config, interaction.guild);
            } catch (e) {}
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    embeds: [errorEmbed('Error', t(errLang, 'wolf.cmd.tools.calculate.generalErr'))],
                    flags: ['Ephemeral']
                });
            } else {
                await interaction.editReply({
                    embeds: [errorEmbed('Error', t(errLang, 'wolf.cmd.tools.calculate.generalErr'))]
                });
            }
        } catch (err) {
            logger.error('Failed to send error message:', err);
        }
    }
}

export default calculateModalHandler;
