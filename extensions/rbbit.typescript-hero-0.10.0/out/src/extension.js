"use strict";
require('reflect-metadata');
const IoC_1 = require('./IoC');
const TypeScriptHero_1 = require('./TypeScriptHero');
let extension;
/**
 * Activates TypeScript Hero
 *
 * @export
 * @param {ExtensionContext} context
 */
function activate(context) {
    if (IoC_1.Injector.isBound('context')) {
        IoC_1.Injector.unbind('context');
    }
    IoC_1.Injector.bind('context').toConstantValue(context);
    extension = IoC_1.Injector.get(TypeScriptHero_1.TypeScriptHero);
}
exports.activate = activate;
/**
 * Deactivates TypeScript Hero
 *
 * @export
 */
function deactivate() {
    extension.dispose();
    extension = null;
}
exports.deactivate = deactivate;
