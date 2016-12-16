"use strict";
const TsNode_1 = require('./TsNode');
const path_1 = require('path');
const vscode_1 = require('vscode');
/**
 * Base class for resources. All resources share the same properties.
 *
 * @export
 * @abstract
 * @class TsResource
 * @extends {TsNode}
 */
class TsResource extends TsNode_1.TsNode {
    constructor(start, end) {
        super(start, end);
        this.imports = [];
        this.declarations = [];
        this.exports = [];
        this.resources = [];
        this.usages = [];
    }
    /**
     * Returns an array of usages (a usage is a used symbol name in the resource)
     * that are not covered by its own declarations.
     *
     * @readonly
     * @type {string[]}
     * @memberOf TsResource
     */
    get nonLocalUsages() {
        return this.usages.filter(usage => !this.declarations.some(o => o.name === usage) &&
            !this.resources.some(o => o instanceof TsNamedResource && o.name === usage));
    }
}
exports.TsResource = TsResource;
/**
 * Basic resource for all files in the workspace that are human made or downloaded (*.d.ts) files.
 *
 * @export
 * @class TsFile
 * @extends {TsResource}
 */
class TsFile extends TsResource {
    constructor(filePath, start, end) {
        super(start, end);
        this.filePath = filePath;
    }
    /**
     * Returns the parsed path of a resource.
     *
     * @readonly
     * @type {ParsedPath}
     * @memberOf TsFile
     */
    get parsedPath() {
        return path_1.parse(this.filePath);
    }
    /**
     * Determines if a file is a workspace file or an external resource.
     *
     * @readonly
     * @type {boolean}
     * @memberOf TsFile
     */
    get isWorkspaceFile() {
        return ['node_modules', 'typings'].every(o => this.filePath.indexOf(o) === -1);
    }
    /**
     * Returns the relative path of the file in a workspace. Uses a trailing slash to identify the file.
     *
     * @returns {string}
     *
     * @memberOf TsFile
     */
    getIdentifier() {
        return '/' + vscode_1.workspace.asRelativePath(this.filePath).replace(/([.]d)?[.]tsx?/g, '');
    }
}
exports.TsFile = TsFile;
/**
 * A named resource is a module or namespace that is declared by a *.d.ts file.
 * Contains the declarations and information about that instance.
 *
 * @export
 * @abstract
 * @class TsNamedResource
 * @extends {TsResource}
 */
class TsNamedResource extends TsResource {
    constructor(name, start, end) {
        super(start, end);
        this.name = name;
    }
    /**
     * Function that calculates the alias name of a namespace.
     * Removes all underlines and dashes and camelcases the name.
     *
     * @returns {string}
     *
     * @memberOf TsNamedResource
     */
    getNamespaceAlias() {
        return this.name.split(/[-_]/).reduce((all, cur, idx) => {
            if (idx === 0) {
                return all + cur.toLowerCase();
            }
            else {
                return all + cur.charAt(0).toUpperCase() + cur.substring(1).toLowerCase();
            }
        }, '');
    }
    /**
     * Returns the full library name of the module or namespace.
     *
     * @returns {string}
     *
     * @memberOf TsNamedResource
     */
    getIdentifier() {
        return this.name;
    }
}
exports.TsNamedResource = TsNamedResource;
/**
 * Declaration of a typescript module (i.e. declare module "foobar").
 *
 * @export
 * @class TsModule
 * @extends {TsNamedResource}
 */
class TsModule extends TsNamedResource {
}
exports.TsModule = TsModule;
/**
 * Declaration of a typescript namespace (i.e. declare foobar).
 *
 * @export
 * @class TsNamespace
 * @extends {TsNamedResource}
 */
class TsNamespace extends TsNamedResource {
}
exports.TsNamespace = TsNamespace;
