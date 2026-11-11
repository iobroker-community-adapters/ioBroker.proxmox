/**
 * The parts both widgets are made of. React and MUI come from the host through `@iobroker/dm-widgets`, so the
 * widgets share its instances. Of MUI only `Box` and `Typography` are used, the smallest set every host bridges;
 * the symbols are drawn as SVG paths instead of depending on an icon of the host.
 */
import type React from 'react';
import { AdapterReact, MuiMaterial } from '@iobroker/dm-widgets';
import type { BoxProps, TypographyProps } from '@mui/material';
import type { Icon as IconType, I18n as I18nType } from '@iobroker/gui-components';

import {
    getTypeIcon,
    getUsageKind,
    ICON_PATHS,
    STATUS_COLORS,
    type IconName,
    type StatusKind,
} from '../../src-shared/proxmox';

export const Box: React.ComponentType<BoxProps> = MuiMaterial?.Box;
/** The same `Box`, typed as a `button` */
const ButtonBox = MuiMaterial?.Box as React.ComponentType<BoxProps<'button'>>;
export const Typography: React.ComponentType<TypographyProps> = MuiMaterial?.Typography;
export const I18n = AdapterReact.I18n as typeof I18nType;
const Icon = AdapterReact.Icon as typeof IconType;

/** The color of a button */
export type ButtonColor = 'success' | 'primary' | 'error';

/**
 * A symbol of `ICON_PATHS` in the color of the text.
 *
 * @param props properties
 * @param props.name the symbol
 * @param props.size width and height
 */
export function Glyph({ name, size }: { name: IconName; size: number | string }): React.JSX.Element {
    return (
        <svg
            viewBox="0 0 24 24"
            width={size}
            height={size}
            fill="currentColor"
            aria-hidden="true"
            style={{ flex: 'none' }}
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
 * The symbol of the machine or node: the status color behind the icon of the type, or behind the icon the user
 * chose.
 *
 * @param props properties
 * @param props.type `qemu`, `lxc` or `node`, empty while it is not known
 * @param props.kind color group of the status
 * @param props.icon the icon of the settings
 * @param props.size width and height
 */
export function Avatar({
    type,
    kind,
    icon,
    size,
}: {
    type: string;
    kind: StatusKind;
    icon?: string;
    size: number | string;
}): React.JSX.Element {
    return (
        <Box
            sx={{
                width: size,
                height: size,
                flex: 'none',
                display: 'grid',
                placeItems: 'center',
                borderRadius: '25%',
                color: '#fff',
                backgroundColor: STATUS_COLORS[kind],
                transition: 'background-color 0.3s',
            }}
        >
            {icon ? (
                <Icon
                    src={icon}
                    style={{ width: '60%', height: '60%', color: '#fff' }}
                />
            ) : (
                <Glyph
                    name={getTypeIcon(type)}
                    size="60%"
                />
            )}
        </Box>
    );
}

/**
 * The status as a colored pill.
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
}): React.JSX.Element {
    return (
        <Box
            component="span"
            title={title}
            sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3em',
                maxWidth: '100%',
                px: '0.7em',
                py: '0.15em',
                borderRadius: 999,
                color: '#fff',
                backgroundColor: STATUS_COLORS[kind],
                fontSize: '0.72rem',
                fontWeight: 700,
                lineHeight: 1.5,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
            }}
        >
            {icon ? (
                <Glyph
                    name={icon}
                    size="1.1em"
                />
            ) : null}
            {label}
        </Box>
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
}): React.JSX.Element {
    return (
        <Box sx={{ flex: '1 1 0', minWidth: 0 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 0.5, opacity: 0.75 }}>
                <Typography
                    variant="caption"
                    noWrap
                >
                    {label}
                </Typography>
                <Typography
                    variant="caption"
                    noWrap
                    title={text}
                >
                    {text}
                </Typography>
            </Box>
            <Box sx={{ height: 5, borderRadius: 1, overflow: 'hidden', backgroundColor: 'rgba(128, 128, 128, 0.25)' }}>
                <Box
                    sx={{
                        height: '100%',
                        width: `${Math.min(Math.max(percent ?? 0, 0), 100)}%`,
                        backgroundColor: STATUS_COLORS[getUsageKind(percent)],
                        transition: 'width 0.3s',
                    }}
                />
            </Box>
        </Box>
    );
}

/**
 * A button of the widget. Its click does not reach the tile.
 *
 * @param props properties
 * @param props.icon the symbol
 * @param props.label the text, empty for a symbol only
 * @param props.title the tooltip
 * @param props.color the background
 * @param props.disabled whether it cannot be pressed
 * @param props.outlined only a border in the color, for a minor action
 * @param props.onClick called on a click
 */
export function ActionButton({
    icon,
    label,
    title,
    color,
    disabled,
    outlined,
    onClick,
}: {
    icon: IconName;
    label?: string;
    title?: string;
    color: ButtonColor;
    disabled: boolean;
    outlined?: boolean;
    onClick: () => void;
}): React.JSX.Element {
    return (
        <ButtonBox
            component="button"
            type="button"
            title={title || label}
            aria-label={title || label}
            disabled={disabled}
            onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                if (!disabled) {
                    onClick();
                }
            }}
            sx={theme => {
                const main = theme.palette[color].main;
                return {
                    all: 'unset',
                    boxSizing: 'border-box',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.35em',
                    minWidth: 0,
                    maxWidth: '100%',
                    px: label ? '0.8em' : '0.45em',
                    py: '0.3em',
                    borderRadius: 1,
                    border: `1px solid ${main}`,
                    color: outlined ? main : theme.palette[color].contrastText,
                    backgroundColor: outlined ? 'transparent' : main,
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    lineHeight: 1.4,
                    whiteSpace: 'nowrap',
                    cursor: disabled ? 'default' : 'pointer',
                    opacity: disabled ? 0.4 : 1,
                    transition: 'opacity 0.2s, filter 0.2s',
                    '&:hover': disabled ? undefined : { filter: 'brightness(1.1)' },
                    '&:focus-visible': { outline: `2px solid ${main}`, outlineOffset: 2 },
                };
            }}
        >
            <Glyph
                name={icon}
                size="1.15em"
            />
            {label ? (
                <Box
                    component="span"
                    sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}
                >
                    {label}
                </Box>
            ) : null}
        </ButtonBox>
    );
}

