/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import detectIndent from '@gwhitney/detect-indent'

export function indentationFormatter(replacement: string, original: string): string {
    const originalIndentation = detectIndent(original)
    if (originalIndentation.amount === 0) {
        return replacement
    }

    const replacementIndentation = detectIndent(replacement)
    let fixedReplacement = replacement

    if (originalIndentation.type !== replacementIndentation.type) {
        const fixedLines = replacement.split('\n').map((line) => {
            const trimmedLine = line.trimStart()
            if (trimmedLine.length === 0 || line.length === trimmedLine.length) {
                return line
            }
            const currentIndentation = line.match(`^(${replacementIndentation.indent})+`)
            if (currentIndentation) {
                const currentIndentationAmount = currentIndentation[0].length / replacementIndentation.indent.length
                return originalIndentation.indent.repeat(currentIndentationAmount) + trimmedLine
            }
            return line
        })

        fixedReplacement = fixedLines.join('\n')
    }
    const fixedReplacementIndentation = detectIndent(fixedReplacement)
    const originalFirstIndentation = original.length - original.trimStart().length
    const fixedReplacementFirstIndentation = fixedReplacement.length - fixedReplacement.trimStart().length
    const firstIndentationDiff = fixedReplacementFirstIndentation - originalFirstIndentation

    if (fixedReplacementIndentation.amount === originalIndentation.amount && firstIndentationDiff === 0) {
        return fixedReplacement
    } else {
        const indentationAmountDiff = firstIndentationDiff

        return fixedReplacement
            .split('\n')
            .map((line) => {
                const trimmedLine = line.trimStart()
                if (trimmedLine.length === 0) {
                    return line
                }
                const correctIndentationAmount = line.length - trimmedLine.length - indentationAmountDiff
                if (correctIndentationAmount % 2 === 0 || originalIndentation.type === 'tab') {
                    return originalIndentation.indent.repeat(correctIndentationAmount) + trimmedLine
                }
                return line
            })
            .join('\n')
    }
}
