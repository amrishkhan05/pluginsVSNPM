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
const CodeAction_1 = require('../models/CodeAction');
const ResolveIndex_1 = require('../caches/ResolveIndex');
const inversify_1 = require('inversify');
/**
 * Provider instance that is responsible for the "light bulb" feature.
 * It provides actions to take when errors occur in the current document (such as missing imports or
 * non implemented interfaces.).
 *
 * @export
 * @class TypescriptCodeActionProvider
 * @implements {CodeActionProvider}
 */
let TypescriptCodeActionProvider = class TypescriptCodeActionProvider {
    constructor(loggerFactory, resolveIndex) {
        this.resolveIndex = resolveIndex;
        this.logger = loggerFactory('TypescriptCodeActionProvider');
    }
    /**
     * Provides the commands to execute for a given problem.
     *
     * @param {TextDocument} document
     * @param {Range} range
     * @param {CodeActionContext} context
     * @param {CancellationToken} token
     * @returns {(Command[] | Thenable<Command[]>)}
     *
     * @memberOf TypescriptCodeActionProvider
     */
    provideCodeActions(document, range, context, token) {
        let commands = [], match, addAllMissingImportsAdded = false;
        for (let diagnostic of context.diagnostics) {
            switch (true) {
                // When the problem is a missing import, add the import to the document.
                case !!(match = isMissingImport(diagnostic)):
                    let info = this.resolveIndex.declarationInfos.find(o => o.declaration.name === match[1]);
                    if (info) {
                        commands.push(this.createCommand(`Import ${info.declaration.name} to the document.`, new CodeAction_1.AddImportCodeAction(document, info)));
                        if (!addAllMissingImportsAdded) {
                            commands.push(this.createCommand('Add all missing imports if possible.', new CodeAction_1.AddMissingImportsCodeAction(document, this.resolveIndex)));
                        }
                    }
                    break;
                default:
                    break;
            }
        }
        return commands;
    }
    /**
     * Creates a customized command for the lightbulb with the correct strings.
     *
     * @private
     * @param {string} title
     * @param {CodeAction} codeAction
     * @returns {Command}
     *
     * @memberOf TypescriptCodeActionProvider
     */
    createCommand(title, codeAction) {
        return {
            arguments: [codeAction],
            command: 'typescriptHero.codeFix.executeCodeAction',
            title
        };
    }
};
TypescriptCodeActionProvider = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject('LoggerFactory')), 
    __metadata('design:paramtypes', [Function, ResolveIndex_1.ResolveIndex])
], TypescriptCodeActionProvider);
exports.TypescriptCodeActionProvider = TypescriptCodeActionProvider;
/**
 * Determines if the problem is a missing import.
 *
 * @param {Diagnostic} diagnostic
 * @returns {RegExpExecArray}
 */
function isMissingImport(diagnostic) {
    return /cannot find name ['"](.*)['"]/ig.exec(diagnostic.message);
}
