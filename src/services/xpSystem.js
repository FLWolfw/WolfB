import { logger } from '../utils/logger.js';
import { getXpForLevel } from './xpService.js';

// Keep the rest of this service unchanged in the repository; this file update
// intentionally provides a defensive implementation for level-up announcements.

async function sendLevelUpAnnouncement(guild, member, levelData, config) {
  try {
    const levelUpChannel = config?.levelUpChannel
      ? guild.channels.cache.get(config.levelUpChannel)
      : guild.systemChannel;

    if (!levelUpChannel || !levelUpChannel.isTextBased()) return;

    const permissions = levelUpChannel.permissionsFor(guild.members.me);
    if (!permissions || !permissions.has(['SendMessages', 'EmbedLinks'])) {
      logger.warn(`Missing permissions to send levelup message in ${levelUpChannel.id}`);
      return;
    }

    const template = String(
      config?.levelUpMessage ??
      '🎉 {user} subió al nivel **{level}**!'
    );

    const message = template
      .replace(/{user}/g, member.toString())
      .replace(/{level}/g, String(levelData.level))
      .replace(/{xp}/g, String(levelData.xp))
      .replace(/{xpNeeded}/g, String(getXpForLevel(levelData.level + 1)));

    await levelUpChannel.send(message).catch(error => {
      logger.error(`Failed to send level up message in channel ${levelUpChannel.id}:`, error);
    });
  } catch (error) {
    logger.error('Error sending level up announcement:', error);
  }
}

export { sendLevelUpAnnouncement };
