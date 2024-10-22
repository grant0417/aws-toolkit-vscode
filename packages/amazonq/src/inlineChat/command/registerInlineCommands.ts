/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import vscode from 'vscode'
import { InlineChatController } from '../controller/inlineChatController'
import { InlineTask } from '../controller/inlineTask'

export function registerInlineCommands(context: vscode.ExtensionContext, inlineChatController: InlineChatController) {
    context.subscriptions.push(
        vscode.commands.registerCommand('aws.amazonq.inline.waitForUserInput', async () => {
            await inlineChatController.inlineQuickPick()
        }),
        vscode.commands.registerCommand('aws.amazonq.inline.waitForUserDecisionAcceptAll', async (task: InlineTask) => {
            await inlineChatController.acceptAllChanges(task, true)
        }),
        vscode.commands.registerCommand('aws.amazonq.inline.waitForUserDecisionRejectAll', async (task: InlineTask) => {
            await inlineChatController.rejectAllChanges(task, true)
        })
    )

    // Line-by-line accept and reject functionality is currently under discussion and will be temporarily commented out
    // vscode.commands.registerCommand(
    //     'aws.amazonq.inline.waitForUserDecisionAccept',
    //     async (task: InlineTask, range: vscode.Range) => {
    //         if (task) {
    //             await inlineCahtController.acceptChange(task, range)
    //         }
    //     }
    // )
    // vscode.commands.registerCommand(
    //     'aws.amazonq.inline.waitForUserDecisionReject',
    //     async (task: InlineTask, range: vscode.Range) => {
    //         if (task) {
    //             await inlineCahtController.rejectChange(task, range)
    //         }
    //     }
    // )
}
