/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { RegionSubmenu, RegionSubmenuResponse } from '../../shared/ui/common/regionSubmenu'
import { DataQuickPickItem } from '../../shared/ui/pickerPrompter'
import { Ec2Client, SafeEc2Instance } from '../../shared/clients/ec2Client'
import { isValidResponse } from '../../shared/wizards/wizard'
import { CancellationError } from '../../shared/utilities/timeoutUtils'
import { AsyncCollection } from '../../shared/utilities/asyncCollection'
import { getIconCode } from './utils'
import { Ec2Node } from './explorer/ec2ParentNode'
import { Ec2InstanceNode } from './explorer/ec2InstanceNode'

export type instanceFilter = (instance: SafeEc2Instance) => boolean
export interface Ec2Selection {
    instanceId: string
    region: string
}

export class Ec2Prompter {
    public constructor(protected filter?: instanceFilter) {}

    public static getLabel(instance: SafeEc2Instance) {
        const icon = `$(${getIconCode(instance)})`
        return `${instance.Name ?? '(no name)'} \t ${icon} ${instance.LastSeenStatus.toUpperCase()}`
    }

    protected static asQuickPickItem(instance: SafeEc2Instance): DataQuickPickItem<string> {
        return {
            label: Ec2Prompter.getLabel(instance),
            detail: instance.InstanceId,
            data: instance.InstanceId,
        }
    }

    protected static getSelectionFromResponse(response: RegionSubmenuResponse<string>): Ec2Selection {
        return {
            instanceId: response.data,
            region: response.region,
        }
    }

    public async promptUser(): Promise<Ec2Selection> {
        const prompter = this.createEc2ConnectPrompter()
        const response = await prompter.prompt()

        if (isValidResponse(response)) {
            return Ec2Prompter.getSelectionFromResponse(response)
        } else {
            throw new CancellationError('user')
        }
    }

    protected async getInstancesFromRegion(regionCode: string): Promise<AsyncCollection<SafeEc2Instance>> {
        const client = new Ec2Client(regionCode)
        return await client.getInstances()
    }

    protected async getInstancesAsQuickPickItems(region: string): Promise<DataQuickPickItem<string>[]> {
        return (await this.getInstancesFromRegion(region))
            .filter(this.filter ? (instance) => this.filter!(instance) : (instance) => true)
            .map((instance) => Ec2Prompter.asQuickPickItem(instance))
            .promise()
    }

    private createEc2ConnectPrompter(): RegionSubmenu<string> {
        return new RegionSubmenu(
            async (region) => this.getInstancesAsQuickPickItems(region),
            { title: 'Select EC2 Instance', matchOnDetail: true },
            { title: 'Select Region for EC2 Instance' },
            'Instances'
        )
    }
}

export async function getSelection(node?: Ec2Node, filter?: instanceFilter): Promise<Ec2Selection> {
    const prompter = new Ec2Prompter(filter)
    const selection = node && node instanceof Ec2InstanceNode ? node.toSelection() : await prompter.promptUser()
    return selection
}
