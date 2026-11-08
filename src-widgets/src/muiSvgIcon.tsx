/**
 * Stands in for `@mui/material/SvgIcon`, so that the icons use the MUI of vis-2 too.
 *
 * vis-2 shares `@mui/material` as a singleton, but only under that bare name. The icon package
 * reaches for the deep path `@mui/material/SvgIcon`, which the share scope does not cover, so a second
 * copy of MUI would end up in this bundle. The build points that deep path here (see `vite.config.ts`).
 */

import type React from 'react';
import { forwardRef, memo } from 'react';
import { SvgIcon } from '@mui/material';
import type { SvgIconProps } from '@mui/material';

export default SvgIcon;
export { SvgIcon };

/**
 * What `@mui/icons-material` calls for each icon: its paths wrapped in an `SvgIcon`.
 *
 * @param path the icon's SVG children
 * @param displayName the icon's name, used for its `data-testid`
 */
export function createSvgIcon(path: React.ReactNode, displayName: string): React.ComponentType<SvgIconProps> {
    const Icon = forwardRef<SVGSVGElement, SvgIconProps>((props, ref) => (
        <SvgIcon
            data-testid={`${displayName}Icon`}
            ref={ref}
            {...props}
        >
            {path}
        </SvgIcon>
    ));
    Icon.displayName = `${displayName}Icon`;
    return memo(Icon);
}
