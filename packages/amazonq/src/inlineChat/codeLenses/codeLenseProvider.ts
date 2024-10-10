/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import * as vscode from 'vscode'
import { InlineTask, TaskState } from '../controller/inlineTask'
export class CodelensProvider implements vscode.CodeLensProvider {
    private inlineTask: InlineTask | undefined
    private codeLenses: vscode.CodeLens[] = []
    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>()
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event

    constructor(context: vscode.ExtensionContext) {
        context.subscriptions.push(vscode.languages.registerCodeLensProvider('*', this))
        this.provideCodeLenses = this.provideCodeLenses.bind(this)
    }

    public provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.CodeLens[] {
        if (!this.inlineTask) {
            const editor = vscode.window.activeTextEditor
            if (editor) {
                const selection = editor.selection
                if (!selection.isEmpty) {
                    this.codeLenses = []
                    this.codeLenses.push(
                        new vscode.CodeLens(new vscode.Range(selection.start, selection.start), {
                            title: 'Amazon Q: Edit ( \u2318  + I )',
                            command: 'aws.amazonq.inline.waitForUserInput',
                        })
                    )
                    this._onDidChangeCodeLenses.fire()
                } else {
                    this.codeLenses = []
                    this._onDidChangeCodeLenses.fire()
                }
            }
        }

        return this.codeLenses
    }

    public setTask(task: InlineTask | undefined) {
        this.inlineTask = task
    }

    public updateLenses(task: InlineTask): void {
        if (task.state === TaskState.Complete) {
            this.codeLenses = []
            this._onDidChangeCodeLenses.fire()
            return
        }
        // Line-by-line accept and reject functionality is currently under discussion and will be temporarily commented out
        // const diffBlocks = getDiffBlocks(task)
        switch (task.state) {
            case TaskState.InProgress:
                this.codeLenses = []
                this.codeLenses.push(
                    new vscode.CodeLens(new vscode.Range(task.selectedRange.start, task.selectedRange.start), {
                        title: 'Amazon Q is generating...',
                        command: '',
                    })
                )
                break
            case TaskState.WaitingForDecision:
                this.codeLenses = []

                this.codeLenses.push(
                    new vscode.CodeLens(new vscode.Range(task.selectedRange.start, task.selectedRange.start), {
                        title: 'Accept all ($(newline))',
                        command: 'aws.amazonq.inline.waitForUserDecisionAcceptAll',
                        arguments: [task],
                    })
                )
                this.codeLenses.push(
                    new vscode.CodeLens(new vscode.Range(task.selectedRange.start, task.selectedRange.start), {
                        title: `Reject all ( \u238B )`,
                        command: 'aws.amazonq.inline.waitForUserDecisionRejectAll',
                        arguments: [task],
                    })
                )

                // Line-by-line accept and reject functionality is currently under discussion and will be temporarily commented out
                // for (const diffBlock of diffBlocks) {
                //     this.codeLenses.push(
                //         new vscode.CodeLens(diffBlock, {
                //             title: 'Accept ($(newline))',
                //             command: 'aws.amazonq.inline.waitForUserDecisionAccept',
                //             arguments: [task, diffBlock],
                //         })
                //     )
                //     this.codeLenses.push(
                //         new vscode.CodeLens(diffBlock, {
                //             title: `Reject ( \u238B )`,
                //             command: 'aws.amazonq.inline.waitForUserDecisionReject',
                //             arguments: [task, diffBlock],
                //         })
                //     )
                // }
                break
            default:
                this.codeLenses = []
                break
        }
        this._onDidChangeCodeLenses.fire()
    }
}
