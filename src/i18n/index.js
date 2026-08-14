import es from './es.js';
import en from './en.js';

const catalogs = { es, en };

export function normalizeLanguage(language) {
  return language === 'en' ? 'en' : 'es';
}

export function getCatalog(language = 'es') {
  return catalogs[normalizeLanguage(language)];
}

export function translate(language, key, variables = {}) {
  const catalog = getCatalog(language);
  const fallback = getCatalog('es');
  const resolve = (source, path) => path.split('.').reduce((value, part) => value?.[part], source);
  let text = resolve(catalog, key) ?? resolve(fallback, key) ?? key;

  for (const [name, value] of Object.entries(variables)) {
    text = text.replaceAll(`{${name}}`, String(value));
  }
  return text;
}

export function createTranslator(language = 'es') {
  const normalized = normalizeLanguage(language);
  return (key, variables = {}) => translate(normalized, key, variables);
}

export function getSupportedLanguages() {
  return ['es', 'en'];
}
