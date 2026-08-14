import es from './es.js';
import en from './en.js';

const languages = {

  es,
  en

};

export function t(
  language,
  path
) {

  const lang =
    languages[language] ||
    languages.es;

  if (lang[path] !== undefined) {
    return lang[path];
  }

  const parts = path.split('.');
  for (let i = parts.length - 1; i > 0; i--) {
    const prefix = parts.slice(0, i).join('.');
    if (lang[prefix] !== undefined) {
      const remaining = parts.slice(i);
      let current = lang[prefix];
      for (const key of remaining) {
        if (current && typeof current === 'object') {
          current = current[key];
        } else {
          current = undefined;
          break;
        }
      }
      if (current !== undefined) {
        return current;
      }
    }
  }

  return path
    .split('.')
    .reduce(

      (obj, key) =>

        obj?.[key],

      lang

    ) || path;
}

export default languages;