"use strict";
const vscode_1 = require('vscode');
/**
 * Base class for all nodes / declarations in the extension.
 * Contains basic information about the node.
 *
 * @export
 * @abstract
 * @class TsNode
 */
class TsNode {
    constructor(start, end) {
        this.start = start;
        this.end = end;
    }
    /**
     * Calculates the document range of the node in the given document.
     *
     * @param {TextDocument} document
     * @returns {Range}
     *
     * @memberOf TsNode
     */
    getRange(document) {
        return this.start !== undefined && this.end !== undefined ?
            new vscode_1.Range(document.positionAt(this.start), document.positionAt(this.end)) :
            new vscode_1.Range(new vscode_1.Position(0, 0), new vscode_1.Position(0, 0));
    }
}
exports.TsNode = TsNode;
