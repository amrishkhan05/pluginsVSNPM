/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';
var vscode_languageserver_1 = require('vscode-languageserver');
var cssLint = require('csslint').CSSLint;
// Create a connection for the server. The connection uses 
// stdin / stdout for message passing
var connection = vscode_languageserver_1.createConnection(new vscode_languageserver_1.IPCMessageReader(process), new vscode_languageserver_1.IPCMessageWriter(process));
// Create a simple text document manager. The text document manager
// supports full document sync only
var documents = new vscode_languageserver_1.TextDocuments();
// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);
// After the server has started the client sends an initilize request. The server receives
// in the passed params the rootPath of the workspace plus the client capabilites. 
var workspaceRoot;
connection.onInitialize(function (params) {
    workspaceRoot = params.rootPath;
    return {
        capabilities: {
            // Tell the client that the server works in FULL text document sync mode
            textDocumentSync: documents.syncKind,
            // Tell the client that the server support code complete
            completionProvider: {
                resolveProvider: true
            }
        }
    };
});
// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(function (change) {
    validateTextDocument(change.document);
});
// hold the maxNumberOfProblems setting
var maxNumberOfProblems;
// The settings have changed. Is send on server activation
// as well.
connection.onDidChangeConfiguration(function (change) {
    var settings = change.settings;
    maxNumberOfProblems = settings.languageServerExample.maxNumberOfProblems || 100;
    // Revalidate any open text documents
    documents.all().forEach(validateTextDocument);
});
function validateTextDocument(textDocument) {
    var diagnostics = [];
    var text = textDocument.getText();
    var issues = cssLint.verify(text);
    //connection.console.log(issues);
    for (var i = 0; i < issues.messages.length; i++) {
        var issue = issues.messages[i];
        var severity;
        if (issue.type === "warning") {
            severity = vscode_languageserver_1.DiagnosticSeverity.Warning;
        }
        else {
            severity = vscode_languageserver_1.DiagnosticSeverity.Error;
        }
        diagnostics.push({
            severity: severity,
            range: {
                start: { line: issue.line - 1, character: issue.col - 1 },
                end: { line: issue.line - 1, character: issue.col - 1 }
            },
            message: issue.message
        });
    }
    // Send the computed diagnostics to VSCode.
    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics: diagnostics });
}
connection.onDidChangeWatchedFiles(function (change) {
    // Monitored files have change in VSCode
    connection.console.log('We recevied an file change event');
});
// Listen on the connection
connection.listen();
//# sourceMappingURL=server.js.map