/**
 * The symbol of a machine or node: its status color behind the icon of its type, or the icon or image the user chose.
 */

import type React from 'react';
import { Box } from '@mui/material';
import { Computer, Dns, ViewInAr } from '@mui/icons-material';

const SIZE = 40;

/**
 * @param props properties
 * @param props.type `qemu`, `lxc` or `node`
 * @returns the icon of the type
 */
export function MachineTypeIcon({ type }: { type: string }): React.JSX.Element {
    if (type === 'node') {
        return <Dns />;
    }
    return type === 'lxc' ? <ViewInAr /> : <Computer />;
}

interface MachineIconProps {
    /** `qemu`, `lxc` or `node`, empty until it is known */
    type: string;
    /** Background, shows the status */
    color: string;
    /** Result of the icon selector of vis-2, usually a base64 SVG */
    icon?: string;
    /** URL of an image */
    image?: string;
}

export function MachineIcon({ type, color, icon, image }: MachineIconProps): React.JSX.Element {
    if (image) {
        // An image shows its own colors, the status stays visible in the chip next to it
        return (
            <Box
                component="img"
                src={image}
                alt=""
                sx={{ width: SIZE, height: SIZE, flexShrink: 0, objectFit: 'contain', borderRadius: 1 }}
            />
        );
    }

    const avatar = {
        display: 'grid',
        placeItems: 'center',
        width: SIZE,
        height: SIZE,
        flexShrink: 0,
        borderRadius: 2,
        color: '#fff',
        backgroundColor: color,
        transition: 'background-color 0.3s',
    };

    if (icon?.startsWith('data:image/svg')) {
        // In an `img` an SVG cannot take the color of the text, so it is the shape of a white area instead
        const mask = `url("${icon}") center / contain no-repeat`;
        return (
            <Box sx={avatar}>
                <Box sx={{ width: 24, height: 24, backgroundColor: 'currentColor', mask, WebkitMask: mask }} />
            </Box>
        );
    }

    if (icon) {
        return (
            <Box sx={avatar}>
                <Box
                    component="img"
                    src={icon}
                    alt=""
                    sx={{ width: 24, height: 24, objectFit: 'contain' }}
                />
            </Box>
        );
    }

    return (
        <Box sx={avatar}>
            <MachineTypeIcon type={type} />
        </Box>
    );
}
