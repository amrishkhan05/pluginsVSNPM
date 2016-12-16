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
const QuickPickItems_1 = require('../models/QuickPickItems');
const TsResourceParser_1 = require('../parser/TsResourceParser');
const ResolveIndexExtensions_1 = require('../utilities/ResolveIndexExtensions');
const inversify_1 = require('inversify');
const vscode_1 = require('vscode');
/**
 * Provider instance that provides quickpick items for symbol resolving.
 * Asks the user for a choice of a symbol to be imported.
 *
 * @export
 * @class ResolveQuickPickProvider
 */
let ResolveQuickPickProvider = class ResolveQuickPickProvider {
    constructor(loggerFactory, resolveIndex, parser) {
        this.resolveIndex = resolveIndex;
        this.parser = parser;
        this.logger = loggerFactory('ResolveQuickPickProvider');
    }
    /**
     * Returns a ResolveQuickPickItem (or null) for the active document.
     * If the user hits "esc" or cancels the quick pick in any way, NULL is returned.
     * Otherwise the selected ResolveQuickPickItem is returned.
     *
     * @param {TextDocument} activeDocument
     * @returns {Promise<ResolveQuickPickItem>}
     *
     * @memberOf ResolveQuickPickProvider
     */
    addImportPick(activeDocument) {
        return __awaiter(this, void 0, void 0, function* () {
            let items = yield this.buildQuickPickList(activeDocument);
            return vscode_1.window.showQuickPick(items);
        });
    }
    /**
     * Returns a ResolveQuickPickItem (or null) for the active document with taken the actual string symbol
     * under the cursor as a base filter. Has a slightly different behaviour based on items found:
     * - If no items are found, an information is shown to the user and the method resolves to undefined.
     * - If only one item is found and it matches the cursor string to 100%, it's resolved.
     * - If one item is found that only partial matches or multiple matches are found, a quickpick is shown.
     *
     * @param {TextDocument} activeDocument
     * @param {string} cursorSymbol
     * @returns {Promise<ResolveQuickPickItem>}
     *
     * @memberOf ResolveQuickPickProvider
     */
    addImportUnderCursorPick(activeDocument, cursorSymbol) {
        return __awaiter(this, void 0, void 0, function* () {
            let resolveItems = yield this.buildQuickPickList(activeDocument, cursorSymbol);
            if (resolveItems.length < 1) {
                vscode_1.window.showInformationMessage(`The symbol '${cursorSymbol}' was not found in the index or is already imported.`);
                return;
            }
            else if (resolveItems.length === 1 && resolveItems[0].label === cursorSymbol) {
                return resolveItems[0];
            }
            else {
                return vscode_1.window.showQuickPick(resolveItems, { placeHolder: 'Multiple declarations found:' });
            }
        });
    }
    /**
     * Internal method that builds the list of quickpick items that is shown to the user.
     *
     * @private
     * @param {TextDocument} activeDocument
     * @param {string} [cursorSymbol]
     * @returns {Promise<ResolveQuickPickItem[]>}
     *
     * @memberOf ResolveQuickPickProvider
     */
    buildQuickPickList(activeDocument, cursorSymbol) {
        return __awaiter(this, void 0, void 0, function* () {
            let parsedSource = yield this.parser.parseSource(activeDocument.getText()), declarations = ResolveIndexExtensions_1.getDeclarationsFilteredByImports(this.resolveIndex, activeDocument.fileName, parsedSource.imports);
            if (cursorSymbol) {
                declarations = declarations.filter(o => o.declaration.name.startsWith(cursorSymbol));
            }
            let activeDocumentDeclarations = parsedSource.declarations.map(o => o.name);
            declarations = [
                ...declarations.filter(o => o.from.startsWith('/')),
                ...declarations.filter(o => !o.from.startsWith('/'))
            ];
            return declarations
                .filter(o => activeDocumentDeclarations.indexOf(o.declaration.name) === -1)
                .map(o => new QuickPickItems_1.ResolveQuickPickItem(o));
        });
    }
};
ResolveQuickPickProvider = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject('LoggerFactory')), 
    __metadata('design:paramtypes', [Function, ResolveIndex_1.ResolveIndex, TsResourceParser_1.TsResourceParser])
], ResolveQuickPickProvider);
exports.ResolveQuickPickProvider = ResolveQuickPickProvider;
