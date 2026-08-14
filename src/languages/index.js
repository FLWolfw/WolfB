import es from './es.js';
import en from './en.js';
import { helpCategories } from './helpCategories.js';
import { ticketFeedbackTranslations } from './ticketFeedback.js';

const languages = { es, en };

// Keep the existing language files intact while allowing smaller feature
// dictionaries to extend them without duplicating the full translation tree.
for (const language of ['es', 'en']) {
  languages[language].wolf ??= {};
  languages[language].wolf.cmd ??= {};
  languages[language].wolf.cmd.help ??= {};
  languages[language].wolf.cmd.help.categories = helpCategories[language];
  languages[language].wolf.ticketFeedback = ticketFeedbackTranslations[language];
}

export function t(language, path) {
  const lang = languages[language] || languages.es;

  if (lang[path] !== undefined) return lang[path];

  const parts = path.split('.');
  for (let i = parts.length - 1; i > 0; i--) {
    const prefix = parts.slice(0, i).join('.');
    if (lang[prefix] !== undefined) {
      const remaining = parts.slice(i);
      let current = lang[prefix];
      for (const key of remaining) {
        if (current && typeof current === 'object') current = current[key];
        else {
          current = undefined;
          break;
        }
      }
      if (current !== undefined) return current;
    }
  }

  return parts.reduce((obj, key) => obj?.[key], lang) || path;
}

export default languages;
