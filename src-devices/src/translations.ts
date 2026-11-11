/**
 * The words of the widgets, loaded by devices before the components (`I18n.extendTranslations`). The same words
 * as the vis-2 widgets, see `src-shared/translations.ts`, without the `prefix` that only vis-2 reads.
 */
import shared from '../../src-shared/translations';

const { en, de, ru, pt, nl, fr, it, es, pl, uk } = shared;

export default { en, de, ru, pt, nl, fr, it, es, pl, uk, 'zh-cn': shared['zh-cn'] };
