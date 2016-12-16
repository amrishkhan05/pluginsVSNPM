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
const ExtensionConfig_1 = require('../ExtensionConfig');
const TsDeclaration_1 = require('../models/TsDeclaration');
const TsImport_1 = require('../models/TsImport');
const TsResolveSpecifier_1 = require('../models/TsResolveSpecifier');
const TsResourceParser_1 = require('../parser/TsResourceParser');
const ResolveIndexExtensions_1 = require('../utilities/ResolveIndexExtensions');
const inversify_1 = require('inversify');
const vscode_1 = require('vscode');
/**
 * Provider instance that gives the user code completion (intellisense).
 * Is responsible for parsing the actual document and create the actions needed to import a new symbol.
 *
 * @export
 * @class ResolveCompletionItemProvider
 * @implements {CompletionItemProvider}
 */
let ResolveCompletionItemProvider = class ResolveCompletionItemProvider {
    constructor(loggerFactory, config, index, parser) {
        this.config = config;
        this.index = index;
        this.parser = parser;
        this.logger = loggerFactory('ResolveCompletionItemProvider');
        this.logger.info('Instantiated.');
    }
    /**
     * Provides the completion list to vscode.
     * Calculates auto imports based on various situations.
     *
     * @param {TextDocument} document
     * @param {Position} position
     * @param {CancellationToken} token
     * @returns {Promise<CompletionItem[]>}
     *
     * @memberOf ResolveCompletionItemProvider
     */
    provideCompletionItems(document, position, token) {
        return __awaiter(this, void 0, void 0, function* () {
            let wordAtPosition = document.getWordRangeAtPosition(position), lineText = document.lineAt(position.line).text, searchWord = '';
            if (wordAtPosition && wordAtPosition.start.character < position.character) {
                let word = document.getText(wordAtPosition);
                searchWord = word.substr(0, position.character - wordAtPosition.start.character);
            }
            if (!searchWord ||
                token.isCancellationRequested ||
                !this.index.indexReady ||
                (lineText.substring(0, position.character).match(/["'`]/g) || []).length % 2 === 1 ||
                lineText.match(/^\s*(\/\/|\/\*\*|\*\/|\*)/g) ||
                lineText.match(/^import .*$/g) ||
                lineText.substring(0, position.character).match(new RegExp(`(\w*[.])+${searchWord}`, 'g'))) {
                return Promise.resolve(null);
            }
            this.logger.info('Search completion for word.', { searchWord });
            let parsed = yield this.parser.parseSource(document.getText());
            if (token.isCancellationRequested) {
                return [];
            }
            let declarations = ResolveIndexExtensions_1.getDeclarationsFilteredByImports(this.index, document.fileName, parsed.imports)
                .filter(o => !parsed.declarations.some(d => d.name === o.declaration.name))
                .filter(o => !parsed.usages.some(d => d === o.declaration.name));
            let filtered = declarations
                .filter(o => o.declaration.name.toLowerCase().indexOf(searchWord.toLowerCase()) >= 0)
                .map(o => {
                let item = new vscode_1.CompletionItem(o.declaration.name, o.declaration.itemKind);
                item.detail = o.from;
                item.additionalTextEdits = this.calculateTextEdits(o, document, parsed);
                return item;
            });
            if (token.isCancellationRequested) {
                return [];
            }
            return filtered;
        });
    }
    /**
     * Internal method that calculates the needed TextEdits to a given document to import the symbol.
     *
     * @private
     * @param {DeclarationInfo} declaration
     * @param {TextDocument} document
     * @param {TsFile} parsedSource
     * @returns {TextEdit[]}
     *
     * @memberOf ResolveCompletionItemProvider
     */
    calculateTextEdits(declaration, document, parsedSource) {
        let imp = parsedSource.imports.find(o => {
            if (o instanceof TsImport_1.TsNamedImport) {
                let importedLib = ResolveIndexExtensions_1.getAbsolutLibraryName(o.libraryName, document.fileName);
                return importedLib === declaration.from;
            }
            return false;
        });
        if (imp && imp instanceof TsImport_1.TsNamedImport) {
            let modifiedImp = imp.clone();
            modifiedImp.specifiers.push(new TsResolveSpecifier_1.TsResolveSpecifier(declaration.declaration.name));
            return [
                vscode_1.TextEdit.replace(imp.getRange(document), modifiedImp.toImport(this.config.resolver.importOptions))
            ];
        }
        else if (declaration.declaration instanceof TsDeclaration_1.ModuleDeclaration) {
            let mod = new TsImport_1.TsNamespaceImport(declaration.from, declaration.declaration.name);
            return [
                vscode_1.TextEdit.insert(ResolveIndexExtensions_1.getImportInsertPosition(this.config.resolver.newImportLocation, vscode_1.window.activeTextEditor), mod.toImport(this.config.resolver.importOptions))
            ];
        }
        else if (declaration.declaration instanceof TsDeclaration_1.DefaultDeclaration) {
        }
        else {
            let library = ResolveIndexExtensions_1.getRelativeLibraryName(declaration.from, document.fileName);
            let named = new TsImport_1.TsNamedImport(library);
            named.specifiers.push(new TsResolveSpecifier_1.TsResolveSpecifier(declaration.declaration.name));
            return [
                vscode_1.TextEdit.insert(ResolveIndexExtensions_1.getImportInsertPosition(this.config.resolver.newImportLocation, vscode_1.window.activeTextEditor), named.toImport(this.config.resolver.importOptions))
            ];
        }
    }
};
ResolveCompletionItemProvider = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject('LoggerFactory')), 
    __metadata('design:paramtypes', [Function, ExtensionConfig_1.ExtensionConfig, ResolveIndex_1.ResolveIndex, TsResourceParser_1.TsResourceParser])
], ResolveCompletionItemProvider);
exports.ResolveCompletionItemProvider = ResolveCompletionItemProvider;
