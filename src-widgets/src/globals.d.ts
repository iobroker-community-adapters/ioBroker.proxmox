import type VisRxWidget from '@iobroker/types-vis-2/visRxWidget';

declare global {
    interface Window {
        /** vis-2's base class for widgets, provided by vis-2 at runtime. */
        visRxWidget: typeof VisRxWidget;
    }
}

export {};
