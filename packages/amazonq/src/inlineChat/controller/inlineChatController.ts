/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
import { randomUUID } from 'crypto'
import * as vscode from 'vscode'
import { InlineDecorator } from '../decorations/inlineDecorator'
import { InlineChatProvider } from '../provider/inlineChatProvider'
import { InlineTask, TaskState, TextDiff } from './inlineTask'
import { responseTransformer } from '../output/responseTransformer'
import { computeDiff, adjustTextDiffForEditing } from '../output/computeDiff'
import { computeDecorations } from '../decorations/computeDecorations'
import { CodelensProvider } from '../codeLenses/codeLenseProvider'
import { ReferenceLogController, extractLanguageNameFromFile } from 'aws-core-vscode/codewhispererChat'
import { CodeWhispererSettings } from 'aws-core-vscode/codewhisperer'
import { getLogger, messages, setContext, Timeout } from 'aws-core-vscode/shared'

export class InlineChatController {
    private task: InlineTask | undefined
    private readonly decorator = new InlineDecorator()
    private readonly inlineChatProvider: InlineChatProvider
    private readonly codeLenseProvider: CodelensProvider
    private readonly referenceLogController = new ReferenceLogController()
    private userQuery: string | undefined

    constructor(context: vscode.ExtensionContext) {
        this.inlineChatProvider = new InlineChatProvider()
        this.inlineChatProvider.onErrorOccured(() => this.handleError())
        this.codeLenseProvider = new CodelensProvider(context)
    }

    public async createTask(
        query: string,
        document: vscode.TextDocument,
        selectionRange: vscode.Range
    ): Promise<InlineTask> {
        const inlineTask = new InlineTask(query, document, selectionRange)
        return inlineTask
    }

    public async acceptAllChanges(task = this.task): Promise<void> {
        if (!task) {
            return
        }
        const editor = vscode.window.visibleTextEditors.find(
            (editor) => editor.document.uri.toString() === task.document.uri.toString()
        )
        if (!editor) {
            return
        }
        this.inlineChatProvider.sendTelemetryEvent(
            {
                userDecision: 'ACCEPT',
            },
            this.task
        )
        const deletions = task.diff.filter((diff) => diff.type === 'deletion')
        await editor.edit(
            (editBuilder) => {
                for (const deletion of deletions) {
                    editBuilder.delete(deletion.range)
                }
            },
            { undoStopAfter: false, undoStopBefore: false }
        )
        task.diff = []
        task.updateDecorations()
        this.decorator.applyDecorations(task)
        await this.updateTaskAndLenses(task)
        this.referenceLogController.addReferenceLog(task.codeReferences, task.replacement ? task.replacement : '')
    }

    public async rejectAllChanges(task = this.task): Promise<void> {
        if (!task) {
            return
        }
        const editor = vscode.window.visibleTextEditors.find(
            (editor) => editor.document.uri.toString() === task.document.uri.toString()
        )
        if (!editor) {
            return
        }
        this.inlineChatProvider.sendTelemetryEvent(
            {
                userDecision: 'REJECT',
            },
            this.task
        )
        const insertions = task.diff.filter((diff) => diff.type === 'insertion')
        await editor.edit(
            (editBuilder) => {
                for (const insertion of insertions) {
                    editBuilder.delete(insertion.range)
                }
            },
            { undoStopAfter: false, undoStopBefore: false }
        )
        task.diff = []
        task.updateDecorations()
        this.decorator.applyDecorations(task)
        await this.updateTaskAndLenses(task)
        this.referenceLogController.addReferenceLog(task.codeReferences, task.replacement ? task.replacement : '')
    }

    // Line-by-line accept and reject functionality is currently under discussion and will be temporarily commented out
    // public async acceptChange(task: InlineTask, range: vscode.Range): Promise<void> {
    //     const affectedChanges = task.diff?.filter((edit) => range.contains(edit.range))
    //     const editor = vscode.window.visibleTextEditors.find(
    //         (editor) => editor.document.uri.toString() === task.document.uri.toString()
    //     )
    //     if (!affectedChanges || !editor) {
    //         return
    //     }

    //     this.inlineChatProvider.sendTelemetryEvent(
    //         {
    //             userDecision: 'ACCEPT',
    //         },
    //         this.task
    //     )

    //     let deletedLines = 0
    //     for (const change of affectedChanges) {
    //         if (change.type === 'deletion') {
    //             await editor.edit(
    //                 (editBuilder) => {
    //                     editBuilder.delete(change.range)
    //                 },
    //                 { undoStopAfter: false, undoStopBefore: false }
    //             )
    //             deletedLines += change.range.end.line - change.range.start.line
    //         }
    //         task.removeDiffChangeByRange(change.range)
    //     }
    //     task.updateDiff(range, deletedLines)
    //     task.updateDecorations()
    //     this.decorator.applyDecorations(task)
    //     await this.updateTaskAndLenses(task)
    //     this.referenceLogController.addReferenceLog(task.codeReferences, task.replacement ? task.replacement : '')
    // }

