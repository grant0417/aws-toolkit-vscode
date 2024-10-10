/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
import * as vscode from 'vscode'

/**
 * Expands the given selection to full line(s) in the document.
 * If the selection is partial, it will be extended to include the entire line(s).
 * @param document The current text document
 * @param selection The current selection
 * @returns A new Range that covers full line(s) of the selection
 */
export function expandSelectionToFullLines(document: vscode.TextDocument, selection: vscode.Selection): vscode.Range {
    const startLine = document.lineAt(selection.start.line)
    const endLine = document.lineAt(selection.end.line)
    return new vscode.Range(startLine.range.start, endLine.range.end)
}
