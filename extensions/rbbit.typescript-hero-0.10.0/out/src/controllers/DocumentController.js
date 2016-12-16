"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator.throw(value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments)).next());
    });
};
const QuickPickItems_1 = require('../models/QuickPickItems');
const ExtensionConfig_1 = require('../ExtensionConfig');
const IoC_1 = require('../IoC');
const ImportProxy_1 = require('../models/ImportProxy');
const TsDeclaration_1 = require('../models/TsDeclaration');
const TsImport_1 = require('../models/TsImport');
const TsResolveSpecifier_1 = require('../models/TsResolveSpecifier');
const TsResourceParser_1 = require('../parser/TsResourceParser');
const ResolveIndexExtensions_1 = require('../utilities/ResolveIndexExtensions');
const vscode_1 = require('vscode');
function stringSort(strA, strB) {
    if (strA < strB) {
        return -1;
    }
    else if (strA > strB) {
        return 1;
    }
    return 0;
}
function importSort(i1, i2) {
    let strA = i1.libraryName.toLowerCase(), strB = i2.libraryName.toLowerCase();
    return stringSort(strA, strB);
}
function specifierSort(i1, i2) {
    return stringSort(i1.specifier, i2.specifier);
}
/**
 * Management class for a TextDocument. Can add and remove parts of the document
 * and commit the virtual document to the TextEditor.
 *
 * @export
 * @class DocumentController
 */