    // public async rejectChange(task: InlineTask, range: vscode.Range): Promise<void> {
    //     const affectedChanges = task.diff.filter((edit) => range.contains(edit.range))
    //     const editor = vscode.window.visibleTextEditors.find(
    //         (editor) => editor.document.uri.toString() === task.document.uri.toString()
    //     )
    //     if (!affectedChanges || !editor) {
    //         return
    //     }

    //     this.inlineChatProvider.sendTelemetryEvent(
    //         {
    //             userDecision: 'REJECT',
    //         },
    //         this.task
    //     )

    //     let deletedLines = 0
    //     for (const change of affectedChanges) {
    //         if (change.type === 'insertion') {
    //             await editor.edit(
    //                 (editBuilder) => {
    //                     editBuilder.delete(change.range)
    //                 },
    //                 { undoStopAfter: false, undoStopBefore: false }
    //             )
    //             deletedLines += change.range.end.line - change.range.start.line
    //         }
    //         task.removeDiffChangeByRange(change.range)
    //     }

    //     task.updateDiff(range, deletedLines)
    //     task.updateDecorations()
    //     this.decorator.applyDecorations(task)
    //     await this.updateTaskAndLenses(task)
    // }

    public async updateTaskAndLenses(task: InlineTask, taskState?: TaskState) {
        if (taskState) {
            task.state = taskState
        } else if (!task.diff || task.diff.length === 0) {
            // If the previous state was waiting for a decision and the code diff is clean, then we mark the task as completed
            if (task.state === TaskState.WaitingForDecision) {
                task.state = TaskState.Complete
            }
        }
        this.codeLenseProvider.updateLenses(task)
        await this.refreshCodeLenses(task)
        if (task.state === TaskState.Complete) {
            this.reset()
        }
    }

    private async handleError() {
        if (!this.task) {
            return
        }
        this.task.state = TaskState.Error
        this.codeLenseProvider.updateLenses(this.task)
        await this.refreshCodeLenses(this.task)
        this.reset()
    }

    private reset() {
        this.task = undefined
        this.codeLenseProvider.setTask(undefined)
    }

    private async refreshCodeLenses(task: InlineTask): Promise<void> {
        await vscode.commands.executeCommand('vscode.executeCodeLensProvider', task.document.uri)
    }

    public async inlineQuickPick(previouseQuery?: string) {
        const editor = vscode.window.activeTextEditor
        if (!editor) {
            return
        }

        await vscode.window
            .showInputBox({
                value: previouseQuery || '',
                placeHolder: 'Enter instrucations...',
            })
            .then(async (query) => {
                this.userQuery = query
                if (!query) {
                    return
                }
                this.task = await this.createTask(query, editor.document, editor.selection)
                this.codeLenseProvider.setTask(this.task)
                await this.computeDiffAndRenderOnEditor(query, editor.document)
            })
    }

