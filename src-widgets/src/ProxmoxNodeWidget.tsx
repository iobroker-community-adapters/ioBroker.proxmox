/**
 * A Proxmox node as a vis-2 widget: its state and its available updates.
 *
 * Built like {@link ProxmoxMachineWidget}: the class declares the settings, {@link NodeCard} draws the card.
 */

import type React from 'react';
import { Box, Typography } from '@mui/material';
import { I18n } from '@iobroker/gui-components';
import type { Connection } from '@iobroker/gui-components';
import type { RxRenderWidgetProps, RxWidgetInfo, VisRxWidgetState } from '@iobroker/types-vis-2';
import type VisRxWidget from '@iobroker/types-vis-2/visRxWidget';

import { NodeCard, type UpdatesMode } from './NodeCard';
import MachineField from './MachineField';

interface NodeRxData {
    /** Full ID of the channel of the node */
    node: string;
    /** Not called `widgetTitle`: vis-2 would draw a field of that name into the card header itself */
    nodeTitle: string;
    updates: UpdatesMode;
    showDetails: boolean;
    showUptime: boolean;
    showIcon: boolean;
    /** Icon from the selector of vis-2. Without it, the symbol of a node is shown. */
    icon: string;
    /** Image file, it takes precedence over the icon */
    image: string;
    noCard: boolean;
}

/** vis-2 puts this in front of every label below */
const PREFIX = 'proxmox_';

/** Only nodes in the list. A constant, so the list is not read again on every render. */
const NODE_TYPES = ['node'];

export default class ProxmoxNodeWidget extends (window.visRxWidget as typeof VisRxWidget)<
    NodeRxData,
    VisRxWidgetState
> {
    public static getI18nPrefix(): string {
        return PREFIX;
    }

    public static getWidgetInfo(): RxWidgetInfo {
        return {
            id: 'tplProxmoxNode',
            visSet: 'proxmox',
            visSetLabel: 'set_label',
            visSetColor: '#e57000',
            visName: 'Proxmox node',
            visWidgetLabel: 'node_widget_label',
            visAttrs: [
                {
                    name: 'common',
                    fields: [
                        {
                            name: 'node',
                            label: 'node',
                            tooltip: 'node_help',
                            type: 'custom',
                            component: (_field, data, setData, props) => (
                                <MachineField
                                    socket={props.context.socket as unknown as Connection}
                                    value={typeof data.node === 'string' ? data.node : ''}
                                    onChange={node => setData({ ...data, node })}
                                    types={NODE_TYPES}
                                    emptyLabel="proxmox_no_node"
                                />
                            ),
                        },
                        {
                            name: 'nodeTitle',
                            label: 'title',
                            tooltip: 'node_title_help',
                            type: 'text',
                        },
                        {
                            name: 'updates',
                            label: 'updates',
                            tooltip: 'updates_help',
                            type: 'select',
                            options: [
                                { value: 'control', label: 'updates_control' },
                                { value: 'show', label: 'updates_show' },
                                { value: 'hidden', label: 'updates_hidden' },
                            ],
                            default: 'control',
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
            visPrev: 'widgets/proxmox/img/prev_node.svg',
        };
    }

    public getWidgetInfo(): RxWidgetInfo {
        return ProxmoxNodeWidget.getWidgetInfo();
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

        const { node, nodeTitle, updates, showDetails, showUptime, showIcon, icon, image, noCard } = this.state.rxData;

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
                {node && node !== 'nothing_selected' ? (
                    <NodeCard
                        socket={this.props.context.socket}
                        nodeId={node}
                        title={nodeTitle}
                        updates={updates === 'show' || updates === 'hidden' ? updates : 'control'}
                        showDetails={showDetails !== false}
                        showUptime={showUptime !== false}
                        showIcon={showIcon !== false}
                        icon={icon}
                        image={this.getImageUrl(image)}
                        readOnly={!!this.props.editMode}
                    />
                ) : (
                    <Box sx={{ display: 'grid', placeItems: 'center', width: '100%', height: '100%' }}>
                        <Typography
                            variant="caption"
                            sx={{ color: 'text.secondary' }}
                        >
                            {I18n.t(`${PREFIX}no_node`)}
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
