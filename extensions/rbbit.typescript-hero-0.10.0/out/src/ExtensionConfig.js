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
const TsImportOptions_1 = require('./models/TsImportOptions');
const inversify_1 = require('inversify');
const vscode_1 = require('vscode');
const sectionKey = 'typescriptHero';
/**
 * Configuration class for TypeScript Hero
 * Contains all exposed config endpoints.
 *
 * @export
 * @class ExtensionConfig
 */
let ExtensionConfig = class ExtensionConfig {
    constructor() {
        this.resolverConfig = new ResolverConfig();
        this.restartDebuggerConfig = new RestartDebuggerConfig();
    }
    /**
     * The actual log level.
     *
     * @readonly
     * @type {LogLevel}
     * @memberOf ExtensionConfig
     */
    get logLevel() {
        let optString = vscode_1.workspace.getConfiguration(sectionKey).get('verbosity');
        switch (optString) {
            case 'Nothing':
                return 0 /* Nothing */;
            case 'Errors':
                return 1 /* Errors */;
            case 'All':
                return 3 /* All */;
            default:
                return 2 /* Warnings */;
        }
    }
    /**
     * Configuration object for the resolver extension.
     *
     * @readonly
     * @type {ResolverConfig}
     * @memberOf ExtensionConfig
     */
    get resolver() {
        return this.resolverConfig;
    }
    /**
     * Configuration object for the restart debugger extension.
     *
     * @readonly
     * @type {RestartDebuggerConfig}
     * @memberOf ExtensionConfig
     */
    get restartDebugger() {
        return this.restartDebuggerConfig;
    }
};
ExtensionConfig = __decorate([
    inversify_1.injectable(), 
    __metadata('design:paramtypes', [])
], ExtensionConfig);
exports.ExtensionConfig = ExtensionConfig;
/**
 * Configuration class for the resolver extension.
 *
 * @class ResolverConfig
 */
class ResolverConfig {
    /**
     * Defines, if there should be a space between the brace and the import specifiers.
     * {Symbol} vs { Symbol }
     *
     * @readonly
     * @type {boolean}
     * @memberOf ResolverConfig
     */
    get insertSpaceBeforeAndAfterImportBraces() {
        return vscode_1.workspace.getConfiguration(sectionKey).get('resolver.insertSpaceBeforeAndAfterImportBraces');
    }
    /**
     * Defines the quote style (' or ").
     *
     * @readonly
     * @type {string}
     * @memberOf ResolverConfig
     */
    get pathStringDelimiter() {
        return vscode_1.workspace.getConfiguration(sectionKey).get('resolver.pathStringDelimiter');
    }
    /**
     * Array of string that are excluded from indexing (e.g. build, out, node_modules).
     * If those parts are found after the workspace path is striped away, the file is ignored.
     *
     * @readonly
     * @type {string[]}
     * @memberOf ResolverConfig
     */
    get ignorePatterns() {
        return vscode_1.workspace.getConfiguration(sectionKey).get('resolver.ignorePatterns');
    }
    /**
     * A length number after which the import is transformed into a multiline import.
     *
     * @readonly
     * @type {number}
     * @memberOf ResolverConfig
     */
    get multiLineWrapThreshold() {
        return vscode_1.workspace.getConfiguration(sectionKey).get('resolver.multiLineWrapThreshold');
    }
    /**
     * Where the new imports should be added (e.g. top of the file, current cursor location, etc).
     *
     * @readonly
     * @type {ImportLocation}
     * @memberOf ResolverConfig
     */
    get newImportLocation() {
        let configString = vscode_1.workspace.getConfiguration(sectionKey).get('resolver.newImportLocation');
        return TsImportOptions_1.ImportLocation[configString];
    }
    /**
     * Returns the tab size that is configured in vscode.
     *
     * @readonly
     * @type {number}
     * @memberOf ResolverConfig
     */
    get tabSize() {
        return vscode_1.workspace.getConfiguration().get('editor.tabSize');
    }
    /**
     * All information that are needed to print an import.
     *
     * @readonly
     * @type {TsImportOptions}
     * @memberOf ResolverConfig
     */
    get importOptions() {
        return {
            multiLineWrapThreshold: this.multiLineWrapThreshold,
            pathDelimiter: this.pathStringDelimiter,
            spaceBraces: this.insertSpaceBeforeAndAfterImportBraces,
            tabSize: this.tabSize
        };
    }
}
/**
 * Configuration class for the restart debugger extension.
 *
 * @class RestartDebuggerConfig
 */
class RestartDebuggerConfig {
    /**
     * Defines the folder pathes, which are watched for changes.
     *
     * @readonly
     * @type {string[]}
     * @memberOf RestartDebuggerConfig
     */
    get watchFolders() {
        return vscode_1.workspace.getConfiguration(sectionKey).get('restartDebugger.watchFolders');
    }
    /**
     * Returns the active state that is configured.
     * When true, the restarter is started on startup, otherwise it's deactivated by default.
     *
     * @readonly
     * @type {boolean}
     * @memberOf RestartDebuggerConfig
     */
    get active() {
        return vscode_1.workspace.getConfiguration(sectionKey).get('restartDebugger.active');
    }
}
