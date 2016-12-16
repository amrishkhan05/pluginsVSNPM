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
const ResolveIndex_1 = require('../caches/ResolveIndex');
const DocumentController_1 = require('../controllers/DocumentController');
const ExtensionConfig_1 = require('../ExtensionConfig');
const QuickPickItems_1 = require('../models/QuickPickItems');
const TshCommand_1 = require('../models/TshCommand');
const TsResourceParser_1 = require('../parser/TsResourceParser');
const ResolveCompletionItemProvider_1 = require('../provider/ResolveCompletionItemProvider');
const ResolveQuickPickProvider_1 = require('../provider/ResolveQuickPickProvider');
const BaseExtension_1 = require('./BaseExtension');
const inversify_1 = require('inversify');
const vscode_1 = require('vscode');
const resolverOk = 'Resolver $(check)', resolverSyncing = 'Resolver $(sync)', resolverErr = 'Resolver $(flame)', TYPESCRIPT = 'typescript', TYPESCRIPT_REACT = 'typescriptreact';
function compareIgnorePatterns(local, config) {
    if (local.length !== config.length) {
        return false;
    }
    let localSorted = local.sort(), configSorted = config.sort();
    for (let x = 0; x < configSorted.length; x++) {
        if (configSorted[x] !== localSorted[x]) {
            return false;
        }
    }
    return true;
}
/**
 * Extension that manages the imports of a document. Can organize them, import a new symbol and
 * import a symbol under the cursor.
 *
 * @export
 * @class ResolveExtension
 * @extends {BaseExtension}
 */
