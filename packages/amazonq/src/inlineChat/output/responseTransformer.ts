/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { InlineTask } from '../controller/inlineTask'
import { getLogger } from 'aws-core-vscode/shared'
import { decode } from 'he'

export function responseTransformer(
    response: string,
    inlineTask: InlineTask,
    isWholeResponse: boolean
): string | undefined {
    try {
        // const decodedTextResponse = decode(response)
        // const tokens = Lexer.lex(decodedTextResponse)

        // let codeBlock: string | undefined
        // for (const token of tokens) {
        //     if (token.type === 'code') {
        //         codeBlock = token.text
        //         break
        //     }
        // }

        return decode(response)
        // let intentationMatchedResponse: string
        // if (!isWholeResponse) {
        //     const partialSelectedCode = extractPartialCode(codeBlock, inlineTask)
        //     inlineTask.partialSelectedText = partialSelectedCode
        //     intentationMatchedResponse = indentationFormatter(codeBlock, inlineTask.partialSelectedText)
        // } else {
        //     intentationMatchedResponse = indentationFormatter(codeBlock, inlineTask.selectedText)
        // }
        // return intentationMatchedResponse
    } catch (err) {
        if (err instanceof Error) {
            getLogger().error(err)
        } else {
            getLogger().error(`An unknown error occurred: ${err}`)
        }
        return undefined
    }
}

// function extractPartialCode(response: string, inlineTask: InlineTask): string {
//     const lineCount = response.split('\n').length
//     const partialCode = inlineTask.selectedText.split('\n').slice(0, lineCount).join('\n')
//     return partialCode
// }