class DocumentController {
    constructor(document, _parsedDocument) {
        this.document = document;
        this._parsedDocument = _parsedDocument;
        this.imports = [];
        this.userImportDecisions = [];
        this.imports = _parsedDocument.imports.map(o => o.clone());
    }
    static get parser() {
        return IoC_1.Injector.get(TsResourceParser_1.TsResourceParser);
    }
    static get config() {
        return IoC_1.Injector.get(ExtensionConfig_1.ExtensionConfig);
    }
    /**
     * Document resource for this controller. Contains the parsed document.
     *
     * @readonly
     * @type {TsFile}
     * @memberOf DocumentController
     */
    get parsedDocument() {
        return this._parsedDocument;
    }
    /**
     * Creates an instance of a DocumentController.
     * Does parse the document text first and returns a promise that
     * resolves to a DocumentController.
     *
     * @static
     * @param {TextDocument} document The document that should be managed
     * @returns {Promise<DocumentController>}
     *
     * @memberOf DocumentController
     */
    static create(document) {
        return __awaiter(this, void 0, void 0, function* () {
            let source = yield DocumentController.parser.parseSource(document.getText());
            source.imports = source.imports.map(o => o instanceof TsImport_1.TsNamedImport || o instanceof TsImport_1.TsDefaultImport ? new ImportProxy_1.ImportProxy(o) : o);
            return new DocumentController(document, source);
        });
    }
    /**
     * Adds an import for a declaration to the documents imports.
     * This index is merged and commited during the commit() function.
     * If it's a default import or there is a duplicate identifier, the controller will ask for the name on commit().
     *
     * @param {DeclarationInfo} declarationInfo The import that should be added to the document
     * @returns {DocumentController}
     *
     * @memberOf DocumentController
     */
    addDeclarationImport(declarationInfo) {
        // If there is something already imported, it must be a NamedImport or a DefaultImport
        let alreadyImported = this.imports.find(o => declarationInfo.from === ResolveIndexExtensions_1.getAbsolutLibraryName(o.libraryName, this.document.fileName) &&
            o instanceof ImportProxy_1.ImportProxy);
        if (alreadyImported) {
            // If we found an import for this declaration, it's either a default import or a named import
            if (declarationInfo.declaration instanceof TsDeclaration_1.DefaultDeclaration) {
                delete alreadyImported.defaultAlias;
                alreadyImported.defaultPurposal = declarationInfo.declaration.name;
            }
            else {
                alreadyImported.addSpecifier(declarationInfo.declaration.name);
            }
        }
        else {
            if (declarationInfo.declaration instanceof TsDeclaration_1.ModuleDeclaration) {
                this.imports.push(new TsImport_1.TsNamespaceImport(declarationInfo.from, declarationInfo.declaration.name));
            }
            else if (declarationInfo.declaration instanceof TsDeclaration_1.DefaultDeclaration) {
                let imp = new ImportProxy_1.ImportProxy(ResolveIndexExtensions_1.getRelativeLibraryName(declarationInfo.from, this.document.fileName));
                imp.defaultPurposal = declarationInfo.declaration.name;
                this.imports.push(imp);
            }
            else {
                let imp = new ImportProxy_1.ImportProxy(ResolveIndexExtensions_1.getRelativeLibraryName(declarationInfo.from, this.document.fileName));
                imp.specifiers.push(new TsResolveSpecifier_1.TsResolveSpecifier(declarationInfo.declaration.name));
                this.imports.push(imp);
            }
        }
        return this;
    }
    /**
     * Adds all missing imports to the actual document. If multiple declarations are found for one missing
     * specifier, the user is asked when the commit() function is executed.
     *
     * @param {ResolveIndex} resolveIndex
     * @returns {this}
     *
     * @memberOf DocumentController
     */
    addMissingImports(resolveIndex) {
        let declarations = ResolveIndexExtensions_1.getDeclarationsFilteredByImports(resolveIndex, this.document.fileName, this.imports);
        for (let usage of this._parsedDocument.nonLocalUsages) {
            let foundDeclarations = declarations.filter(o => o.declaration.name === usage);
            if (foundDeclarations.length <= 0) {
                continue;
            }
            else if (foundDeclarations.length === 1) {
                this.addDeclarationImport(foundDeclarations[0]);
            }
            else {
                this.userImportDecisions[usage] = foundDeclarations;
            }
        }
        return this;
    }
    /**
     * Organizes the imports of the document. Orders all imports and removes unused imports.
     * Order:
     * 1. string-only imports (e.g. import 'reflect-metadata')
     * 2. rest, but in alphabetical order
     *
     * @returns {DocumentController}
     *
     * @memberOf DocumentController
     */
    organizeImports() {
        this.organize = true;
        let keep = [];
        for (let actImport of this.imports) {
            if (actImport instanceof TsImport_1.TsNamespaceImport ||
                actImport instanceof TsImport_1.TsExternalModuleImport) {
                if (this._parsedDocument.nonLocalUsages.indexOf(actImport.alias) > -1) {
                    keep.push(actImport);
                }
            }
            else if (actImport instanceof ImportProxy_1.ImportProxy) {
                actImport.specifiers = actImport.specifiers
                    .filter(o => this._parsedDocument.nonLocalUsages.indexOf(o.alias || o.specifier) > -1)
                    .sort(specifierSort);
                let defaultSpec = actImport.defaultAlias || actImport.defaultPurposal;
                if (actImport.specifiers.length ||
                    (!!defaultSpec && this._parsedDocument.nonLocalUsages.indexOf(defaultSpec))) {
                    keep.push(actImport);
                }
            }
            else if (actImport instanceof TsImport_1.TsStringImport) {
                keep.push(actImport);
            }
        }
        keep = [
            ...keep.filter(o => o instanceof TsImport_1.TsStringImport).sort(importSort),
            ...keep.filter(o => !(o instanceof TsImport_1.TsStringImport)).sort(importSort)
        ];
        this.imports = keep;
        return this;
    }
    /**
     * Does commit the currently virtual document to the TextEditor.
     * Returns a promise that resolves to a boolean if all changes
     * could be applied.
     *
     * @returns {Promise<boolean>}
     *
     * @memberOf DocumentController
     */
    commit() {
        return __awaiter(this, void 0, void 0, function* () {
            // Commit the documents imports:
            // 1. Remove imports that are in the document, but not anymore
            // 2. Update existing / insert new ones
            let edits = [];
            yield this.resolveImportSpecifiers();
            if (this.organize) {
                for (let imp of this._parsedDocument.imports) {
                    edits.push(vscode_1.TextEdit.delete(imp.getRange(this.document)));
                }
                edits.push(vscode_1.TextEdit.insert(ResolveIndexExtensions_1.getImportInsertPosition(DocumentController.config.resolver.newImportLocation, vscode_1.window.activeTextEditor), this.imports.reduce((all, cur) => all += cur.toImport(DocumentController.config.resolver.importOptions), '')));
            }
            else {
                for (let imp of this._parsedDocument.imports) {
                    if (!this.imports.some(o => o.libraryName === imp.libraryName)) {
                        edits.push(vscode_1.TextEdit.delete(imp.getRange(this.document)));
                    }
                }
                let proxies = this._parsedDocument.imports.filter(o => o instanceof ImportProxy_1.ImportProxy);
                for (let imp of this.imports) {
                    if (imp instanceof ImportProxy_1.ImportProxy &&
                        proxies.some((o) => o.isEqual(imp))) {
                        continue;
                    }
                    if (imp.start !== undefined && imp.end !== undefined) {
                        edits.push(vscode_1.TextEdit.replace(imp.getRange(this.document), imp.toImport(DocumentController.config.resolver.importOptions)));
                    }
                    else {
                        edits.push(vscode_1.TextEdit.insert(ResolveIndexExtensions_1.getImportInsertPosition(DocumentController.config.resolver.newImportLocation, vscode_1.window.activeTextEditor), imp.toImport(DocumentController.config.resolver.importOptions)));
                    }
                }
            }
            // Later, more edits will come (like add methods to a class or so.) 
            let workspaceEdit = new vscode_1.WorkspaceEdit();
            workspaceEdit.set(this.document.uri, edits);
            let result = yield vscode_1.workspace.applyEdit(workspaceEdit);
            if (result) {
                delete this.organize;
                this._parsedDocument = yield DocumentController.parser.parseSource(this.document.getText());
            }
            return result;
        });
    }
    /**
     * Solves conflicts in named specifiers and does ask the user for aliases. Also resolves namings for default
     * imports. As long as the user has a duplicate, he will be asked again.
     *
     * @private
     * @returns {Promise<void>}
     *
     * @memberOf DocumentController
     */
    resolveImportSpecifiers() {
        return __awaiter(this, void 0, void 0, function* () {
            let getSpecifiers = () => this.imports
                .reduce((all, cur) => {
                if (cur instanceof ImportProxy_1.ImportProxy) {
                    all = all.concat(cur.specifiers.map(o => o.alias || o.specifier));
                    if (cur.defaultAlias) {
                        all.push(cur.defaultAlias);
                    }
                }
                if (cur instanceof TsImport_1.TsAliasedImport) {
                    all.push(cur.alias);
                }
                return all;
            }, []);
            for (let decision of Object.keys(this.userImportDecisions)) {
                let declarations = this.userImportDecisions[decision].map(o => new QuickPickItems_1.ResolveQuickPickItem(o));
                let result;
                do {
                    result = yield vscode_1.window.showQuickPick(declarations, {
                        placeHolder: `Multiple declarations for "${decision}" found.`
                    });
                } while (!!!result);
                this.addDeclarationImport(result.declarationInfo);
            }
            let proxies = this.imports.filter(o => o instanceof ImportProxy_1.ImportProxy);
            for (let imp of proxies) {
                if (imp.defaultPurposal && !imp.defaultAlias) {
                    imp.defaultAlias = yield this.getDefaultIdentifier(imp.defaultPurposal, getSpecifiers());
                    delete imp.defaultPurposal;
                }
                for (let spec of imp.specifiers) {
                    let specifiers = getSpecifiers();
                    if (specifiers.filter(o => o === (spec.alias || spec.specifier)).length > 1) {
                        spec.alias = yield this.getSpecifierAlias(specifiers);
                    }
                }
            }
        });
    }
    /**
     * Does resolve a duplicate specifier issue. Calls vscode inputbox as long as the inputted name
     * does match the duplicates. (So the user needs to enter a different one)
     *
     * @private
     * @param {string} duplicate
     * @returns {Promise<string>}
     *
     * @memberOf DocumentController
     */
    getSpecifierAlias(specifiers) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.vscodeInputBox({
                placeHolder: 'Alias for specifier',
                prompt: 'Please enter an alias for the specifier..',
                validateInput: s => !!s ? '' : 'Please enter a variable name'
            }, alias => specifiers.indexOf(alias) >= 0);
        });
    }
    /**
     * Calls the vscode input box to ask for an indentifier for a default export.
     *
     * @private
     * @param {string} declarationName
     * @returns {Promise<string>}
     *
     * @memberOf DocumentController
     */
    getDefaultIdentifier(declarationName, specifiers) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.vscodeInputBox({
                placeHolder: 'Default export name',
                prompt: 'Please enter a variable name for the default export..',
                validateInput: s => !!s ? '' : 'Please enter a variable name',
                value: declarationName
            }, alias => specifiers.indexOf(alias) >= 0);
        });
    }
    /**
     * Ultimately asks the user for an input. Does this, as long as the predicate function returns true.
     *
     * @private
     * @param {InputBoxOptions} options
     * @param {() => boolean} predicate
     * @returns {Promise<string>}
     *
     * @memberOf DocumentController
     */
    vscodeInputBox(options, predicate) {
        return __awaiter(this, void 0, void 0, function* () {
            let value;
            do {
                value = yield vscode_1.window.showInputBox(options);
            } while (predicate(value));
            return value;
        });
    }
}
exports.DocumentController = DocumentController;
