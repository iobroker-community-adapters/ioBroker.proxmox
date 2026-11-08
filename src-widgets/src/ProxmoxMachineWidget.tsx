/**
 * A VM or container as a vis-2 widget.
 *
 * The class is what vis-2 requires: a `VisRxWidget` subclass that declares the settings and draws the
 * card. What is inside the card is {@link MachineCard}, a function component, because it is built on
 * hooks and a class cannot call them.
 */

import type React from 'react';
import { Box, Typography } from '@mui/material';
import { I18n } from '@iobroker/gui-components';
import type { Connection } from '@iobroker/gui-components';
import type { RxRenderWidgetProps, RxWidgetInfo, VisRxWidgetState } from '@iobroker/types-vis-2';
import type VisRxWidget from '@iobroker/types-vis-2/visRxWidget';

import { MachineCard, type StopCommand } from './MachineCard';
import MachineField from './MachineField';

interface MachineRxData {
    /** Full ID of the channel of the machine */
    machine: string;
    /** Not called `widgetTitle`: vis-2 would draw a field of that name into the card header itself */
    machineTitle: string;
    showControls: boolean;
    showDetails: boolean;
    showUptime: boolean;
    showIcon: boolean;
    /** Icon from the selector of vis-2. Without it, the symbol of the type is shown. */
    icon: string;
    /** Image file, it takes precedence over the icon */
    image: string;
    stopCommand: StopCommand;
    askConfirmation: boolean;
    noCard: boolean;
}

/** vis-2 puts this in front of every label below */
const PREFIX = 'proxmox_';

export default class ProxmoxMachineWidget extends (window.visRxWidget as typeof VisRxWidget)<
    MachineRxData,
    VisRxWidgetState
> {
    public static getI18nPrefix(): string {
        return PREFIX;
    }

    public static getWidgetInfo(): RxWidgetInfo {
        return {
            id: 'tplProxmoxMachine',
            visSet: 'proxmox',
            visSetLabel: 'set_label',
            visSetColor: '#e57000',
            visName: 'VM or container',
            visWidgetLabel: 'widget_label',
            visAttrs: [
                {
                    name: 'common',
                    fields: [
                        {
                            name: 'machine',
                            label: 'machine',
                            tooltip: 'machine_help',
                            type: 'custom',
                            // A list of the VMs and containers, instead of searching the channel in the objects
                            component: (_field, data, setData, props) => (
                                <MachineField
                                    socket={props.context.socket as unknown as Connection}
                                    value={typeof data.machine === 'string' ? data.machine : ''}
                                    onChange={machine => setData({ ...data, machine })}
                                />
                            ),
                        },
                        {
                            name: 'machineTitle',
                            label: 'title',
                            tooltip: 'title_help',
                            type: 'text',
                        },
                        {
                            name: 'showControls',
                            label: 'show_controls',
                            tooltip: 'show_controls_help',
                            type: 'checkbox',
                            default: true,
                        },
                        {
                            name: 'stopCommand',
                            label: 'stop_command',
                            type: 'select',
                            options: [
                                { value: 'shutdown', label: 'stop_shutdown' },
                                { value: 'stop', label: 'stop_hard' },
                            ],
                            default: 'shutdown',
                            hidden: 'data.showControls === false',
                        },
                        {
                            name: 'askConfirmation',
                            label: 'ask_confirmation',
                            type: 'checkbox',
                            default: true,
                            hidden: 'data.showControls === false',
                        },
                        {
                            name: 'showDetails',
                            label: 'show_details',
                            type: 'checkbox',
                            default: true,
                        },
                        {
                            name: 'showUptime',
                            label: 'show_uptime',
                            type: 'checkbox',
                            default: true,
                        },
                        {
                            name: 'showIcon',
                            label: 'show_icon',
                            type: 'checkbox',
                            default: true,
                        },
                        {
                            name: 'icon',
                            label: 'icon',
                            tooltip: 'icon_help',
                            type: 'icon64',
                            hidden: 'data.showIcon === false || !!data.image',
                        },
                        {
                            name: 'image',
                            label: 'image',
                            tooltip: 'image_help',
                            type: 'image',
                            hidden: 'data.showIcon === false',
                        },
                        {
                            name: 'noCard',
                            label: 'no_card',
                            type: 'checkbox',
                        },
                    ],
                },
            ],
            visDefaultStyle: {
                width: 300,
                height: 165,
                position: 'relative',
            },
            visPrev: 'widgets/proxmox/img/prev_machine.svg',
        };
    }

    public getWidgetInfo(): RxWidgetInfo {
        return ProxmoxMachineWidget.getWidgetInfo();
    }

    /**
     * URL of an attribute of the type `image`: `_PRJ_NAME/` is the folder of the vis-2 project
     *
     * @param src value of the attribute
     */
    private getImageUrl(src: string | undefined): string {
        const value = (src || '').trim();
        if (value.startsWith('_PRJ_NAME/')) {
            const { adapterName, instance, projectName } = this.props.context;
            return value.replace('_PRJ_NAME/', `../${adapterName}.${instance}/${projectName || 'main'}/`);
        }
        return value;
    }

    public renderWidgetBody(props: RxRenderWidgetProps): React.JSX.Element | React.JSX.Element[] | null {
        super.renderWidgetBody(props);

        const { machine, machineTitle, showControls, showDetails, stopCommand, askConfirmation, noCard } =
            this.state.rxData;
        const { showUptime, showIcon, icon, image } = this.state.rxData;

        const content = (
            <Box
                sx={{
                    width: '100%',
                    height: '100%',
                    flex: '1 1 auto',
                    minHeight: 0,
                    // In the editor the widget is dragged and resized, not used
                    pointerEvents: this.props.editMode ? 'none' : undefined,
                }}
            >
                {machine && machine !== 'nothing_selected' ? (
                    <MachineCard
                        socket={this.props.context.socket}
                        machineId={machine}
                        title={machineTitle}
                        showControls={showControls !== false}
                        showDetails={showDetails !== false}
                        showUptime={showUptime !== false}
                        showIcon={showIcon !== false}
                        icon={icon}
                        image={this.getImageUrl(image)}
                        stopCommand={stopCommand === 'stop' ? 'stop' : 'shutdown'}
                        askConfirmation={askConfirmation !== false}
                        readOnly={!!this.props.editMode}
                    />
                ) : (
                    <Box sx={{ display: 'grid', placeItems: 'center', width: '100%', height: '100%' }}>
                        <Typography
                            variant="caption"
                            sx={{ color: 'text.secondary' }}
                        >
                            {I18n.t(`${PREFIX}no_machine`)}
                        </Typography>
                    </Box>
                )}
            </Box>
        );

        if (noCard || props.widget.usedInWidget) {
            return content;
        }

        return this.wrapContent(content, null, {
            boxSizing: 'border-box',
            height: '100%',
            padding: 12,
            paddingBottom: 12,
        });
    }
}
