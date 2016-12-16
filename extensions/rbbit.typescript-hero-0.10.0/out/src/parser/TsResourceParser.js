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
const TsDeclaration_1 = require('../models/TsDeclaration');
const TsExport_1 = require('../models/TsExport');
const TsImport_1 = require('../models/TsImport');
const TsResolveSpecifier_1 = require('../models/TsResolveSpecifier');
const TsResource_1 = require('../models/TsResource');
const TypeGuards_1 = require('../utilities/TypeGuards');
const fs_1 = require('fs');
const inversify_1 = require('inversify');
const typescript_1 = require('typescript');
const usageNotAllowedParents = [
    typescript_1.SyntaxKind.ImportEqualsDeclaration,
    typescript_1.SyntaxKind.ImportSpecifier,
    typescript_1.SyntaxKind.NamespaceImport,
    typescript_1.SyntaxKind.ClassDeclaration,
    typescript_1.SyntaxKind.ImportDeclaration,
    typescript_1.SyntaxKind.InterfaceDeclaration,
    typescript_1.SyntaxKind.ExportDeclaration,
    typescript_1.SyntaxKind.ExportSpecifier,
    typescript_1.SyntaxKind.ImportSpecifier,
    typescript_1.SyntaxKind.FunctionDeclaration,
    typescript_1.SyntaxKind.EnumDeclaration,
    typescript_1.SyntaxKind.TypeAliasDeclaration,
    typescript_1.SyntaxKind.MethodDeclaration
];
const usageAllowedIfLast = [
    typescript_1.SyntaxKind.Parameter,
    typescript_1.SyntaxKind.PropertyDeclaration,
    typescript_1.SyntaxKind.VariableDeclaration,
    typescript_1.SyntaxKind.ElementAccessExpression,
    typescript_1.SyntaxKind.BinaryExpression
];
const usagePredicates = [
        (o) => usageNotAllowedParents.indexOf(o.parent.kind) === -1,
    allowedIfLastIdentifier,
    allowedIfPropertyAccessFirst
];
/**
 * Predicate function to determine if the node is possible as a "usage".
 * Checks for the node identifier to be the last of the identifier list.
 *
 * @param {Node} node
 * @returns {boolean}
 */
function allowedIfLastIdentifier(node) {
    if (usageAllowedIfLast.indexOf(node.parent.kind) === -1) {
        return true;
    }
    let children = node.parent.getChildren().filter(o => o.kind === typescript_1.SyntaxKind.Identifier);
    return children.length === 1 || children.indexOf(node) === 1;
}
/**
 * Predicate function to determine if the node is possible as a "usage".
 * Checks if the identifier is on the lefthand side of a property access.
 *
 * @param {Node} node
 * @returns {boolean}
 */
function allowedIfPropertyAccessFirst(node) {
    if (node.parent.kind !== typescript_1.SyntaxKind.PropertyAccessExpression) {
        return true;
    }
    let children = node.parent.getChildren();
    return children.indexOf(node) === 0;
}
/**
 * Function that calculates the default name of a resource.
 * This is used when a default export has no name (i.e. export class {}).
 *
 * @param {TsResource} resource
 * @returns {string}
 */
function getDefaultResourceIdentifier(resource) {
    if (resource instanceof TsResource_1.TsFile && resource.isWorkspaceFile) {
        return resource.parsedPath.name;
    }
    return resource.getIdentifier();
}
/**
 * Magic.happen('here');
 * This class is the parser of the whole extension. It uses the typescript compiler to parse a file or given
 * source code into the token stream and therefore into the AST of the source. Afterwards an array of
 * resources is generated and returned.
 *
 * @export
 * @class TsResourceParser
 */
