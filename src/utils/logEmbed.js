import { EmbedBuilder } from 'discord.js';

export function createLogEmbed({
  title,
  color = '#2b2d31',
  user = null,
  thumbnail = null,
  fields = [],
  footer = null
}) {

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setTimestamp();

  if (user) {
    embed.setAuthor({
      name: `${user.tag}`,
      iconURL: user.displayAvatarURL({ dynamic: true })
    });
  }

  if (thumbnail) {
    embed.setThumbnail(thumbnail);
  }

  if (fields.length) {
    embed.addFields(fields);
  }

  if (footer) {
    embed.setFooter({ text: footer });
  }

  return embed;
}