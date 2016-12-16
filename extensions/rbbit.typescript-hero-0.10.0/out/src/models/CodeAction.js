"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator.throw(value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments)).next());
    });
};
const DocumentController_1 = require('../controllers/DocumentController');
/**
 * Code action that adds a missing import the the actual document.
 *
 * @export
 * @class AddImportCodeAction
 * @implements {CodeAction}
 */
class AddImportCodeAction {
    constructor(document, importToAdd) {
        this.document = document;
        this.importToAdd = importToAdd;
    }
    execute() {
        return __awaiter(this, void 0, void 0, function* () {
            let controller = yield DocumentController_1.DocumentController.create(this.document);
            return controller.addDeclarationImport(this.importToAdd).commit();
        });
    }
}
exports.AddImportCodeAction = AddImportCodeAction;
/**
 * Code action that adds all missing imports to the actual document, based on the non-local usages.
 *
 * @export
 * @class AddMissingImportsCodeAction
 * @implements {CodeAction}
 */
class AddMissingImportsCodeAction {
    constructor(document, resolveIndex) {
        this.document = document;
        this.resolveIndex = resolveIndex;
    }
    execute() {
        return __awaiter(this, void 0, void 0, function* () {
            let controller = yield DocumentController_1.DocumentController.create(this.document);
            return controller.addMissingImports(this.resolveIndex).commit();
        });
    }
}
exports.AddMissingImportsCodeAction = AddMissingImportsCodeAction;