    private async computeDiffAndRenderOnEditor(query: string, document: vscode.TextDocument) {
        if (!this.task) {
            return
        }

        await this.updateTaskAndLenses(this.task, TaskState.InProgress)
        const language = extractLanguageNameFromFile(document)
        const pureCodePrompt = this.inlineChatProvider.getPureCodePrompt(query, this.task.selectedText, language)
        getLogger().info(`codePrompt:\n${pureCodePrompt}`)
        const uuid = randomUUID()
        const message = {
            message: pureCodePrompt,
            messageId: uuid,
            command: undefined,
            userIntent: undefined,
            tabID: uuid,
        }

        const requestStart = performance.now()
        let responseStartLatency: number | undefined
        let codeChunkCounter = 0

        const response = await this.inlineChatProvider.processPromptMessage(message)
        this.task.requestId = response?.$metadata.requestId

        if (response) {
            let qSuggestedCodeResponse = ''
            for await (const chatEvent of response.generateAssistantResponseResponse!) {
                if (
                    chatEvent.assistantResponseEvent?.content !== undefined &&
                    chatEvent.assistantResponseEvent.content.length > 0
                ) {
                    if (responseStartLatency === undefined) {
                        responseStartLatency = performance.now() - requestStart
                    }
                    if (this.task.previouseDiff) {
                        await this.rejectAllChanges(this.task)
                    }

                    qSuggestedCodeResponse += chatEvent.assistantResponseEvent.content

                    const transformedResponse = responseTransformer(qSuggestedCodeResponse, this.task, false)
                    if (transformedResponse) {
                        const textDiff = computeDiff(transformedResponse, this.task, true)
                        const decorations = computeDecorations(this.task)
                        this.task.decorations = decorations
                        await this.applyDiff(this.task!, textDiff ?? [], {
                            undoStopBefore: false,
                            undoStopAfter: false,
                        })
                        this.decorator.applyDecorations(this.task)
                        this.task.previouseDiff = textDiff
                        codeChunkCounter += 1
                    }
                }
                if (
                    chatEvent.codeReferenceEvent?.references !== undefined &&
                    chatEvent.codeReferenceEvent.references.length > 0
                ) {
                    this.task.codeReferences = this.task.codeReferences.concat(chatEvent.codeReferenceEvent?.references)
                    // clear diff if user settings is off for code reference
                    if (!CodeWhispererSettings.instance.isSuggestionsWithCodeReferencesEnabled()) {
                        await this.rejectAllChanges(this.task)
                        void vscode.window.showInformationMessage(
                            'Your settings do not allow code generation with references.'
                        )
                        await this.updateTaskAndLenses(this.task, TaskState.Complete)
                        return
                    }
                }
            }

            this.task.responseStartLatency = responseStartLatency
            this.task.responseEndLatency = performance.now() - requestStart
            if (codeChunkCounter === 1) {
                // If the code response has only one chunk, we don't need to execute the final diff
                await this.updateTaskAndLenses(this.task, TaskState.WaitingForDecision)
                await setContext('amazonq.inline.codelensShortcutEnabled', true)
                this.undoListener(this.task)
                return
            }
            if (this.task.previouseDiff) {
                await this.rejectAllChanges(this.task)
            }
            getLogger().info(`qSuggestedCodeResponse:\n${qSuggestedCodeResponse}`)
            const transformedResponse = responseTransformer(qSuggestedCodeResponse, this.task, true)
            if (transformedResponse) {
                const textDiff = computeDiff(transformedResponse, this.task, false)
                const decorations = computeDecorations(this.task)
                this.task.decorations = decorations
                await this.applyDiff(this.task, textDiff ?? [])
                this.decorator.applyDecorations(this.task)
                await this.updateTaskAndLenses(this.task, TaskState.WaitingForDecision)
                await setContext('amazonq.inline.codelensShortcutEnabled', true)
            } else {
                void messages.showMessageWithCancel(
                    'No suggestions from Q, please try different instructions.',
                    new Timeout(5000)
                )
                await this.updateTaskAndLenses(this.task, TaskState.Complete)
                await this.inlineQuickPick(this.userQuery)
                await this.handleError()
            }
            this.undoListener(this.task)
        }
    }

    private async applyDiff(
        task: InlineTask,
        textDiff: TextDiff[],
        undoOption?: { undoStopBefore: boolean; undoStopAfter: boolean }
    ) {
        const adjustedTextDiff = adjustTextDiffForEditing(textDiff)
        const visibleEditor = vscode.window.visibleTextEditors.find(
            (editor) => editor.document.uri === task.document.uri
        )
        if (visibleEditor) {
            await visibleEditor.edit(
                (editBuilder) => {
                    for (const change of adjustedTextDiff) {
                        if (change.type === 'insertion') {
                            editBuilder.insert(change.range.start, change.replacementText)
                        }
                    }
                },
                undoOption ?? { undoStopBefore: true, undoStopAfter: false }
            )
        } else {
            const edit = new vscode.WorkspaceEdit()
            for (const change of textDiff) {
                if (change.type === 'insertion') {
                    edit.insert(task.document.uri, change.range.start, change.replacementText)
                }
            }
            await vscode.workspace.applyEdit(edit)
        }
    }

    private undoListener(task: InlineTask) {
        const listener: vscode.Disposable = vscode.workspace.onDidChangeTextDocument(async (event) => {
            const { document, contentChanges } = event

            if (document.uri.toString() !== task.document.uri.toString()) {
                return
            }

            const changeIntersectsRange = contentChanges.some((change) => {
                const { range } = change
                return !(range.end.isBefore(task.selectedRange.start) || range.start.isAfter(task.selectedRange.end))
            })

            if (!changeIntersectsRange) {
                return
            }

            const updatedSelectedText = document.getText(task.selectedRange)

            if (updatedSelectedText.trim() === task.selectedText.trim()) {
                task.diff = []
                await this.updateTaskAndLenses(task)
                task.updateDecorations()
                this.decorator.applyDecorations(task)
                listener.dispose()
            }
        })
    }
}
