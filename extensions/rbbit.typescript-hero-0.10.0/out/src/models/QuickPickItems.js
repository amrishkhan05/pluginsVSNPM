"use strict";
/**
 * Quickpick item that contains a typescript hero command that can be executed.
 * Those commands help executing tasks from the "gui" or from parts of the extension.
 *
 * @export
 * @class CommandQuickPickItem
 * @implements {QuickPickItem}
 */
class CommandQuickPickItem {
    constructor(label, description, detail, command) {
        this.label = label;
        this.description = description;
        this.detail = detail;
        this.command = command;
    }
}
exports.CommandQuickPickItem = CommandQuickPickItem;
/**
 * Quickpick item that contains a symbol resolve information (Declarationinfo)
 * Contains the name and the location where it is imported from.
 * The whole DeclarationInfo is also exposed.
 *
 * @export
 * @class ResolveQuickPickItem
 * @implements {QuickPickItem}
 */
class ResolveQuickPickItem {
    constructor(declarationInfo) {
        this.declarationInfo = declarationInfo;
        this.description = this.declarationInfo.from;
        this.label = this.declarationInfo.declaration.name;
    }
}
exports.ResolveQuickPickItem = ResolveQuickPickItem;
