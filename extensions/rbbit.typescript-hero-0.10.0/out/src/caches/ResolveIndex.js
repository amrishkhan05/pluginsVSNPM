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
const ExtensionConfig_1 = require('../ExtensionConfig');
const TsDeclaration_1 = require('../models/TsDeclaration');
const TsExport_1 = require('../models/TsExport');
const TsResource_1 = require('../models/TsResource');
const TsResourceParser_1 = require('../parser/TsResourceParser');
const fs_1 = require('fs');
const inversify_1 = require('inversify');
const path_1 = require('path');
const vscode_1 = require('vscode');
function getNodeLibraryName(path) {
    let dirs = path.split(/\/|\\/), nodeIndex = dirs.indexOf('node_modules');
    return dirs.slice(nodeIndex + 1).join('/')
        .replace(/([.]d)?([.]tsx?)?/g, '')
        .replace(new RegExp(`/(index|${dirs[nodeIndex + 1]})$`), '');
}
/**
 * Global index of typescript declarations. Contains declarations and origins.
 * Provides reverse index for search and declaration info for imports.
 *
 * @export
 * @class ResolveIndex
 */
let ResolveIndex = class ResolveIndex {
    constructor(loggerFactory, parser, config) {
        this.parser = parser;
        this.config = config;
        this.logger = loggerFactory('ResolveIndex');
    }
    /**
     * Indicator if the first index was loaded and calculated or not.
     *
     * @readonly
     * @type {boolean}
     * @memberOf ResolveIndex
     */
    get indexReady() {
        return !!this._index;
    }
    /**
     * Reverse index of the declarations.
     *
     * @readonly
     * @type {ResourceIndex}
     * @memberOf ResolveIndex
     */
    get index() {
        return this._index;
    }
    /**
     * List of all declaration information. Contains the typescript declaration and the
     * "from" information (from where the symbol is imported).
     *
     * @readonly
     * @type {DeclarationInfo[]}
     * @memberOf ResolveIndex
     */
    get declarationInfos() {
        return Object
            .keys(this.index)
            .sort()
            .reduce((all, key) => all.concat(this.index[key]), []);
    }
    /**
     * Tells the index to build a new index.
     * Can be canceled with a cancellationToken.
     *
     * @param {CancellationToken} [cancellationToken]
     * @returns {Promise<void>}
     *
     * @memberOf ResolveIndex
     */
    buildIndex(cancellationToken) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.cancelToken) {
                this.logger.info('Refresh already running, canceling first.');
                this.cancelRefresh();
            }
            this.logger.info('Starting index refresh.');
            this.cancelToken = new vscode_1.CancellationTokenSource();
            try {
                let files = yield this.findFiles(cancellationToken);
                if (cancellationToken && cancellationToken.onCancellationRequested) {
                    this.cancelRequested();
                    return;
                }
                this.logger.info(`Finding finished. Found ${files.length} files.`);
                let parsed = yield this.parser.parseFiles(files);
                if (cancellationToken && cancellationToken.onCancellationRequested) {
                    this.cancelRequested();
                    return;
                }
                this.parsedResources = yield this.parseResources(parsed, cancellationToken);
                this._index = yield this.createIndex(this.parsedResources, cancellationToken);
            }
            catch (e) {
                this.logger.error('Catched an error during buildIndex()', e);
            }
            finally {
                if (this.cancelToken) {
                    this.cancelToken.dispose();
                    this.cancelToken = null;
                }
            }
        });
    }
    /**
     * Rebuild the cache for one specific file. This can happen if a file is changed (saved)
     * and contains a new symbol. All resources are searched for files that possibly export
     * stuff from the given file and are rebuilt as well.
     *
     * @param {string} filePath
     * @returns {Promise<void>}
     *
     * @memberOf ResolveIndex
     */
    rebuildForFile(filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            let rebuildResource = '/' + vscode_1.workspace.asRelativePath(filePath).replace(/[.]tsx?/g, ''), rebuildFiles = [{ fsPath: filePath }, ...this.getExportedResources(rebuildResource)];
            try {
                let resources = yield this.parseResources(yield this.parser.parseFiles(rebuildFiles));
                for (let key of Object.keys(resources)) {
                    this.parsedResources[key] = resources[key];
                }
                this._index = yield this.createIndex(this.parsedResources);
            }
            catch (e) {
                this.logger.error('Catched an error during rebuildForFile()', e);
            }
        });
    }
    /**
     * Removes the definitions and symbols for a specific file. This happens when
     * a file is deleted. All files that export symbols from this file are rebuilt as well.
     *
     * @param {string} filePath
     * @returns {Promise<void>}
     *
     * @memberOf ResolveIndex
     */
    removeForFile(filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            let removeResource = '/' + vscode_1.workspace.asRelativePath(filePath).replace(/[.]tsx?/g, ''), rebuildFiles = this.getExportedResources(removeResource);
            try {
                let resources = yield this.parseResources(yield this.parser.parseFiles(rebuildFiles));
                delete this.parsedResources[removeResource];
                for (let key of Object.keys(resources)) {
                    this.parsedResources[key] = resources[key];
                }
                this._index = yield this.createIndex(this.parsedResources);
            }
            catch (e) {
                this.logger.error('Catched an error during removeForFile()', e);
            }
        });
    }
    /**
     * Possibility to cancel a scheduled index refresh. Does dispose the cancellationToken
     * to indicate a cancellation.
     *
     * @memberOf ResolveIndex
     */
    cancelRefresh() {
        if (this.cancelToken) {
            this.logger.info('Canceling refresh.');
            this.cancelToken.dispose();
            this.cancelToken = null;
        }
    }
    /**
     * Resets the whole index. Does delete everything. Period.
     *
     * @memberOf ResolveIndex
     */
    reset() {
        this.parsedResources = null;
        this._index = null;
    }
    /**
     * Searches through all workspace files to return those, that need to be indexed.
     * The following search patterns apply:
     * - All *.ts and *.tsx of the actual workspace
     * - All *.d.ts files that live in a linked node_module folder (if there is a package.json)
     * - All *.d.ts files that are located in a "typings" folder
     *
     * @private
     * @param {CancellationToken} cancellationToken
     * @returns {Promise<Uri[]>}
     *
     * @memberOf ResolveIndex
     */
    findFiles(cancellationToken) {
        return __awaiter(this, void 0, void 0, function* () {
            let searches = [
                vscode_1.workspace.findFiles('{**/*.ts,**/*.tsx}', '{**/node_modules/**,**/typings/**}', undefined, cancellationToken)
            ];
            let globs = [], ignores = ['**/typings/**'];
            if (vscode_1.workspace.rootPath && fs_1.existsSync(path_1.join(vscode_1.workspace.rootPath, 'package.json'))) {
                let packageJson = require(path_1.join(vscode_1.workspace.rootPath, 'package.json'));
                if (packageJson['dependencies']) {
                    globs = globs.concat(Object.keys(packageJson['dependencies']).map(o => `**/node_modules/${o}/**/*.d.ts`));
                    ignores = ignores.concat(Object.keys(packageJson['dependencies']).map(o => `**/node_modules/${o}/node_modules/**`));
                }
                if (packageJson['devDependencies']) {
                    globs = globs.concat(Object.keys(packageJson['devDependencies']).map(o => `**/node_modules/${o}/**/*.d.ts`));
                    ignores = ignores.concat(Object.keys(packageJson['devDependencies']).map(o => `**/node_modules/${o}/node_modules/**`));
                }
            }
            else {
                globs.push('**/node_modules/**/*.d.ts');
            }
            searches.push(vscode_1.workspace.findFiles(`{${globs.join(',')}}`, `{${ignores.join(',')}}`, undefined, cancellationToken));
            searches.push(vscode_1.workspace.findFiles('**/typings/**/*.d.ts', '**/node_modules/**', undefined, cancellationToken));
            let uris = yield Promise.all(searches);
            if (cancellationToken && cancellationToken.onCancellationRequested) {
                this.cancelRequested();
                return;
            }
            let excludePatterns = this.config.resolver.ignorePatterns;
            uris = uris.map(o => o.filter(f => f.fsPath
                .replace(vscode_1.workspace.rootPath, '')
                .split(/\\|\//)
                .every(p => excludePatterns.indexOf(p) < 0)));
            this.logger.info(`Found ${uris.reduce((sum, cur) => sum + cur.length, 0)} files.`);
            return uris.reduce((all, cur) => all.concat(cur), []);
        });
    }
    /**
     * Does parse the resources (symbols and declarations) of a given file.
     * Can be cancelled with the token.
     *
     * @private
     * @param {TsFile[]} files
     * @param {CancellationToken} [cancellationToken]
     * @returns {Promise<Resources>}
     *
     * @memberOf ResolveIndex
     */
    parseResources(files, cancellationToken) {
        return __awaiter(this, void 0, void 0, function* () {
            let parsedResources = {};
            for (let file of files) {
                if (file.filePath.indexOf('typings') > -1 || file.filePath.indexOf('node_modules/@types') > -1) {
                    for (let resource of file.resources) {
                        parsedResources[resource.getIdentifier()] = resource;
                    }
                }
                else if (file.filePath.indexOf('node_modules') > -1) {
                    let libname = getNodeLibraryName(file.filePath);
                    parsedResources[libname] = file;
                }
                else {
                    parsedResources[file.getIdentifier()] = file;
                }
            }
            if (cancellationToken && cancellationToken.onCancellationRequested) {
                this.cancelRequested();
                return;
            }
            for (let key of Object.keys(parsedResources).sort((k1, k2) => k2.length - k1.length)) {
                if (cancellationToken && cancellationToken.onCancellationRequested) {
                    this.cancelRequested();
                    return;
                }
                let resource = parsedResources[key];
                resource.declarations = resource.declarations
                    .filter(o => o instanceof TsDeclaration_1.TsExportableDeclaration && o.isExported);
                this.processResourceExports(parsedResources, resource);
            }
            return parsedResources;
        });
    }
    /**
     * Creates a reverse index out of the give resources.
     * Can be cancelled with the token.
     *
     * @private
     * @param {Resources} resources
     * @param {CancellationToken} [cancellationToken]
     * @returns {Promise<ResourceIndex>}
     *
     * @memberOf ResolveIndex
     */
    createIndex(resources, cancellationToken) {
        return __awaiter(this, void 0, void 0, function* () {
            if (cancellationToken && cancellationToken.onCancellationRequested) {
                this.cancelRequested();
                return;
            }
            let index = {};
            for (let key of Object.keys(resources)) {
                let resource = resources[key];
                if (resource instanceof TsResource_1.TsNamedResource) {
                    if (!index[resource.name]) {
                        index[resource.name] = [];
                    }
                    index[resource.name].push({
                        declaration: new TsDeclaration_1.ModuleDeclaration(resource.getNamespaceAlias(), resource.start, resource.end),
                        from: resource.name
                    });
                }
                for (let declaration of resource.declarations) {
                    if (!index[declaration.name]) {
                        index[declaration.name] = [];
                    }
                    index[declaration.name].push({
                        declaration,
                        from: key.replace(/[/]?index$/, '') || '/'
                    });
                }
            }
            return index;
        });
    }
    /**
     * Process all exports of a the parsed resources. Does move the declarations accordingly to their
     * export nature.
     *
     * @private
     * @param {Resources} parsedResources
     * @param {TsResource} resource
     * @returns {void}
     *
     * @memberOf ResolveIndex
     */
    processResourceExports(parsedResources, resource, processedResources = []) {
        if (processedResources.indexOf(resource) >= 0) {
            return;
        }
        processedResources.push(resource);
        for (let ex of resource.exports) {
            if (resource instanceof TsResource_1.TsFile && ex instanceof TsExport_1.TsFromExport) {
                if (!ex.from) {
                    return;
                }
                let sourceLib = path_1.resolve(resource.parsedPath.dir, ex.from);
                if (sourceLib.indexOf('node_modules') > -1) {
                    sourceLib = getNodeLibraryName(sourceLib);
                }
                else {
                    sourceLib = '/' + vscode_1.workspace.asRelativePath(sourceLib).replace(/([.]d)?[.]tsx?/g, '');
                }
                if (!parsedResources[sourceLib]) {
                    return;
                }
                let exportedLib = parsedResources[sourceLib];
                this.processResourceExports(parsedResources, exportedLib, processedResources);
                if (ex instanceof TsExport_1.TsAllFromExport) {
                    this.processAllFromExport(parsedResources, resource, exportedLib);
                }
                else if (ex instanceof TsExport_1.TsNamedFromExport) {
                    this.processNamedFromExport(parsedResources, ex, resource, exportedLib);
                }
            }
            else {
                if (ex instanceof TsExport_1.TsAssignedExport) {
                    for (let lib of ex.exported.filter(o => !(o instanceof TsDeclaration_1.TsExportableDeclaration))) {
                        this.processResourceExports(parsedResources, lib, processedResources);
                    }
                    this.processAssignedExport(parsedResources, ex, resource);
                }
                else if (ex instanceof TsExport_1.TsNamedFromExport && ex.from && parsedResources[ex.from]) {
                    this.processResourceExports(parsedResources, parsedResources[ex.from], processedResources);
                    this.processNamedFromExport(parsedResources, ex, resource, parsedResources[ex.from]);
                }
            }
        }
    }
    /**
     * Processes an all export, does move the declarations accordingly.
     * (i.e. export * from './myFile')
     *
     * @private
     * @param {Resources} parsedResources
     * @param {TsResource} exportingLib
     * @param {TsResource} exportedLib
     *
     * @memberOf ResolveIndex
     */
    processAllFromExport(parsedResources, exportingLib, exportedLib) {
        exportingLib.declarations.push(...exportedLib.declarations);
        exportedLib.declarations = [];
    }
    /**
     * Processes a named export, does move the declarations accordingly.
     * (i.e. export {MyClass} from './myFile')
     *
     * @private
     * @param {Resources} parsedResources
     * @param {TsNamedFromExport} tsExport
     * @param {TsResource} exportingLib
     * @param {TsResource} exportedLib
     *
     * @memberOf ResolveIndex
     */
    processNamedFromExport(parsedResources, tsExport, exportingLib, exportedLib) {
        exportedLib.declarations
            .forEach(o => {
            let ex = tsExport.specifiers.find(s => s.specifier === o.name);
            if (!ex) {
                return;
            }
            exportedLib.declarations.splice(exportedLib.declarations.indexOf(o), 1);
            if (ex.alias) {
                o.name = ex.alias;
            }
            exportingLib.declarations.push(o);
        });
    }
    /**
     * Processes an assigned export, does move the declarations accordingly.
     * (i.e. export = namespaceName)
     *
     * @private
     * @param {Resources} parsedResources
     * @param {TsAssignedExport} tsExport
     * @param {TsResource} exportingLib
     *
     * @memberOf ResolveIndex
     */
    processAssignedExport(parsedResources, tsExport, exportingLib) {
        tsExport.exported.forEach(exported => {
            if (exported instanceof TsDeclaration_1.TsExportableDeclaration) {
                exportingLib.declarations.push(exported);
            }
            else {
                exportingLib.declarations.push(...exported.declarations.filter(o => o instanceof TsDeclaration_1.TsExportableDeclaration && o.isExported));
                exported.declarations = [];
            }
        });
    }
    /**
     * Returns a list of files that export a certain resource (declaration).
     *
     * @private
     * @param {string} resourceToCheck
     * @returns {Uri[]}
     *
     * @memberOf ResolveIndex
     */
    getExportedResources(resourceToCheck) {
        let resources = [];
        Object
            .keys(this.parsedResources)
            .filter(o => o.startsWith('/'))
            .forEach(key => {
            let resource = this.parsedResources[key];
            if (this.doesExportResource(resource, resourceToCheck)) {
                resources.push({ fsPath: resource.filePath });
            }
        });
        return resources;
    }
    /**
     * Checks if a file does export another resource.
     * (i.e. export ... from ...)
     *
     * @private
     * @param {TsFile} resource - The file that is checked
     * @param {string} resourcePath - The resource that is searched for
     * @returns {boolean}
     *
     * @memberOf ResolveIndex
     */
    doesExportResource(resource, resourcePath) {
        let exportsResource = false;
        for (let ex of resource.exports) {
            if (exportsResource) {
                break;
            }
            if (ex instanceof TsExport_1.TsAllFromExport || ex instanceof TsExport_1.TsNamedFromExport) {
                let exported = '/' + vscode_1.workspace.asRelativePath(path_1.normalize(path_1.join(resource.parsedPath.dir, ex.from)));
                exportsResource = exported === resourcePath;
            }
        }
        return exportsResource;
    }
    /**
     * Loggs the requested cancellation.
     *
     * @private
     *
     * @memberOf ResolveIndex
     */
    cancelRequested() {
        this.logger.info('Cancellation requested.');
    }
};
ResolveIndex = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject('LoggerFactory')), 
    __metadata('design:paramtypes', [Function, TsResourceParser_1.TsResourceParser, ExtensionConfig_1.ExtensionConfig])
], ResolveIndex);
exports.ResolveIndex = ResolveIndex;