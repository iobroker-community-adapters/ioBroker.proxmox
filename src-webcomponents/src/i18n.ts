/**
 * The words of the web components: the same as the vis-2 and devices widgets (`src-shared/translations.ts`),
 * compiled into each module.
 */
import shared from '../../src-shared/translations.ts';

export type WordKey = keyof typeof shared.en;

/** The languages of ioBroker, all of them translated */
export const LANGUAGES: ioBroker.Languages[] = ['en', 'de', 'ru', 'pt', 'nl', 'fr', 'it', 'es', 'pl', 'uk', 'zh-cn'];

/**
 * @param lang language of the user
 * @param key the word
 * @param args put in for `%s`, one after the other
 * @returns the word in the language, English if the language is unknown
 */
export function getWord(lang: ioBroker.Languages, key: WordKey, ...args: string[]): string {
    const words = (shared as unknown as Record<string, Record<WordKey, string> | undefined>)[lang] || shared.en;
    let text = words[key] || shared.en[key] || key;
    for (const arg of args) {
        text = text.replace('%s', arg);
    }
    return text;
}

/**
 * @param key the word
 * @returns the word in every language, for a manifest
 */
export function getTranslated(key: WordKey): ioBroker.Translated {
    const result: Partial<ioBroker.Translated> = {};
    for (const lang of LANGUAGES) {
        result[lang] = getWord(lang, key);
    }
    return result as ioBroker.Translated;
}
