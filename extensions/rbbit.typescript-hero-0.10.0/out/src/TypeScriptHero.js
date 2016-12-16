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
const GuiProvider_1 = require('./provider/GuiProvider');
const inversify_1 = require('inversify');
/**
 * TypeScript Hero vscode extension.
 * Central entrypoint.
 *
 * @export
 * @class TypeScriptHero
 * @implements {Disposable}
 */
let TypeScriptHero = class TypeScriptHero {
    constructor(loggerFactory, guiProvider, extensions, context) {
        this.guiProvider = guiProvider;
        this.extensions = extensions;
        this.logger = loggerFactory('TypescriptHero');
        this.logger.info('Activation event called. TypeScriptHero instantiated.');
        this.extensions.forEach(o => o.initialize(context));
    }
    dispose() {
        this.logger.info('Deactivation event called. Disposing TypeScriptHero.');
        for (let ext of this.extensions) {
            ext.dispose();
        }
    }
};
TypeScriptHero = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject('LoggerFactory')),
    __param(2, inversify_1.multiInject('Extension')),
    __param(3, inversify_1.inject('context')), 
    __metadata('design:paramtypes', [Function, GuiProvider_1.GuiProvider, Array, Object])
], TypeScriptHero);
exports.TypeScriptHero = TypeScriptHero;
