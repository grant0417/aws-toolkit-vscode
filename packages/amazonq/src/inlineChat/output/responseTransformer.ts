/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { decode } from 'he'
import { Lexer } from 'marked'
import { InlineTask } from '../controller/inlineTask'
import { indentationFormatter } from './matchIndentation'
import { getLogger } from 'aws-core-vscode/shared'

export function responseTransformer(
    response: string,
    inlineTask: InlineTask,
    isWholeResponse: boolean
): string | undefined {
    try {
        const decodedTextResponse = decode(response)
        const tokens = Lexer.lex(decodedTextResponse)

        let codeBlock: string | undefined
        for (const token of tokens) {
            if (token.type === 'code') {
                codeBlock = token.text
                break
            }
        }

        if (!codeBlock) {
            return undefined
        }

        if (!isWholeResponse) {
            const partialSelectedCode = extractPartialCode(response, inlineTask)
            inlineTask.partialSelectedText = partialSelectedCode
            const intentationMatchedResponse = indentationFormatter(codeBlock, partialSelectedCode)
            return intentationMatchedResponse
        }

        const intentationMatchedResponse = indentationFormatter(codeBlock, inlineTask.selectedText)
        return intentationMatchedResponse
    } catch (err) {
        if (err instanceof Error) {
            getLogger().error(err)
        } else {
            getLogger().error(`An unknown error occurred: ${err}`)
        }
        return undefined
    }
}

function extractPartialCode(response: string, inlineTask: InlineTask): string {
    const lineCount = response.split('\n').length
    const partialCode = inlineTask.selectedText.split('\n').slice(0, lineCount).join('\n')
    return partialCode
}
