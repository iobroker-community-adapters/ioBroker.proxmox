/**
 * Icons für den Device Manager als Base64-SVG.
 *
 * Der Admin kennt nur wenige `fa-*`-Namen und zeigt für alle anderen ein Fragezeichen. Ein SVG rendert er
 * inline, deshalb übernimmt es über `currentColor` die Farbe der Anzeige. Die Pfade sind Material Icons.
 */

function toDataUrl(...paths: string[]): string {
    const content = paths.map(d => `<path d="${d}"/>`).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">${content}</svg>`;
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

export const ICONS = {
    /** Dns */
    node: toDataUrl(
        'M20 13H4c-.55 0-1 .45-1 1v6c0 .55.45 1 1 1h16c.55 0 1-.45 1-1v-6c0-.55-.45-1-1-1M7 19c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2M20 3H4c-.55 0-1 .45-1 1v6c0 .55.45 1 1 1h16c.55 0 1-.45 1-1V4c0-.55-.45-1-1-1M7 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2',
    ),
    /** Computer */
    qemu: toDataUrl(
        'M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2zM4 6h16v10H4z',
    ),
    /** ViewInAr */
    lxc: toDataUrl(
        'm18.25 7.6-5.5-3.18c-.46-.27-1.04-.27-1.5 0L5.75 7.6c-.46.27-.75.76-.75 1.3v6.35c0 .54.29 1.03.75 1.3l5.5 3.18c.46.27 1.04.27 1.5 0l5.5-3.18c.46-.27.75-.76.75-1.3V8.9c0-.54-.29-1.03-.75-1.3M7 14.96v-4.62l4 2.32v4.61zm5-4.03L8 8.61l4-2.31 4 2.31zm1 6.34v-4.61l4-2.32v4.62zM7 2H3.5C2.67 2 2 2.67 2 3.5V7h2V4h3zm10 0h3.5c.83 0 1.5.67 1.5 1.5V7h-2V4h-3zM7 22H3.5c-.83 0-1.5-.67-1.5-1.5V17h2v3h3zm10 0h3.5c.83 0 1.5-.67 1.5-1.5V17h-2v3h-3z',
    ),
    /** Speed */
    cpu: toDataUrl(
        'm20.38 8.57-1.23 1.85a8 8 0 0 1-.22 7.58H5.07A8 8 0 0 1 15.58 6.85l1.85-1.23A10 10 0 0 0 3.35 19a2 2 0 0 0 1.72 1h13.85a2 2 0 0 0 1.74-1 10 10 0 0 0-.27-10.44zm-9.79 6.84a2 2 0 0 0 2.83 0l5.66-8.49-8.49 5.66a2 2 0 0 0 0 2.83',
    ),
    /** Memory */
    memory: toDataUrl(
        'M15 9H9v6h6zm-2 4h-2v-2h2zm8-2V9h-2V7c0-1.1-.9-2-2-2h-2V3h-2v2h-2V3H9v2H7c-1.1 0-2 .9-2 2v2H3v2h2v2H3v2h2v2c0 1.1.9 2 2 2h2v2h2v-2h2v2h2v-2h2c1.1 0 2-.9 2-2v-2h2v-2h-2v-2zm-4 6H7V7h10z',
    ),
    /** Storage */
    disk: toDataUrl('M2 20h20v-4H2zm2-3h2v2H4zM2 4v4h20V4zm4 3H4V5h2zm-4 7h20v-4H2zm2-3h2v2H4z'),
    /** Schedule */
    uptime: toDataUrl(
        'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2M12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8',
        'M12.5 7H11v6l5.25 3.15.75-1.23-4.5-2.67z',
    ),
    /** PowerSettingsNew */
    power: toDataUrl(
        'M13 3h-2v10h2zm4.83 2.17-1.42 1.42C17.99 7.86 19 9.81 19 12c0 3.87-3.13 7-7 7s-7-3.13-7-7c0-2.19 1.01-4.14 2.58-5.42L6.17 5.17C4.23 6.82 3 9.26 3 12c0 4.97 4.03 9 9 9s9-4.03 9-9c0-2.74-1.23-5.18-3.17-6.83',
    ),
    /** SwapHoriz */
    swap: toDataUrl('M6.99 11 3 15l3.99 4v-3H14v-2H6.99zM21 9l-3.99-4v3H10v2h7.01v3z'),
    /** CheckCircle */
    ok: toDataUrl(
        'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8z',
    ),
    /** StopCircle */
    stopped: toDataUrl('M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m4 14H8V8h8z'),
    /** PauseCircle */
    paused: toDataUrl('M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m-1 14H9V8h2zm4 0h-2V8h2z'),
    /** Error */
    error: toDataUrl('M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m1 15h-2v-2h2zm0-4h-2V7h2z'),
    /** Help */
    unknown: toDataUrl(
        'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m1 17h-2v-2h2zm2.07-7.75-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25',
    ),
};
