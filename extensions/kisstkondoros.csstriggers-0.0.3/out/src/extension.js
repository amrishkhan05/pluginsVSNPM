'use strict';
var vscode = require('vscode');
var path = require('path');
var vscode_languageclient_1 = require('vscode-languageclient');
var triggerdecorator_1 = require('./triggerdecorator');
var protocol_1 = require('./common/protocol');
function activate(context) {
    var serverModule = context.asAbsolutePath(path.join('out', 'src', 'server', 'server.js'));
    var debugOptions = { execArgv: ["--nolazy", "--debug=6004"] };
    var serverOptions = {
        run: { module: serverModule, transport: vscode_languageclient_1.TransportKind.ipc },
        debug: { module: serverModule, transport: vscode_languageclient_1.TransportKind.ipc, options: debugOptions }
    };
    var output = vscode.window.createOutputChannel("CssTrigger");
    var error = function (error, message, count) {
        output.appendLine(message.jsonrpc);
        return undefined;
    };
    var clientOptions = {
        documentSelector: ["css", "less", "scss"],
        errorHandler: {
            error: error,
            closed: function () {
                return undefined;
            }
        },
        synchronize: {
            configurationSection: 'csstriggers',
        }
    };
    var client = new vscode_languageclient_1.LanguageClient('CssTrigger parser', serverOptions, clientOptions);
    var disposable = client.start();
    context.subscriptions.push(disposable);
    var triggerRequestor = function (uri) {
        return client.sendRequest(protocol_1.CssTriggerSymbolRequestType, uri);
    };
    disposable = triggerdecorator_1.activateColorDecorations(triggerRequestor, { css: true, scss: true, less: true });
    context.subscriptions.push(disposable);
}
exports.activate = activate;
//# sourceMappingURL=extension.js.map