let ResolveExtension = class ResolveExtension extends BaseExtension_1.BaseExtension {
    constructor(loggerFactory, pickProvider, parser, config, index, completionProvider) {
        super();
        this.pickProvider = pickProvider;
        this.parser = parser;
        this.config = config;
        this.index = index;
        this.completionProvider = completionProvider;
        this.statusBarItem = vscode_1.window.createStatusBarItem(vscode_1.StatusBarAlignment.Left, 4);
        this.fileWatcher = vscode_1.workspace.createFileSystemWatcher('{**/*.ts,**/package.json,**/typings.json}', true);
        this.logger = loggerFactory('ResolveExtension');
        this.ignorePatterns = this.config.resolver.ignorePatterns;
        this.logger.info('Extension instantiated.');
    }
    getGuiCommands() {
        return [
            new QuickPickItems_1.CommandQuickPickItem('Import resolver: Add import', '', 'Does open the list of unimported symbols.', new TshCommand_1.TshCommand(() => this.addImport())),
            new QuickPickItems_1.CommandQuickPickItem('Import resolver: Add import under cursor', `right now: '${this.getSymbolUnderCursor()}'`, 'Adds the symbol under the cursor and opens a list if multiple are possible.', new TshCommand_1.TshCommand(() => this.addImportUnderCursor())),
            new QuickPickItems_1.CommandQuickPickItem('Import resolver: Add missing imports', '', 'Adds all missing symbols to the actual document if possible.', new TshCommand_1.TshCommand(() => this.addMissingImports())),
            new QuickPickItems_1.CommandQuickPickItem('Import resolver: Organize imports', '', 'Sorts imports and removes unused imports.', new TshCommand_1.TshCommand(() => this.organizeImports())),
            new QuickPickItems_1.CommandQuickPickItem('Import resolver: Rebuild cache', `currently: ${Object.keys(this.index.index).length} symbols`, 'Does rebuild the whole symbol index.', new TshCommand_1.TshCommand(() => this.refreshIndex()))
        ];
    }
    initialize(context) {
        context.subscriptions.push(vscode_1.commands.registerTextEditorCommand('typescriptHero.resolve.addImport', () => this.addImport()));
        context.subscriptions.push(vscode_1.commands.registerTextEditorCommand('typescriptHero.resolve.addImportUnderCursor', () => this.addImportUnderCursor()));
        context.subscriptions.push(vscode_1.commands.registerTextEditorCommand('typescriptHero.resolve.addMissingImports', () => this.addMissingImports()));
        context.subscriptions.push(vscode_1.commands.registerTextEditorCommand('typescriptHero.resolve.organizeImports', () => this.organizeImports()));
        context.subscriptions.push(vscode_1.commands.registerCommand('typescriptHero.resolve.rebuildCache', () => this.refreshIndex()));
        context.subscriptions.push(vscode_1.languages.registerCompletionItemProvider(TYPESCRIPT, this.completionProvider));
        context.subscriptions.push(vscode_1.languages.registerCompletionItemProvider(TYPESCRIPT_REACT, this.completionProvider));
        context.subscriptions.push(this.statusBarItem);
        context.subscriptions.push(this.fileWatcher);
        this.statusBarItem.text = resolverOk;
        this.statusBarItem.tooltip = 'Click to manually reindex all files.';
        this.statusBarItem.command = 'typescriptHero.resolve.rebuildCache';
        this.statusBarItem.show();
        this.refreshIndex();
        this.fileWatcher.onDidChange(uri => {
            if (uri.fsPath.endsWith('.d.ts')) {
                return;
            }
            if (uri.fsPath.endsWith('package.json') || uri.fsPath.endsWith('typings.json')) {
                this.logger.info('package.json or typings.json modified. Refreshing index.');
                this.refreshIndex();
            }
            else {
                this.logger.info(`File "${uri.fsPath}" changed. Reindexing file.`);
                this.refreshIndex(uri);
            }
        });
        this.fileWatcher.onDidDelete(uri => {
            if (uri.fsPath.endsWith('.d.ts')) {
                return;
            }
            this.logger.info(`File "${uri.fsPath}" deleted. Removing file.`);
            this.index.removeForFile(uri.fsPath);
        });
        context.subscriptions.push(vscode_1.workspace.onDidChangeConfiguration(() => {
            if (!compareIgnorePatterns(this.ignorePatterns, this.config.resolver.ignorePatterns)) {
                this.logger.info('The typescriptHero.resolver.ignorePatterns setting was modified, reload the index.');
                this.refreshIndex();
                this.ignorePatterns = this.config.resolver.ignorePatterns;
            }
        }));
        this.logger.info('Initialized.');
    }
    dispose() {
        this.logger.info('Dispose called.');
    }
    /**
     * Add an import from the whole list. Calls the vscode gui, where the user can
     * select a symbol to import.
     *
     * @private
     * @returns {Promise<void>}
     *
     * @memberOf ResolveExtension
     */
    addImport() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.index.indexReady) {
                this.showCacheWarning();
                return;
            }
            try {
                let newImport = yield this.pickProvider.addImportPick(vscode_1.window.activeTextEditor.document);
                if (newImport) {
                    this.logger.info('Add import to document', { resolveItem: newImport });
                    this.addImportToDocument(newImport);
                }
            }
            catch (e) {
                this.logger.error('An error happend during import picking', e);
                vscode_1.window.showErrorMessage('The import cannot be completed, there was an error during the process.');
            }
        });
    }
    /**
     * Add an import that matches the word under the actual cursor.
     * If an exact match is found, the import is added automatically. If not, the vscode gui
     * will be called with the found matches.
     *
     * @private
     * @returns {Promise<void>}
     *
     * @memberOf ResolveExtension
     */
    addImportUnderCursor() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.index.indexReady) {
                this.showCacheWarning();
                return;
            }
            let selectedSymbol = this.getSymbolUnderCursor();
            if (!!!selectedSymbol) {
                return;
            }
            try {
                let newImport = yield this.pickProvider.addImportUnderCursorPick(vscode_1.window.activeTextEditor.document, selectedSymbol);
                if (newImport) {
                    this.logger.info('Add import to document', { resolveItem: newImport });
                    this.addImportToDocument(newImport);
                }
            }
            catch (e) {
                this.logger.error('An error happend during import picking', e);
                vscode_1.window.showErrorMessage('The import cannot be completed, there was an error during the process.');
            }
        });
    }
    /**
     * Adds all missing imports to the actual document if possible. If multiple declarations are found,
     * a quick pick list is shown to the user and he needs to decide, which import to use.
     *
     * @private
     * @returns {Promise<void>}
     *
     * @memberOf ResolveExtension
     */
    addMissingImports() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.index.indexReady) {
                this.showCacheWarning();
                return;
            }
            try {
                let ctrl = yield DocumentController_1.DocumentController.create(vscode_1.window.activeTextEditor.document);
                yield ctrl.addMissingImports(this.index).commit();
            }
            catch (e) {
                this.logger.error('An error happend during import fixing', e);
                vscode_1.window.showErrorMessage('The operation cannot be completed, there was an error during the process.');
            }
        });
    }
    /**
     * Organizes the imports of the actual document. Sorts and formats them correctly.
     *
     * @private
     * @returns {Promise<boolean>}
     *
     * @memberOf ResolveExtension
     */
    organizeImports() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                let ctrl = yield DocumentController_1.DocumentController.create(vscode_1.window.activeTextEditor.document);
                return yield ctrl.organizeImports().commit();
            }
            catch (e) {
                this.logger.error('An error happend during "organize imports".', { error: e });
                return false;
            }
        });
    }
    /**
     * Effectifely adds an import quick pick item to a document
     *
     * @private
     * @param {ResolveQuickPickItem} item
     * @returns {Promise<boolean>}
     *
     * @memberOf ResolveExtension
     */
    addImportToDocument(item) {
        return __awaiter(this, void 0, void 0, function* () {
            let ctrl = yield DocumentController_1.DocumentController.create(vscode_1.window.activeTextEditor.document);
            return yield ctrl.addDeclarationImport(item.declarationInfo).commit();
        });
    }
    /**
     * Refresh the symbol index for a file or if the file uri is omitted, refresh the whole index.
     *
     * @private
     * @param {Uri} [file]
     *
     * @memberOf ResolveExtension
     */
    refreshIndex(file) {
        this.statusBarItem.text = resolverSyncing;
        if (file) {
            this.index.rebuildForFile(file.fsPath)
                .then(() => this.statusBarItem.text = resolverOk)
                .catch(() => this.statusBarItem.text = resolverErr);
        }
        else {
            this.index.buildIndex()
                .then(() => this.statusBarItem.text = resolverOk)
                .catch(() => this.statusBarItem.text = resolverErr);
        }
    }
    /**
     * Shows a user warning if the resolve index is not ready yet.
     *
     * @private
     *
     * @memberOf ResolveExtension
     */
    showCacheWarning() {
        vscode_1.window.showWarningMessage('Please wait a few seconds longer until the symbol cache has been build.');
    }
    /**
     * Returns the string under the cursor.
     *
     * @private
     * @returns {string}
     *
     * @memberOf ResolveExtension
     */
    getSymbolUnderCursor() {
        let editor = vscode_1.window.activeTextEditor;
        if (!editor) {
            return '';
        }
        let selection = editor.selection, word = editor.document.getWordRangeAtPosition(selection.active);
        return word && !word.isEmpty ? editor.document.getText(word) : '';
    }
};
ResolveExtension = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject('LoggerFactory')), 
    __metadata('design:paramtypes', [Function, ResolveQuickPickProvider_1.ResolveQuickPickProvider, TsResourceParser_1.TsResourceParser, ExtensionConfig_1.ExtensionConfig, ResolveIndex_1.ResolveIndex, ResolveCompletionItemProvider_1.ResolveCompletionItemProvider])
], ResolveExtension);
exports.ResolveExtension = ResolveExtension;
