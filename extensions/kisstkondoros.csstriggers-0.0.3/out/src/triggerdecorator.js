/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
var vscode_1 = require('vscode');
var vscode_languageclient_1 = require('vscode-languageclient');
function activateColorDecorations(decoratorProvider, supportedLanguages) {
    var disposables = [];
    var composite = vscode_1.window.createTextEditorDecorationType({
        before: {
            contentText: '\u29BF',
            color: '#455f15',
            margin: "4px"
        }
    });
    var compositeAndPaint = vscode_1.window.createTextEditorDecorationType({
        before: {
            contentText: '\u29BF',
            color: '#90aa65',
            margin: "4px"
        }
    });
    var compositePaintAndLayout = vscode_1.window.createTextEditorDecorationType({
        before: {
            contentText: '\u29BF',
            color: '#9089e4',
            margin: "4px"
        }
    });
    disposables.push(composite);
    disposables.push(compositeAndPaint);
    disposables.push(compositePaintAndLayout);
    var pendingUpdateRequests = {};
    // we care about all visible editors
    vscode_1.window.visibleTextEditors.forEach(function (editor) {
        if (editor.document) {
            triggerUpdateDecorations(editor.document);
        }
    });
    // to get visible one has to become active
    vscode_1.window.onDidChangeActiveTextEditor(function (editor) {
        if (editor) {
            triggerUpdateDecorations(editor.document);
        }
    }, null, disposables);
    vscode_1.workspace.onDidChangeTextDocument(function (event) { return triggerUpdateDecorations(event.document); }, null, disposables);
    vscode_1.workspace.onDidOpenTextDocument(triggerUpdateDecorations, null, disposables);
    vscode_1.workspace.onDidCloseTextDocument(triggerUpdateDecorations, null, disposables);
    function triggerUpdateDecorations(document) {
        var triggerUpdate = supportedLanguages[document.languageId];
        var uri = document.uri.toString();
        var timeout = pendingUpdateRequests[uri];
        if (typeof timeout !== 'undefined') {
            clearTimeout(timeout);
            triggerUpdate = true; // force update, even if languageId is not supported (anymore)
        }
        if (triggerUpdate) {
            pendingUpdateRequests[uri] = setTimeout(function () {
                updateDecorations(uri);
                delete pendingUpdateRequests[uri];
            }, 500);
        }
    }
    function updateDecorations(uri) {
        vscode_1.window.visibleTextEditors.forEach(function (editor) {
            var document = editor.document;
            if (document && document.uri.toString() === uri) {
                updateDecorationForEditor(editor);
            }
        });
    }
    function updateDecorationForEditor(editor) {
        var document = editor.document;
        if (supportedLanguages[document.languageId]) {
            decoratorProvider(document.uri.toString()).then(function (symbolResponse) {
                var mapper = function (symbol) {
                    var range = vscode_languageclient_1.Protocol2Code.asRange(symbol.range);
                    var color = document.getText(range);
                    return {
                        range: range,
                        hoverMessage: symbol.hoverMessage
                    };
                };
                editor.setDecorations(composite, symbolResponse.composite.map(mapper));
                editor.setDecorations(compositeAndPaint, symbolResponse.paint.map(mapper));
                editor.setDecorations(compositePaintAndLayout, symbolResponse.layout.map(mapper));
            });
        }
        else {
            editor.setDecorations(composite, []);
            editor.setDecorations(compositeAndPaint, []);
            editor.setDecorations(compositePaintAndLayout, []);
        }
    }
    return vscode_1.Disposable.from.apply(vscode_1.Disposable, disposables);
}
exports.activateColorDecorations = activateColorDecorations;
//# sourceMappingURL=triggerdecorator.js.map