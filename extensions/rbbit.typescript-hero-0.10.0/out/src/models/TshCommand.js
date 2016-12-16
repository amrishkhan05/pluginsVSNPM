"use strict";
/**
 * Typescript hero internal command that is executed from the guiprovider.
 *
 * @export
 * @class TshCommand
 */
class TshCommand {
    constructor(action, args) {
        this.action = action;
        this.args = args;
    }
}
exports.TshCommand = TshCommand;
