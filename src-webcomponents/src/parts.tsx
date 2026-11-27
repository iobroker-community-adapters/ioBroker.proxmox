/**
 * The parts both web components are made of: plain React, the styles in `styles.ts`.
 */
import type { JSX } from 'react';

import {
    getTypeIcon,
    getUsageKind,
    ICON_PATHS,
    type IconName,
    type StatusKind,
} from '../../src-shared/proxmox.ts';

/**
 * A symbol of `ICON_PATHS` in the color of the text.
 *
 * @param props properties
 * @param props.name the symbol
 */
export function Glyph({ name }: { name: IconName }): JSX.Element {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
        >
            {ICON_PATHS[name].map(d => (
                <path
                    key={d}
                    d={d}
                />
            ))}
        </svg>
    );
}

/**
 * The name, the type and the uptime, with the symbol in the color of the status.
 *
 * @param props properties
 * @param props.type `qemu`, `lxc` or `node`, empty while it is not known
 * @param props.kind color group of the status
 * @param props.name the name
 * @param props.typeName for example `LXC`
 * @param props.uptime for example `3 d 4 h`, empty for none
 * @param props.uptimeLabel the tooltip of the uptime
 * @param props.status the status pill
 */
export function Head(props: {
    type: string;
    kind: StatusKind;
    name: string;
    typeName: string;
    uptime: string;
    uptimeLabel: string;
    status: JSX.Element | null;
}): JSX.Element {
    const { type, kind, name, typeName, uptime, uptimeLabel, status } = props;
    return (
        <div className="head">
            <div className={`avatar ${kind}`}>
                <Glyph name={getTypeIcon(type)} />
            </div>
            <div className="titles">
                <div
                    className="name"
                    title={name}
                >
                    {name}
                </div>
                {typeName || uptime ? (
                    <div className="meta">
                        {typeName ? <span>{typeName}</span> : null}
                        {uptime ? (
                            <span title={uptimeLabel}>
                                <Glyph name="uptime" />
                                {uptime}
                            </span>
                        ) : null}
                    </div>
                ) : null}
            </div>
            {status}
        </div>
    );
}

/**
 * A colored pill: the status, or the available updates.
 *
 * @param props properties
 * @param props.kind color group
 * @param props.label the text
 * @param props.icon a symbol in front of the text
 * @param props.title the tooltip
 */
export function Pill({
    kind,
    label,
    icon,
    title,
}: {
    kind: StatusKind;
    label: string;
    icon?: IconName;
    title?: string;
}): JSX.Element {
    return (
        <span
            className={`pill ${kind}`}
            title={title}
        >
            {icon ? <Glyph name={icon} /> : null}
            {label}
        </span>
    );
}

/**
 * A usage as a bar, in the color of how full it is.
 *
 * @param props properties
 * @param props.label name of the value
 * @param props.percent usage in percent, if known
 * @param props.text the value as text
 */
export function UsageBar({
    label,
    percent,
    text,
}: {
    label: string;
    percent: number | undefined;
    text: string;
}): JSX.Element {
    return (
        <div className={`bar ${getUsageKind(percent)}`}>
            <div className="labels">
                <span>{label}</span>
                <span title={text}>{text}</span>
            </div>
            <div className="track">
                <div
                    className="fill"
                    style={{ width: `${Math.min(Math.max(percent ?? 0, 0), 100)}%` }}
                />
            </div>
        </div>
    );
}

/**
 * A button with a symbol; its word is hidden where the box is small.
 *
 * @param props properties
 * @param props.className `start`, `hard` or `outlined`, else the primary color
 * @param props.icon the symbol
 * @param props.label the word
 * @param props.title the tooltip
 * @param props.disabled whether it cannot be pressed
 * @param props.onClick called on a click
 */
export function Button(props: {
    className?: string;
    icon: IconName;
    label: string;
    title?: string;
    disabled: boolean;
    onClick: () => void;
}): JSX.Element {
    const { className, icon, label, title, disabled, onClick } = props;
    return (
        <button
            type="button"
            className={className}
            title={title || label}
            aria-label={title || label}
            disabled={disabled}
            onClick={onClick}
        >
            <Glyph name={icon} />
            <span className="word">{label}</span>
        </button>
    );
}

/**
 * Instead of the content: what is missing in the settings.
 *
 * @param props properties
 * @param props.text the hint
 * @param props.editMode in the editor of the host the hint lets clicks through
 */
export function Hint({ text, editMode }: { text: string; editMode: boolean }): JSX.Element {
    return (
        <div className={editMode ? 'hint edit' : 'hint'}>
            <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
            >
                <path d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8" />
            </svg>
            <span>{text}</span>
        </div>
    );
}
