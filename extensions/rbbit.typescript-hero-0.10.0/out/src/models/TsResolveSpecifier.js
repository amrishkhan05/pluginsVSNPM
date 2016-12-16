"use strict";
/**
 * Resolve specifier that is contained in named imports and exports.
 * Contains the specifier of the symbol and a possible alias.
 *
 * @export
 * @class TsResolveSpecifier
 */
class TsResolveSpecifier {
    constructor(specifier, alias) {
        this.specifier = specifier;
        this.alias = alias;
    }
    toImport() {
        return `${this.specifier}${this.alias ? ` as ${this.alias}` : ''}`;
    }
    clone() {
        return new TsResolveSpecifier(this.specifier, this.alias);
    }
}
exports.TsResolveSpecifier = TsResolveSpecifier;