/**
 * The name of the machine or node, on one line.
 *
 * @param props properties
 * @param props.name the name
 * @param props.big whether it is the main line of a large tile
 */
export function Name({ name, big }: { name: string; big?: boolean }): React.JSX.Element {
    return (
        <Typography
            variant={big ? 'subtitle1' : 'body2'}
            noWrap
            title={name}
            sx={{ fontWeight: 600, lineHeight: 1.3, maxWidth: '100%' }}
        >
            {name}
        </Typography>
    );
}

/**
 * The type and the uptime under the name.
 *
 * @param props properties
 * @param props.typeName for example `LXC`
 * @param props.uptime for example `3 d 4 h`, empty for none
 */
export function Meta({ typeName, uptime }: { typeName: string; uptime: string }): React.JSX.Element {
    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0, opacity: 0.7 }}>
            {typeName ? (
                <Typography
                    variant="caption"
                    noWrap
                >
                    {typeName}
                </Typography>
            ) : null}
            {uptime ? (
                <Box
                    title={I18n.t('proxmox_uptime')}
                    sx={{ display: 'flex', alignItems: 'center', gap: 0.25, minWidth: 0 }}
                >
                    <Glyph
                        name="uptime"
                        size={13}
                    />
                    <Typography
                        variant="caption"
                        noWrap
                    >
                        {uptime}
                    </Typography>
                </Box>
            ) : null}
        </Box>
    );
}

/**
 * A text instead of the content, while the settings do not name a machine or node.
 *
 * @param props properties
 * @param props.text the hint
 */
export function Hint({ text }: { text: string }): React.JSX.Element {
    return (
        <Typography
            variant="caption"
            sx={{ textAlign: 'center', opacity: 0.7, px: 1 }}
        >
            {text}
        </Typography>
    );
}
