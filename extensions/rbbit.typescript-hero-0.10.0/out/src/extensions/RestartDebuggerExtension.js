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
const ExtensionConfig_1 = require('../ExtensionConfig');
const QuickPickItems_1 = require('../models/QuickPickItems');
const TshCommand_1 = require('../models/TshCommand');
const BaseExtension_1 = require('./BaseExtension');
const inversify_1 = require('inversify');
const vscode_1 = require('vscode');
const DEBOUNCE = 1500;
/**
 * Extension that restart the active debugger, when there are changes made to the compiled
 * javascript files. Watches for certain configurable folders.
 *
 * @export
 * @class RestartDebuggerExtension
 * @extends {BaseExtension}
 */
let RestartDebuggerExtension = class RestartDebuggerExtension extends BaseExtension_1.BaseExtension {
    constructor(loggerFactory, config) {
        super();
        this.config = config;
        this.statusBarItem = vscode_1.window.createStatusBarItem(vscode_1.StatusBarAlignment.Left, 3);
        this.logger = loggerFactory('RestartDebuggerExtension');
        this.active = this.config.restartDebugger.active;
        this.logger.info('Extension instantiated.');
    }
    getGuiCommands() {
        return [
            new QuickPickItems_1.CommandQuickPickItem('Debug restarter: Toggle', `currently: ${this.active ? 'activated' : 'deactivated'}`, 'Toggles the active state of the automatic debug restarter.', new TshCommand_1.TshCommand(() => {
                this.active = !this.active;
                this.configure();
            }))
        ];
    }
    initialize(context) {
        this.configure();
        context.subscriptions.push(vscode_1.commands.registerCommand('typescriptHero.restartDebugger.toggle', () => {
            this.active = !this.active;
            this.configure();
        }));
        context.subscriptions.push(this.statusBarItem);
        this.statusBarItem.command = 'typescriptHero.restartDebugger.toggle';
        this.statusBarItem.show();
        this.logger.info('Initialized.');
    }
    dispose() {
        this.logger.info('Dispose called.');
        if (this.fileWatcher) {
            this.fileWatcher.dispose();
            this.fileWatcher = null;
        }
    }
    /**
     * Configure the filewatcher.
     * If the watcher is active, deactivate it and update the statusbar accordingly.
     * If the watcher is inactive, activate it, register it and update the statusbar accordingly.
     *
     * @private
     *
     * @memberOf RestartDebuggerExtension
     */
    configure() {
        if (this.active && !this.fileWatcher) {
            let watcherGlob = this.config.restartDebugger.watchFolders.map(o => `**/${o}/**/*.*`).join(',');
            this.logger.info(`Activated for glob: ${watcherGlob}.`);
            this.fileWatcher = vscode_1.workspace.createFileSystemWatcher(`{${watcherGlob}}`);
            this.fileWatcher.onDidChange(() => this.restartDebugger());
            this.fileWatcher.onDidCreate(() => this.restartDebugger());
            this.fileWatcher.onDidDelete(() => this.restartDebugger());
            this.statusBarItem.text = '$(pulse) $(check)';
            this.statusBarItem.tooltip = 'The restart is currently active. Click to deactivate.';
        }
        else if (!this.active && this.fileWatcher) {
            this.fileWatcher.dispose();
            this.fileWatcher = null;
            this.logger.info(`Deactivated.`);
            this.statusBarItem.text = '$(pulse) $(x)';
            this.statusBarItem.tooltip = 'The restart is currently deactivated. Click to activate.';
        }
    }
    /**
     * Ultimately calls the command to restart the debugger.
     *
     * @private
     *
     * @memberOf RestartDebuggerExtension
     */
    restartDebugger() {
        if (this.restartCall) {
            clearTimeout(this.restartCall);
            delete this.restartCall;
        }
        this.restartCall = setTimeout(() => {
            vscode_1.commands.executeCommand('workbench.action.debug.restart');
        }, DEBOUNCE);
    }
};
RestartDebuggerExtension = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject('LoggerFactory')), 
    __metadata('design:paramtypes', [Function, ExtensionConfig_1.ExtensionConfig])
], RestartDebuggerExtension);
exports.RestartDebuggerExtension = RestartDebuggerExtension;
