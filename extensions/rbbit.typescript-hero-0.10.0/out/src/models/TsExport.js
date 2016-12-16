"use strict";
const TsDeclaration_1 = require('./TsDeclaration');
const TsNode_1 = require('./TsNode');
const TsResource_1 = require('./TsResource');
/**
 * Base export class.
 *
 * @export
 * @abstract
 * @class TsExport
 * @extends {TsNode}
 */
class TsExport extends TsNode_1.TsNode {
    constructor(start, end) {
        super(start, end);
    }
}
exports.TsExport = TsExport;
/**
 * Declares an export from (i.e. export ... from ...).
 *
 * @export
 * @abstract
 * @class TsFromExport
 * @extends {TsNode}
 */
class TsFromExport extends TsNode_1.TsNode {
    constructor(start, end, from) {
        super(start, end);
        this.from = from;
    }
}
exports.TsFromExport = TsFromExport;
/**
 * Declares an all export (i.e. export * from ...).
 *
 * @export
 * @class TsAllFromExport
 * @extends {TsFromExport}
 */
class TsAllFromExport extends TsFromExport {
}
exports.TsAllFromExport = TsAllFromExport;
/**
 * Declares a named export (i.e. export { Foobar } from ...).
 *
 * @export
 * @class TsNamedFromExport
 * @extends {TsFromExport}
 */
class TsNamedFromExport extends TsFromExport {
}
exports.TsNamedFromExport = TsNamedFromExport;
/**
 * Declares an assigned export which is used by external declarations (i.e. export = namespace).
 *
 * @export
 * @class TsAssignedExport
 * @extends {TsExport}
 */
class TsAssignedExport extends TsExport {
    constructor(start, end, declarationIdentifier, _resource) {
        super(start, end);
        this.declarationIdentifier = declarationIdentifier;
        this._resource = _resource;
    }
    get exported() {
        return [
            ...this._resource.declarations
                .filter(o => o instanceof TsDeclaration_1.TsExportableDeclaration && o.isExported && o.name === this.declarationIdentifier),
            ...this._resource.resources
                .filter(o => (o instanceof TsResource_1.TsNamespace || o instanceof TsResource_1.TsModule) && o.name === this.declarationIdentifier)
        ];
    }
}
exports.TsAssignedExport = TsAssignedExport;
