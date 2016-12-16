/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';
var vscode_languageserver_1 = require('vscode-languageserver');
var csstriggers_1 = require('./csstriggers');
var protocol_1 = require('../common/protocol');
csstriggers_1.cssTriggers.data["margin"] = csstriggers_1.cssTriggers.data["margin-left"];
csstriggers_1.cssTriggers.data["padding"] = csstriggers_1.cssTriggers.data["padding-left"];
csstriggers_1.cssTriggers.data["border"] = csstriggers_1.cssTriggers.data["border-left-width"];
csstriggers_1.cssTriggers.data["border-radius"] = csstriggers_1.cssTriggers.data["border"];
csstriggers_1.cssTriggers.data["border-color"] = csstriggers_1.cssTriggers.data["border-left-color"];
csstriggers_1.cssTriggers.data["border-style"] = csstriggers_1.cssTriggers.data["border-left-style"];
csstriggers_1.cssTriggers.data["border-width"] = csstriggers_1.cssTriggers.data["border-left-width"];
csstriggers_1.cssTriggers.data["outline"] = csstriggers_1.cssTriggers.data["outline-width"];
csstriggers_1.cssTriggers.data["overflow"] = csstriggers_1.cssTriggers.data["overflow-x"];
csstriggers_1.cssTriggers.data["background"] = csstriggers_1.cssTriggers.data["background-color"];
var connection = vscode_languageserver_1.createConnection(new vscode_languageserver_1.IPCMessageReader(process), new vscode_languageserver_1.IPCMessageWriter(process));
console.log = connection.console.log.bind(connection.console);
console.error = connection.console.error.bind(connection.console);
var documents = new vscode_languageserver_1.TextDocuments();
documents.listen(connection);
connection.onInitialize(function (params) {
    return {
        capabilities: {
            textDocumentSync: documents.syncKind,
        }
    };
});
connection.onRequest(protocol_1.CssTriggerSymbolRequestType, function (uri) {
    console.log("Document requested" + uri);
    var document = documents.get(uri);
    return decorateCssProperties(document);
});
function decorateCssProperties(document) {
    var supportedExtensions = ["css", "less", "sass", "scss"];
    var result = {
        composite: [],
        layout: [],
        paint: []
    };
    var diagnostics = [];
    if (!document || supportedExtensions.indexOf(document.languageId) == -1) {
        return;
    }
    var text = document.getText();
    var match;
    var regex = /([\-\w])*\s*:/g;
    while (match = regex.exec(text)) {
        var capturingGroup = match[0].substr(0, match[0].length - 1).trim();
        var trigger = csstriggers_1.cssTriggers.data[capturingGroup];
        if (trigger) {
            var change = trigger.change.blink;
            var index = match.index;
            var start = document.positionAt(index);
            var end = document.positionAt(index + capturingGroup.length);
            var hoverMessage = "Subsequent updates will cause: ";
            var causes = [];
            if (change.composite) {
                causes.push("composite");
            }
            if (change.paint) {
                causes.push("paint");
            }
            if (change.layout) {
                causes.push("layout");
            }
            hoverMessage += causes.join(", ");
            var decoration = { range: { start: start, end: end }, hoverMessage: hoverMessage };
            if (change.layout) {
                result.layout.push(decoration);
            }
            else if (change.paint) {
                result.paint.push(decoration);
            }
            else if (change.composite) {
                result.composite.push(decoration);
            }
        }
    }
    return result;
}
connection.listen();
//# sourceMappingURL=server.js.map