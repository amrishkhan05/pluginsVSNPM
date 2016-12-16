"use strict";
const TsNode_1 = require('./TsNode');
const vscode_1 = require('vscode');
/**
 * Baseclass for all declaration objects. Contains the name of the symbol, the start and end points.
 *
 * @export
 * @abstract
 * @class TsDeclaration
 * @extends {TsNode}
 */
class TsDeclaration extends TsNode_1.TsNode {
    constructor(name, start, end) {
        super(start, end);
        this.name = name;
    }
}
exports.TsDeclaration = TsDeclaration;
/**
 * Exportable declaration base (e.g. functions, classes)
 * Contains a boolean flag that indicates if the object is exported.
 *
 * @export
 * @abstract
 * @class TsExportableDeclaration
 * @extends {TsDeclaration}
 */
class TsExportableDeclaration extends TsDeclaration {
    constructor(name, start, end, isExported) {
        super(name, start, end);
        this.isExported = isExported;
    }
}
exports.TsExportableDeclaration = TsExportableDeclaration;
/**
 * Callable declaration like a constructor, a method or a function.
 *
 * @export
 * @abstract
 * @class TsExportableCallableDeclaration
 * @extends {TsExportableDeclaration}
 */
class TsExportableCallableDeclaration extends TsExportableDeclaration {
    constructor() {
        super(...arguments);
        this.parameters = [];
        this.variables = [];
    }
}
exports.TsExportableCallableDeclaration = TsExportableCallableDeclaration;
/**
 * Interface declaration that contains defined properties and methods.
 *
 * @export
 * @class InterfaceDeclaration
 * @extends {TsExportableDeclaration}
 */
class InterfaceDeclaration extends TsExportableDeclaration {
    constructor() {
        super(...arguments);
        this.properties = [];
        this.methods = [];
    }
    get itemKind() {
        return vscode_1.CompletionItemKind.Interface;
    }
}
exports.InterfaceDeclaration = InterfaceDeclaration;
/**
 * Class declaration that contains methods, properties and a constructor
 *
 * @export
 * @class ClassDeclaration
 * @extends {InterfaceDeclaration}
 */
class ClassDeclaration extends InterfaceDeclaration {
    get itemKind() {
        return vscode_1.CompletionItemKind.Class;
    }
}
exports.ClassDeclaration = ClassDeclaration;
/**
 * Property declaration that contains its visibility.
 *
 * @export
 * @class PropertyDeclaration
 * @extends {TsDeclaration}
 */
class PropertyDeclaration extends TsDeclaration {
    constructor(name, start, end, visibility) {
        super(name, start, end);
        this.visibility = visibility;
    }
    get itemKind() {
        return vscode_1.CompletionItemKind.Property;
    }
}
exports.PropertyDeclaration = PropertyDeclaration;
/**
 * Method declaration. A method is contained in an interface or a class.
 * Contains information abount the method itself.
 *
 * @export
 * @class MethodDeclaration
 * @extends {TsExportableCallableDeclaration}
 */
class MethodDeclaration extends TsExportableCallableDeclaration {
    constructor(name, start, end) {
        super(name, start, end, false);
    }
    get itemKind() {
        return vscode_1.CompletionItemKind.Method;
    }
}
exports.MethodDeclaration = MethodDeclaration;
/**
 * Function declaration. Like the MethodDeclaration it contains the base info about the function
 * and additional stuff.
 *
 * @export
 * @class FunctionDeclaration
 * @extends {TsExportableCallableDeclaration}
 */
class FunctionDeclaration extends TsExportableCallableDeclaration {
    get itemKind() {
        return vscode_1.CompletionItemKind.Function;
    }
}
exports.FunctionDeclaration = FunctionDeclaration;
/**
 * Constructor declaration that is contained in a class.
 *
 * @export
 * @class ConstructorDeclaration
 * @extends {TsExportableCallableDeclaration}
 */
class ConstructorDeclaration extends TsExportableCallableDeclaration {
    constructor(start, end) {
        super('constructor', start, end, false);
    }
    get itemKind() {
        return vscode_1.CompletionItemKind.Constructor;
    }
}
exports.ConstructorDeclaration = ConstructorDeclaration;
/**
 * Alias declaration that can be exported. Is used to defined types.
 * (e.g. type Foobar = { name: string };)
 *
 * @export
 * @class TypeAliasDeclaration
 * @extends {TsExportableDeclaration}
 */
class TypeAliasDeclaration extends TsExportableDeclaration {
    get itemKind() {
        return vscode_1.CompletionItemKind.Keyword;
    }
}
exports.TypeAliasDeclaration = TypeAliasDeclaration;
/**
 * Enum declaration.
 *
 * @export
 * @class EnumDeclaration
 * @extends {TsExportableDeclaration}
 */
class EnumDeclaration extends TsExportableDeclaration {
    constructor() {
        super(...arguments);
        this.members = [];
    }
    get itemKind() {
        return vscode_1.CompletionItemKind.Value;
    }
}
exports.EnumDeclaration = EnumDeclaration;
/**
 * Variable declaration. Is contained in a method or function, or can be exported.
 *
 * @export
 * @class VariableDeclaration
 * @extends {TsExportableDeclaration}
 */
class VariableDeclaration extends TsExportableDeclaration {
    constructor(name, start, end, isExported, isConst) {
        super(name, start, end, isExported);
        this.isConst = isConst;
    }
    get itemKind() {
        return vscode_1.CompletionItemKind.Variable;
    }
}
exports.VariableDeclaration = VariableDeclaration;
/**
 * Parameter declaration. Is contained in a method or function delaration since a parameter can not be exported
 * by itself.
 *
 * @export
 * @class ParameterDeclaration
 * @extends {TsDeclaration}
 */
class ParameterDeclaration extends TsDeclaration {
    get itemKind() {
        return vscode_1.CompletionItemKind.Variable;
    }
}
exports.ParameterDeclaration = ParameterDeclaration;
/**
 * Default declaration. Is used when a file exports something as its default.
 * Primary use is to ask the user about a name for the default export.
 * Is kind of an abstract declaration since there is no real declaration.
 *
 * @export
 * @class DefaultDeclaration
 * @extends {TsExportableDeclaration}
 */
class DefaultDeclaration extends TsExportableDeclaration {
    constructor(name, resource) {
        super(name, 0, 0, true);
        this.resource = resource;
    }
    get exportedDeclaration() {
        if (!this.exported) {
            this.exported = this.resource.declarations.find(o => o.name === this.name);
        }
        return this.exported;
    }
    get itemKind() {
        return vscode_1.CompletionItemKind.File;
    }
}
exports.DefaultDeclaration = DefaultDeclaration;
/**
 * Module (namespace) declaration. Does export a whole module or namespace that is mainly used by
 * external declaration files.
 *
 * @export
 * @class ModuleDeclaration
 * @extends {TsDeclaration}
 */
class ModuleDeclaration extends TsDeclaration {
    get itemKind() {
        return vscode_1.CompletionItemKind.Module;
    }
}
exports.ModuleDeclaration = ModuleDeclaration;
