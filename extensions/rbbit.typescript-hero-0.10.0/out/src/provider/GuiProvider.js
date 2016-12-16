"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator.throw(value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments)).next());
    });
};
const inversify_1 = require('inversify');
const vscode_1 = require('vscode');
/**
 * Provider instance that provides the typescript hero "gui" to the user.
 * Is responsible of collecting gui command from all possible extension parts and executing the given commands.
 *
 * @export
 * @class GuiProvider
 */
let GuiProvider = class GuiProvider {
    constructor(context, extensions) {
        this.extensions = extensions;
        context.subscriptions.push(vscode_1.commands.registerCommand('typescriptHero.showCmdGui', () => this.showGui()));
    }
    /**
     * Shows the "gui" (which is literally a quickpick of vscode) to the user with all found commands.
     * Upon selection, the command is executed.
     *
     * @private
     * @returns {Promise<void>}
     *
     * @memberOf GuiProvider
     */
    showGui() {
        return __awaiter(this, void 0, void 0, function* () {
            let cmd = yield vscode_1.window.showQuickPick(this.extensions.reduce((all, cur) => all.concat(cur.getGuiCommands()), []));
            if (!cmd) {
                return;
            }
            this.executeCommand(cmd);
        });
    }
    /**
     * Executes a given TshCommand.
     *
     * @private
     * @param {CommandQuickPickItem} cmd
     *
     * @memberOf GuiProvider
     */
    executeCommand(cmd) {
        cmd.command.action();
    }
};
GuiProvider = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject('context')),
    __param(1, inversify_1.multiInject('Extension')), 
    __metadata('design:paramtypes', [Object, Array])
], GuiProvider);
exports.GuiProvider = GuiProvider;
