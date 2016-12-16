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
const TypescriptCodeActionProvider_1 = require('../provider/TypescriptCodeActionProvider');
const BaseExtension_1 = require('./BaseExtension');
const inversify_1 = require('inversify');
const vscode_1 = require('vscode');
/**
 * Extension that helps the user fix problems in the code.
 * As an example, if the user copy pastes code and does not have the imports, this part should help with that.
 *
 * @export
 * @class CodeFixExtension
 * @extends {BaseExtension}
 */
let CodeFixExtension = class CodeFixExtension extends BaseExtension_1.BaseExtension {
    constructor(loggerFactory, codeActionProvider) {
        super();
        this.codeActionProvider = codeActionProvider;
        this.logger = loggerFactory('CodeFixExtension');
        this.logger.info('Extension instantiated.');
    }
    getGuiCommands() {
        return [];
    }
    initialize(context) {
        context.subscriptions.push(vscode_1.commands.registerCommand('typescriptHero.codeFix.executeCodeAction', (codeAction) => this.executeCodeAction(codeAction)));
        context.subscriptions.push(vscode_1.languages.registerCodeActionsProvider('typescript', this.codeActionProvider));
        this.logger.info('Initialized.');
    }
    dispose() {
        this.logger.info('Dispose called.');
    }
    /**
     * Executes a code action. If the result is false, a warning is shown.
     *
     * @private
     * @param {CodeAction} codeAction
     * @returns {Promise<void>}
     *
     * @memberOf CodeFixExtension
     */
    executeCodeAction(codeAction) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(yield codeAction.execute())) {
                vscode_1.window.showWarningMessage('The provided code action could not complete. Please see the logs.');
            }
        });
    }
};
CodeFixExtension = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject('LoggerFactory')), 
    __metadata('design:paramtypes', [Function, TypescriptCodeActionProvider_1.TypescriptCodeActionProvider])
], CodeFixExtension);
exports.CodeFixExtension = CodeFixExtension;
