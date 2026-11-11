/**
 * The styles of the shadow roots. An element fills the box of the host, has a transparent background and inherits
 * `color` and `font`; the colors come from the theme of the host (`--iob-success`, `--iob-primary`, ...), so it
 * looks right in light and dark. The layout follows the box with container queries, nothing is measured:
 *
 * - from 220 px wide: the symbol beside the name, the status at the right; narrower: everything centered
 *   below each other and the buttons without words, like a tile of 1x1
 * - from 130 px high (and 220 px wide): the bars of CPU and RAM
 * - up to 100 px high: one row, the buttons at the right
 */
export const STYLES = `
:host {
    display: block;
    width: 100%;
    height: 100%;
}
.mount {
    width: 100%;
    height: 100%;
    /* the size of the box does not depend on what is in it */
    container-type: size;
}
.edit {
    pointer-events: none;
}
.card {
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    padding: clamp(6px, 4cqmin, 14px);
    display: flex;
    flex-direction: column;
    gap: clamp(4px, 4cqmin, 10px);
    overflow: hidden;
}
.head {
    display: flex;
    align-items: center;
    gap: clamp(6px, 4cqmin, 12px);
    min-width: 0;
}
.avatar {
    --state: var(--iob-text-secondary);
    flex: none;
    box-sizing: border-box;
    width: clamp(28px, 24cqmin, 48px);
    height: clamp(28px, 24cqmin, 48px);
    border-radius: 25%;
    display: grid;
    place-items: center;
    color: #fff;
    background: var(--state);
    transition: background-color 0.3s;
}
.avatar svg {
    width: 60%;
    height: 60%;
}
.titles {
    flex: 1;
    min-width: 0;
}
.name {
    font-weight: 600;
    font-size: clamp(12px, 9cqmin, 17px);
    line-height: 1.3;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.meta {
    display: flex;
    align-items: center;
    gap: 0.7em;
    min-width: 0;
    color: var(--iob-text-secondary);
    font-size: clamp(10px, 7cqmin, 13px);
    line-height: 1.4;
    white-space: nowrap;
    overflow: hidden;
}
.meta span {
    display: inline-flex;
    align-items: center;
    gap: 0.25em;
}
.meta svg {
    width: 1.1em;
    height: 1.1em;
    flex: none;
}
.pill {
    --state: var(--iob-text-secondary);
    flex: none;
    max-width: 100%;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    gap: 0.35em;
    padding: 0.15em 0.75em;
    border-radius: 999px;
    color: var(--state);
    background: color-mix(in srgb, var(--state) 16%, transparent);
    font-size: clamp(10px, 7cqmin, 13px);
    font-weight: 700;
    line-height: 1.5;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.pill svg {
    width: 1.15em;
    height: 1.15em;
    flex: none;
}
.success {
    --state: var(--iob-success);
}
.warning {
    --state: var(--iob-warning);
}
.error {
    --state: var(--iob-error);
}
.neutral {
    --state: var(--iob-text-secondary);
}
.unknown {
    --state: color-mix(in srgb, var(--iob-text-secondary) 60%, transparent);
}
.bars {
    display: flex;
    gap: clamp(8px, 5cqmin, 16px);
}
.bar {
    flex: 1 1 0;
    min-width: 0;
    color: var(--iob-text-secondary);
    font-size: clamp(10px, 6.5cqmin, 12px);
}
.bar .labels {
    display: flex;
    justify-content: space-between;
    gap: 0.4em;
    white-space: nowrap;
}
.bar .labels span:last-child {
    overflow: hidden;
    text-overflow: ellipsis;
}
.bar .track {
    height: 5px;
    margin-top: 2px;
    border-radius: 3px;
    overflow: hidden;
    background: color-mix(in srgb, var(--iob-text-secondary) 25%, transparent);
}
.bar .fill {
    height: 100%;
    background: var(--state);
    transition: width 0.3s;
}
.actions {
    margin-top: auto;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    min-width: 0;
}
.actions .pill {
    flex: 0 1 auto;
}
.actions .push {
    margin-left: auto;
}
button {
    --btn: var(--iob-primary);
    font: inherit;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.4em;
    min-width: 0;
    padding: 0.35em 0.9em;
    border-radius: var(--iob-border-radius);
    border: 1px solid var(--btn);
    color: #fff;
    background: var(--btn);
    font-size: clamp(11px, 7cqmin, 14px);
    font-weight: 600;
    line-height: 1.3;
    white-space: nowrap;
    cursor: pointer;
    transition: opacity 0.2s, filter 0.2s;
}
button:hover:not(:disabled) {
    filter: brightness(1.1);
}
button:focus-visible {
    outline: 2px solid var(--btn);
    outline-offset: 2px;
}
button:disabled {
    opacity: 0.4;
    cursor: default;
}
button svg {
    width: 1.15em;
    height: 1.15em;
    flex: none;
}
button.outlined {
    color: var(--btn);
    background: transparent;
}
button.start {
    --btn: var(--iob-success);
}
button.hard {
    --btn: var(--iob-error);
}
.failed {
    color: var(--iob-error);
    font-size: clamp(10px, 6.5cqmin, 12px);
}
.hint {
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    padding: 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: clamp(2px, 3cqmin, 8px);
    overflow: hidden;
    text-align: center;
    color: var(--iob-text-secondary);
    font-size: clamp(10px, 7cqmin, 15px);
}
.hint svg {
    width: clamp(16px, 14cqmin, 32px);
    height: clamp(16px, 14cqmin, 32px);
    fill: currentColor;
}

/* no room for the bars */
@container (max-height: 129px) {
    .bars {
        display: none;
    }
}

/* a tile: everything centered below each other, the buttons without words */
@container (max-width: 219px) {
    .card {
        align-items: center;
        justify-content: center;
        text-align: center;
    }
    .head {
        flex-direction: column;
        max-width: 100%;
    }
    .titles {
        width: 100%;
    }
    .meta {
        justify-content: center;
    }
    .bars {
        display: none;
    }
    .actions {
        margin-top: 0;
        justify-content: center;
    }
    .actions .push {
        margin-left: 0;
    }
    button .word {
        display: none;
    }
    button {
        padding: 0.35em 0.6em;
    }
}

/* one row: the buttons at the right of the name */
@container (max-height: 100px) and (min-width: 220px) {
    .card {
        flex-direction: row;
        align-items: center;
    }
    .head {
        flex: 1;
    }
    .actions {
        margin-top: 0;
        flex-wrap: nowrap;
    }
    button .word {
        display: none;
    }
}
@container (max-height: 52px) {
    .meta {
        display: none;
    }
}
`;
