"use strict";
const TsNode_1 = require('./TsNode');
const vscode_1 = require('vscode');
/**
 * Basic import class. Defines an import in a document.
 * If no start and end points are given, the import is considered "new".
 *
 * @export
 * @abstract
 * @class TsImport
 * @extends {TsNode}
 */
class TsImport extends TsNode_1.TsNode {
    constructor(libraryName, start, end) {
        super(start, end);
        this.libraryName = libraryName;
    }
    /**
     * Function that calculates the document range of the import (from / to location in the given document).
     *
     * @param {TextDocument} document
     * @returns {Range} - The actual range of the imports text in the given document.
     *
     * @memberOf TsImport
     */
    getRange(document) {
        return this.start !== undefined && this.end !== undefined ?
            new vscode_1.Range(document.lineAt(document.positionAt(this.start).line).rangeIncludingLineBreak.start, document.lineAt(document.positionAt(this.end).line).rangeIncludingLineBreak.end) :
            new vscode_1.Range(new vscode_1.Position(0, 0), new vscode_1.Position(0, 0));
    }
}
exports.TsImport = TsImport;
/**
 * Base class for an aliased import.
 *
 * @export
 * @abstract
 * @class TsAliasedImport
 * @extends {TsImport}
 */
class TsAliasedImport extends TsImport {
    constructor(libraryName, alias, start, end) {
        super(libraryName, start, end);
        this.alias = alias;
    }
}
exports.TsAliasedImport = TsAliasedImport;
/**
 * Simple string import (i.e. import "reflect-metadata";).
 *
 * @export
 * @class TsStringImport
 * @extends {TsImport}
 */
class TsStringImport extends TsImport {
    toImport({ pathDelimiter }) {
        return `import ${pathDelimiter}${this.libraryName}${pathDelimiter};\n`;
    }
    clone() {
        return new TsStringImport(this.libraryName, this.start, this.end);
    }
}
exports.TsStringImport = TsStringImport;
/**
 * Basic typescript import (ES6 style). Does contain multiple symbols of a file and converts
 * itself to a multiline import if the threshold is reached.
 * (i.e. import {Foobar} from ...).
 *
 * @export
 * @class TsNamedImport
 * @extends {TsImport}
 */
class TsNamedImport extends TsImport {
    constructor() {
        super(...arguments);
        this.specifiers = [];
    }
    toImport(options) {
        let { pathDelimiter, spaceBraces, multiLineWrapThreshold } = options, space = spaceBraces ? ' ' : '', specifiers = this.specifiers.sort(this.specifierSort).map(o => o.toImport()).join(', '), lib = this.libraryName;
        let importString = `import {${space}${specifiers}${space}} from ${pathDelimiter}${lib}${pathDelimiter};\n`;
        if (importString.length > multiLineWrapThreshold) {
            return this.toMultiLineImport(options);
        }
        return importString;
    }
    clone() {
        let clone = new TsNamedImport(this.libraryName, this.start, this.end);
        clone.specifiers = this.specifiers.map(o => o.clone());
        return clone;
    }
    /**
     * Converts the named import into a multiline import.
     *
     * @param {TsImportOptions} {pathDelimiter, tabSize}
     * @returns {string}
     *
     * @memberOf TsNamedImport
     */
    toMultiLineImport({ pathDelimiter, tabSize }) {
        let spacings = Array(tabSize + 1).join(' ');
        return `import {
${this.specifiers.sort(this.specifierSort).map(o => `${spacings}${o.toImport()}`).join(',\n')}
} from ${pathDelimiter}${this.libraryName}${pathDelimiter};\n`;
    }
    /**
     * Sorts the specifiers by name. Sorting function that is passed to [].sort().
     *
     * @private
     * @param {TsResolveSpecifier} i1
     * @param {TsResolveSpecifier} i2
     * @returns {number} - Sort index
     *
     * @memberOf TsNamedImport
     */
    specifierSort(i1, i2) {
        let strA = i1.specifier.toLowerCase(), strB = i2.specifier.toLowerCase();
        if (strA < strB) {
            return -1;
        }
        else if (strA > strB) {
            return 1;
        }
        return 0;
    }
}
exports.TsNamedImport = TsNamedImport;
/**
 * Import that imports a whole namespace (i.e. import * as foobar from 'foobar';).
 *
 * @export
 * @class TsNamespaceImport
 * @extends {TsAliasedImport}
 */
class TsNamespaceImport extends TsAliasedImport {
    toImport({ pathDelimiter }) {
        return `import * as ${this.alias} from ${pathDelimiter}${this.libraryName}${pathDelimiter};\n`;
    }
    clone() {
        return new TsNamespaceImport(this.libraryName, this.alias, this.start, this.end);
    }
}
exports.TsNamespaceImport = TsNamespaceImport;
/**
 * Alternative to the namespace import. Can be used by various libraries.
 * (i.e. import foobar = require('foobar')).
 *
 * @export
 * @class TsExternalModuleImport
 * @extends {TsAliasedImport}
 */
class TsExternalModuleImport extends TsAliasedImport {
    toImport({ pathDelimiter }) {
        return `import ${this.alias} = require(${pathDelimiter}${this.libraryName}${pathDelimiter});\n`;
    }
    clone() {
        return new TsExternalModuleImport(this.libraryName, this.alias, this.start, this.end);
    }
}
exports.TsExternalModuleImport = TsExternalModuleImport;
/**
 * Default import. Imports the default exports of a file.
 * (i.e. import foobar from ...).
 *
 * @export
 * @class TsDefaultImport
 * @extends {TsAliasedImport}
 */
class TsDefaultImport extends TsAliasedImport {
    toImport({ pathDelimiter }) {
        return `import ${this.alias} from ${pathDelimiter}${this.libraryName}${pathDelimiter};\n`;
    }
    clone() {
        return new TsDefaultImport(this.libraryName, this.alias, this.start, this.end);
    }
}
exports.TsDefaultImport = TsDefaultImport;
