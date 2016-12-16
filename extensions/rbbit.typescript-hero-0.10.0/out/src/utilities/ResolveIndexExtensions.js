"use strict";
const TsDeclaration_1 = require('../models/TsDeclaration');
const TsImport_1 = require('../models/TsImport');
const TsImportOptions_1 = require('../models/TsImportOptions');
const path_1 = require('path');
const vscode_1 = require('vscode');
/**
 * Calculate the position, where a new import should be inserted.
 * Does respect the "use strict" string as first line of a document.
 *
 * @export
 * @param {ImportLocation} location
 * @param {TextEditor} editor
 * @returns {Position}
 */
function getImportInsertPosition(location, editor) {
    if (!editor) {
        return new vscode_1.Position(0, 0);
    }
    if (location === TsImportOptions_1.ImportLocation.TopOfFile) {
        return editor.document.lineAt(0).text.match(/use strict/) ? new vscode_1.Position(1, 0) : new vscode_1.Position(0, 0);
    }
    return new vscode_1.Position(editor.selection.active.line, 0);
}
exports.getImportInsertPosition = getImportInsertPosition;
/**
 * Calculates a list of declarationInfos filtered by the already imported ones in the given document.
 * The result is a list of declarations that are not already imported by the document.
 *
 * @export
 * @param {ResolveIndex} resolveIndex
 * @param {string} documentPath
 * @param {TsImport[]} imports
 * @returns {DeclarationInfo[]}
 */
function getDeclarationsFilteredByImports(resolveIndex, documentPath, imports) {
    let declarations = resolveIndex.declarationInfos;
    for (let tsImport of imports) {
        let importedLib = getAbsolutLibraryName(tsImport.libraryName, documentPath);
        if (tsImport instanceof TsImport_1.TsNamedImport) {
            declarations = declarations
                .filter(o => o.from !== importedLib || !tsImport.specifiers
                .some(s => s.specifier === o.declaration.name));
        }
        else if (tsImport instanceof TsImport_1.TsNamespaceImport || tsImport instanceof TsImport_1.TsExternalModuleImport) {
            declarations = declarations.filter(o => o.from !== tsImport.libraryName);
        }
        else if (tsImport instanceof TsImport_1.TsDefaultImport) {
            declarations = declarations
                .filter(o => (!(o.declaration instanceof TsDeclaration_1.DefaultDeclaration) || importedLib !== o.from));
        }
    }
    return declarations;
}
exports.getDeclarationsFilteredByImports = getDeclarationsFilteredByImports;
/**
 * Returns the absolut workspace specific library path.
 * If the library is a node module or a typings module, the name
 * is returned. If the "lib" is in the local workspace, then the
 * absolut path from the workspace root is returned.
 *
 * @param {string} library - Name of the library
 * @param {string} actualFilePath - Filepath of the actually open file
 * @returns {string} - Absolut path from the workspace root to the desired library
 */
function getAbsolutLibraryName(library, actualFilePath) {
    if (!library.startsWith('.')) {
        return library;
    }
    let relative = '/' + vscode_1.workspace.asRelativePath(path_1.normalize(path_1.join(path_1.parse(actualFilePath).dir, library))).replace(/[/]$/g, '');
    return relative;
}
exports.getAbsolutLibraryName = getAbsolutLibraryName;
/**
 * Returns the relative path to a specific library.
 * If the library is a node module or a typings module, the name
 * is returned. If the "lib" is in the local workspace, then the
 * relative path from the actual file is returned.
 *
 * @param {string} library - Name of the library
 * @param {string} actualFilePath - Filepath of the actually open file
 * @returns {string} - Relative path from the actual file to the library
 */
function getRelativeLibraryName(library, actualFilePath) {
    if (!library.startsWith('/')) {
        return library;
    }
    let actualDir = path_1.parse('/' + vscode_1.workspace.asRelativePath(actualFilePath)).dir, relativePath = path_1.relative(actualDir, library);
    if (!relativePath.startsWith('.')) {
        relativePath = './' + relativePath;
    }
    else if (relativePath === '..') {
        relativePath += '/';
    }
    relativePath = relativePath.replace(/\\/g, '/');
    return relativePath;
}
exports.getRelativeLibraryName = getRelativeLibraryName;
