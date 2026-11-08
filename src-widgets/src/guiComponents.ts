/**
 * What the widget set takes from `@iobroker/gui-components`: `I18n`, nothing else.
 *
 * The build points every import of the package here (see `vite.config.ts`). vis-2 does not share
 * gui-components, and the package's entry would pull hundreds of kilobytes into the bundle for a
 * single class. `I18n` keeps the dictionary and the language on `window`, so a second copy is harmless.
 *
 * `Connection` is a type only and needs nothing here. Importing anything else from the package fails
 * the build with a missing export, rather than silently pulling the rest back in.
 */

export { I18n } from '@iobroker/gui-components/build/i18n.js';