let TsResourceParser = class TsResourceParser {
    constructor(loggerFactory) {
        this.logger = loggerFactory('TsResourceParser');
        this.logger.info('Instantiated.');
    }
    /**
     * Parses the given source into an anonymous TsFile resource.
     * Mainly used to parse source code of a document.
     *
     * @param {string} source
     * @returns {Promise<TsFile>}
     *
     * @memberOf TsResourceParser
     */
    parseSource(source) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.parseTypescript(typescript_1.createSourceFile('inline.ts', source, typescript_1.ScriptTarget.ES6, true));
            }
            catch (e) {
                this.logger.error('Error happend during source parsing (parseSource())', { error: e });
            }
        });
    }
    /**
     * Parses a single file into a TsFile.
     *
     * @param {Uri} file
     * @returns {Promise<TsFile>}
     *
     * @memberOf TsResourceParser
     */
    parseFile(file) {
        return __awaiter(this, void 0, void 0, function* () {
            return (yield this.parseFiles([file]))[0];
        });
    }
    /**
     * Parses multiple files into TsFiles. Can be canceled with the token.
     *
     * @param {Uri[]} filePathes
     * @param {CancellationToken} [cancellationToken]
     * @returns {Promise<TsFile[]>}
     *
     * @memberOf TsResourceParser
     */
    parseFiles(filePathes, cancellationToken) {
        return __awaiter(this, void 0, void 0, function* () {
            if (cancellationToken && cancellationToken.onCancellationRequested) {
                this.cancelRequested();
                return;
            }
            try {
                let parsed = filePathes
                    .map(o => typescript_1.createSourceFile(o.fsPath, fs_1.readFileSync(o.fsPath).toString(), typescript_1.ScriptTarget.ES6, true))
                    .map(o => this.parseTypescript(o, cancellationToken));
                if (cancellationToken && cancellationToken.onCancellationRequested) {
                    this.cancelRequested();
                    return;
                }
                return parsed;
            }
            catch (e) {
                this.logger.error('Error happend during file parsing', { error: e });
            }
        });
    }
    /**
     * Parses the typescript source into the TsFile instance. Calls .parse afterwards to
     * get the declarations and other information about the source.
     *
     * @private
     * @param {SourceFile} source
     * @param {CancellationToken} [cancellationToken]
     * @returns {TsFile}
     *
     * @memberOf TsResourceParser
     */
    parseTypescript(source, cancellationToken) {
        let tsFile = new TsResource_1.TsFile(source.fileName, source.getStart(), source.getEnd());
        let syntaxList = source.getChildAt(0);
        if (cancellationToken && cancellationToken.onCancellationRequested) {
            this.cancelRequested();
            return;
        }
        this.parse(tsFile, syntaxList, cancellationToken);
        return tsFile;
    }
    /**
     * Recursive function that runs through the AST of a source and parses the nodes.
     * Creates the class / function / etc declarations and instanciates a new module / namespace
     * resource if needed.
     *
     * @private
     * @param {TsResource} tsResource
     * @param {Node} node
     * @param {CancellationToken} [cancellationToken]
     *
     * @memberOf TsResourceParser
     */
    parse(tsResource, node, cancellationToken) {
        for (let child of node.getChildren()) {
            if (cancellationToken && cancellationToken.onCancellationRequested) {
                return;
            }
            switch (child.kind) {
                case typescript_1.SyntaxKind.ImportDeclaration:
                case typescript_1.SyntaxKind.ImportEqualsDeclaration:
                    this.parseImport(tsResource, child);
                    break;
                case typescript_1.SyntaxKind.ExportDeclaration:
                case typescript_1.SyntaxKind.ExportAssignment:
                    this.parseExport(tsResource, child);
                    break;
                case typescript_1.SyntaxKind.EnumDeclaration:
                    this.parseEnum(tsResource, child);
                    break;
                case typescript_1.SyntaxKind.TypeAliasDeclaration:
                    this.parseTypeAlias(tsResource, child);
                    break;
                case typescript_1.SyntaxKind.FunctionDeclaration:
                    this.parseFunction(tsResource, child);
                    continue;
                case typescript_1.SyntaxKind.VariableStatement:
                    this.parseVariable(tsResource, child);
                    break;
                case typescript_1.SyntaxKind.InterfaceDeclaration:
                    this.parseInterface(tsResource, child);
                    break;
                case typescript_1.SyntaxKind.ClassDeclaration:
                    this.parseClass(tsResource, child);
                    continue;
                case typescript_1.SyntaxKind.Identifier:
                    this.parseIdentifier(tsResource, child);
                    break;
                case typescript_1.SyntaxKind.ModuleDeclaration:
                    let resource = this.parseModule(tsResource, child);
                    this.parse(resource, child, cancellationToken);
                    continue;
                default:
                    break;
            }
            this.parse(tsResource, child, cancellationToken);
        }
    }
    /**
     * Parses an import node into the declaration.
     *
     * @private
     * @param {TsResource} tsResource
     * @param {(ImportDeclaration | ImportEqualsDeclaration)} node
     *
     * @memberOf TsResourceParser
     */
    parseImport(tsResource, node) {
        if (TypeGuards_1.isImportDeclaration(node)) {
            if (node.importClause && TypeGuards_1.isNamespaceImport(node.importClause.namedBindings)) {
                let lib = node.moduleSpecifier, alias = node.importClause.namedBindings.name;
                tsResource.imports.push(new TsImport_1.TsNamespaceImport(lib.text, alias.text, node.getStart(), node.getEnd()));
            }
            else if (node.importClause && TypeGuards_1.isNamedImports(node.importClause.namedBindings)) {
                let lib = node.moduleSpecifier, bindings = node.importClause.namedBindings, tsImport = new TsImport_1.TsNamedImport(lib.text, node.getStart(), node.getEnd());
                tsImport.specifiers = bindings.elements.map(o => o.propertyName && o.name ?
                    new TsResolveSpecifier_1.TsResolveSpecifier(o.propertyName.text, o.name.text) :
                    new TsResolveSpecifier_1.TsResolveSpecifier(o.name.text));
                tsResource.imports.push(tsImport);
            }
            else if (node.importClause && node.importClause.name) {
                let lib = node.moduleSpecifier, alias = node.importClause.name;
                tsResource.imports.push(new TsImport_1.TsDefaultImport(lib.text, alias.text, node.getStart(), node.getEnd()));
            }
            else if (node.moduleSpecifier && TypeGuards_1.isStringLiteral(node.moduleSpecifier)) {
                let lib = node.moduleSpecifier;
                tsResource.imports.push(new TsImport_1.TsStringImport(lib.text, node.getStart(), node.getEnd()));
            }
        }
        else if (TypeGuards_1.isExternalModuleReference(node.moduleReference)) {
            let alias = node.name, lib = node.moduleReference.expression;
            tsResource.imports.push(new TsImport_1.TsExternalModuleImport(lib.text, alias.text, node.getStart(), node.getEnd()));
        }
    }
    /**
     * Parses an export node into the declaration.
     *
     * @private
     * @param {TsResource} tsResource
     * @param {(ExportDeclaration | ExportAssignment)} node
     * @returns {void}
     *
     * @memberOf TsResourceParser
     */
    parseExport(tsResource, node) {
        if (TypeGuards_1.isExportDeclaration(node)) {
            let tsExport = node;
            if (!TypeGuards_1.isStringLiteral(tsExport.moduleSpecifier)) {
                return;
            }
            if (tsExport.getText().indexOf('*') > -1) {
                tsResource.exports.push(new TsExport_1.TsAllFromExport(node.getStart(), node.getEnd(), tsExport.moduleSpecifier.text));
            }
            else if (tsExport.exportClause && TypeGuards_1.isNamedExports(tsExport.exportClause)) {
                let lib = tsExport.moduleSpecifier, ex = new TsExport_1.TsNamedFromExport(node.getStart(), node.getEnd(), lib.text);
                ex.specifiers = tsExport.exportClause.elements.map(o => o.propertyName && o.name ?
                    new TsResolveSpecifier_1.TsResolveSpecifier(o.propertyName.text, o.name.text) :
                    new TsResolveSpecifier_1.TsResolveSpecifier(o.name.text));
                tsResource.exports.push(ex);
            }
        }
        else {
            let literal = node.expression;
            if (node.isExportEquals) {
                tsResource.exports.push(new TsExport_1.TsAssignedExport(node.getStart(), node.getEnd(), literal.text, tsResource));
            }
            else {
                let name = (literal && literal.text) ? literal.text : getDefaultResourceIdentifier(tsResource);
                tsResource.declarations.push(new TsDeclaration_1.DefaultDeclaration(name, tsResource));
            }
        }
    }
    /**
     * Parses an identifier into a usage of a resource if the predicates are true.
     *
     * @private
     * @param {TsResource} tsResource
     * @param {Identifier} node
     *
     * @memberOf TsResourceParser
     */
    parseIdentifier(tsResource, node) {
        if (node.parent && usagePredicates.every(predicate => predicate(node))) {
            if (tsResource.usages.indexOf(node.text) === -1) {
                tsResource.usages.push(node.text);
            }
        }
    }
    /**
     * Parses an enum node into the declaration.
     *
     * @private
     * @param {TsResource} tsResource
     * @param {EnumDeclaration} node
     *
     * @memberOf TsResourceParser
     */
    parseEnum(tsResource, node) {
        let declaration = new TsDeclaration_1.EnumDeclaration(node.name.text, node.getStart(), node.getEnd(), this.checkExported(node));
        declaration.members = node.members.map(o => o.name.getText());
        tsResource.declarations.push(declaration);
    }
    /**
     * Parses a type alias into the declaration.
     *
     * @private
     * @param {TsResource} tsResource
     * @param {TypeAliasDeclaration} node
     *
     * @memberOf TsResourceParser
     */
    parseTypeAlias(tsResource, node) {
        tsResource.declarations.push(new TsDeclaration_1.TypeAliasDeclaration(node.name.text, node.getStart(), node.getEnd(), this.checkExported(node)));
    }
    /**
     * Parses a function into its declaration.
     * Parses the functions sub information like parameters and variables.
     *
     * @private
     * @param {TsResource} tsResource
     * @param {FunctionDeclaration} node
     *
     * @memberOf TsResourceParser
     */
    parseFunction(tsResource, node) {
        let name = node.name ? node.name.text : getDefaultResourceIdentifier(tsResource);
        let func = new TsDeclaration_1.FunctionDeclaration(name, node.getStart(), node.getEnd(), this.checkExported(node));
        if (this.checkDefaultExport(node)) {
            func.isExported = false;
            tsResource.declarations.push(new TsDeclaration_1.DefaultDeclaration(func.name, tsResource));
        }
        func.parameters = this.parseMethodParams(node);
        tsResource.declarations.push(func);
        this.parseFunctionParts(tsResource, func, node);
    }
    /**
     * Parse a variable. Information such as "is the variable const" are calculated here.
     *
     * @private
     * @param {(TsResource | TsExportableCallableDeclaration)} parent
     * @param {VariableStatement} node
     *
     * @memberOf TsResourceParser
     */
    parseVariable(parent, node) {
        let isConst = node.declarationList.getChildren().some(o => o.kind === typescript_1.SyntaxKind.ConstKeyword);
        if (node.declarationList && node.declarationList.declarations) {
            node.declarationList.declarations.forEach(o => {
                let declaration = new TsDeclaration_1.VariableDeclaration(o.name.getText(), node.getStart(), node.getEnd(), this.checkExported(node), isConst);
                if (parent instanceof TsDeclaration_1.TsExportableCallableDeclaration) {
                    parent.variables.push(declaration);
                }
                else {
                    parent.declarations.push(declaration);
                }
            });
        }
    }
    /**
     * Parses an interface node into its declaration.
     * Calculates the property and method defintions of the interface as well.
     *
     * @private
     * @param {TsResource} tsResource
     * @param {InterfaceDeclaration} node
     *
     * @memberOf TsResourceParser
     */
    parseInterface(tsResource, node) {
        let name = node.name ? node.name.text : getDefaultResourceIdentifier(tsResource);
        let interfaceDeclaration = new TsDeclaration_1.InterfaceDeclaration(name, node.getStart(), node.getEnd(), this.checkExported(node));
        if (this.checkDefaultExport(node)) {
            interfaceDeclaration.isExported = false;
            tsResource.declarations.push(new TsDeclaration_1.DefaultDeclaration(interfaceDeclaration.name, tsResource));
        }
        if (node.members) {
            node.members.forEach(o => {
                if (TypeGuards_1.isPropertySignature(o)) {
                    interfaceDeclaration.properties.push(new TsDeclaration_1.PropertyDeclaration(o.name.text, o.getStart(), o.getEnd(), 1 /* Public */));
                }
                else if (TypeGuards_1.isMethodSignature(o)) {
                    let method = new TsDeclaration_1.MethodDeclaration(o.name.text, o.getStart(), o.getEnd());
                    method.parameters = this.parseMethodParams(o);
                    interfaceDeclaration.methods.push(method);
                }
            });
        }
        tsResource.declarations.push(interfaceDeclaration);
    }
    /**
     * Parses a class node into its declaration. Calculates the properties, constructors and methods of the class.
     *
     * @private
     * @param {TsResource} tsResource
     * @param {ClassDeclaration} node
     *
     * @memberOf TsResourceParser
     */
    parseClass(tsResource, node) {
        let name = node.name ? node.name.text : getDefaultResourceIdentifier(tsResource);
        let classDeclaration = new TsDeclaration_1.ClassDeclaration(name, node.getStart(), node.getEnd(), this.checkExported(node));
        if (this.checkDefaultExport(node)) {
            classDeclaration.isExported = false;
            tsResource.declarations.push(new TsDeclaration_1.DefaultDeclaration(classDeclaration.name, tsResource));
        }
        if (node.members) {
            node.members.forEach(o => {
                if (TypeGuards_1.isPropertyDeclaration(o)) {
                    let actualCount = classDeclaration.properties.length;
                    if (o.modifiers) {
                        o.modifiers.forEach(m => {
                            if (m.kind === typescript_1.SyntaxKind.PublicKeyword) {
                                classDeclaration.properties.push(new TsDeclaration_1.PropertyDeclaration(o.name.text, o.getStart(), o.getEnd(), 1 /* Public */));
                                return;
                            }
                            if (m.kind === typescript_1.SyntaxKind.ProtectedKeyword) {
                                classDeclaration.properties.push(new TsDeclaration_1.PropertyDeclaration(o.name.text, o.getStart(), o.getEnd(), 2 /* Protected */));
                                return;
                            }
                            if (m.kind === typescript_1.SyntaxKind.PrivateKeyword) {
                                classDeclaration.properties.push(new TsDeclaration_1.PropertyDeclaration(o.name.text, o.getStart(), o.getEnd(), 0 /* Private */));
                                return;
                            }
                        });
                    }
                    if (actualCount === classDeclaration.properties.length) {
                        classDeclaration.properties.push(new TsDeclaration_1.PropertyDeclaration(o.name.text, o.getStart(), o.getEnd(), 1 /* Public */));
                    }
                    return;
                }
                if (TypeGuards_1.isConstructorDeclaration(o)) {
                    let ctor = new TsDeclaration_1.ConstructorDeclaration(o.getStart(), o.getEnd());
                    this.parseCtorParams(classDeclaration, ctor, o);
                    classDeclaration.ctor = ctor;
                    this.parseFunctionParts(tsResource, ctor, o);
                }
                else if (TypeGuards_1.isMethodDeclaration(o)) {
                    let method = new TsDeclaration_1.MethodDeclaration(o.name.text, o.getStart(), o.getEnd());
                    method.parameters = this.parseMethodParams(o);
                    classDeclaration.methods.push(method);
                    this.parseFunctionParts(tsResource, method, o);
                }
            });
        }
        this.parseClassIdentifiers(tsResource, node);
        tsResource.declarations.push(classDeclaration);
    }
    /**
     * Parses the identifiers of a class (usages).
     *
     * @private
     * @param {TsResource} tsResource
     * @param {Node} node
     *
     * @memberOf TsResourceParser
     */
    parseClassIdentifiers(tsResource, node) {
        for (let child of node.getChildren()) {
            switch (child.kind) {
                case typescript_1.SyntaxKind.Identifier:
                    this.parseIdentifier(tsResource, child);
                    break;
                default:
                    break;
            }
            this.parseClassIdentifiers(tsResource, child);
        }
    }
    /**
     * Parse a module to its declaration. Create a new namespace or module declaration and return it to
     * be used as the new "container".
     *
     * @private
     * @param {TsResource} tsResource
     * @param {ModuleDeclaration} node
     * @returns {TsResource}
     *
     * @memberOf TsResourceParser
     */
    parseModule(tsResource, node) {
        let resource = (node.flags & typescript_1.NodeFlags.Namespace) === typescript_1.NodeFlags.Namespace ?
            new TsResource_1.TsNamespace(node.name.text, node.getStart(), node.getEnd()) :
            new TsResource_1.TsModule(node.name.text, node.getStart(), node.getEnd());
        tsResource.resources.push(resource);
        return resource;
    }
    /**
     * Parse the parts of a function. All functions / methods contain various information about used variables
     * and parameters.
     *
     * @private
     * @param {TsResource} tsResource
     * @param {(TshConstructorDeclaration | TshMethodDeclaration | TshFunctionDeclaration)} parent
     * @param {Node} node
     *
     * @memberOf TsResourceParser
     */
    parseFunctionParts(tsResource, parent, node) {
        for (let child of node.getChildren()) {
            switch (child.kind) {
                case typescript_1.SyntaxKind.Identifier:
                    this.parseIdentifier(tsResource, child);
                    break;
                case typescript_1.SyntaxKind.VariableStatement:
                    this.parseVariable(parent, child);
                    break;
                default:
                    break;
            }
            this.parseFunctionParts(tsResource, parent, child);
        }
    }
    /**
     * Parse information about a constructor. Contains parameters and used modifiers
     * (i.e. constructor(private name: string)).
     *
     * @private
     * @param {TshClassDeclaration} parent
     * @param {TshConstructorDeclaration} ctor
     * @param {ConstructorDeclaration} node
     * @returns {void}
     *
     * @memberOf TsResourceParser
     */
    parseCtorParams(parent, ctor, node) {
        if (!node.parameters) {
            return;
        }
        node.parameters.forEach(o => {
            if (TypeGuards_1.isIdentifier(o.name)) {
                ctor.parameters.push(new TsDeclaration_1.ParameterDeclaration(o.name.text, o.getStart(), o.getEnd()));
                if (!o.modifiers) {
                    return;
                }
                o.modifiers.forEach(m => {
                    if (m.kind === typescript_1.SyntaxKind.PublicKeyword) {
                        parent.properties.push(new TsDeclaration_1.PropertyDeclaration(o.name.text, m.getStart(), m.getEnd(), 1 /* Public */));
                        return;
                    }
                    if (m.kind === typescript_1.SyntaxKind.ProtectedKeyword) {
                        parent.properties.push(new TsDeclaration_1.PropertyDeclaration(o.name.text, m.getStart(), m.getEnd(), 2 /* Protected */));
                        return;
                    }
                    if (m.kind === typescript_1.SyntaxKind.PrivateKeyword) {
                        parent.properties.push(new TsDeclaration_1.PropertyDeclaration(o.name.text, m.getStart(), m.getEnd(), 0 /* Private */));
                        return;
                    }
                });
            }
            else if (TypeGuards_1.isObjectBindingPattern(o.name) || TypeGuards_1.isArrayBindingPattern(o.name)) {
                let identifiers = o.name;
                ctor.parameters = ctor.parameters.concat(identifiers.elements.map((bind) => {
                    if (TypeGuards_1.isIdentifier(bind.name)) {
                        return new TsDeclaration_1.ParameterDeclaration(bind.name.text, bind.getStart(), bind.getEnd());
                    }
                }).filter(Boolean));
            }
        });
    }
    /**
     * Parse method parameters.
     *
     * @private
     * @param {(FunctionDeclaration | MethodDeclaration | MethodSignature)} node
     * @returns {TshParameterDeclaration[]}
     *
     * @memberOf TsResourceParser
     */
    parseMethodParams(node) {
        return node.parameters.reduce((all, cur) => {
            if (TypeGuards_1.isIdentifier(cur.name)) {
                all.push(new TsDeclaration_1.ParameterDeclaration(cur.name.text, cur.getStart(), cur.getEnd()));
            }
            else if (TypeGuards_1.isObjectBindingPattern(cur.name) || TypeGuards_1.isArrayBindingPattern(cur.name)) {
                let identifiers = cur.name;
                all = all.concat(identifiers.elements.map((o) => {
                    if (TypeGuards_1.isIdentifier(o.name)) {
                        return new TsDeclaration_1.ParameterDeclaration(o.name.text, o.getStart(), o.getEnd());
                    }
                }).filter(Boolean));
            }
            return all;
        }, []);
    }
    /**
     * Check if the given typescript node has the exported flag.
     * (e.g. export class Foobar).
     *
     * @private
     * @param {Node} node
     * @returns {boolean}
     *
     * @memberOf TsResourceParser
     */
    checkExported(node) {
        return (node.flags & typescript_1.NodeFlags.Export) === typescript_1.NodeFlags.Export;
    }
    /**
     * Check if the given typescript node has the default flag.
     * (e.g. export default class Foobar).
     *
     * @private
     * @param {Node} node
     * @returns {boolean}
     *
     * @memberOf TsResourceParser
     */
    checkDefaultExport(node) {
        return (node.flags & typescript_1.NodeFlags.Default) === typescript_1.NodeFlags.Default;
    }
    /**
     * Log the requested need of a canellation.
     *
     * @private
     *
     * @memberOf TsResourceParser
     */
    cancelRequested() {
        this.logger.info('Cancellation requested');
    }
};
TsResourceParser = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject('LoggerFactory')), 
    __metadata('design:paramtypes', [Function])
], TsResourceParser);
exports.TsResourceParser = TsResourceParser;
