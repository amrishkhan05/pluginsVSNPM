"use strict";
var vscode = require('vscode');
var ns = require('./services/NsCliService');
var ExtensionVersionInfo_1 = require('./services/ExtensionVersionInfo');
var AnalyticsService_1 = require('./services/analytics/AnalyticsService');
var ExtensionServer_1 = require('./services/ipc/ExtensionServer');
function performVersionsCheck(context) {
    // Check the state of the existing NativeScript CLI
    var cliInfo = new ns.CliVersionInfo();
    if (cliInfo.getErrorMessage() !== null) {
        vscode.window.showErrorMessage(cliInfo.getErrorMessage());
    }
    else {
        // Checks whether a new version of the extension is available
        var extensionVersionPromise = null;
        // Check the cache for extension version information
        var extensionVersion = context.globalState.get('ExtensionVersionInfo');
        if (extensionVersion) {
            var extensionVersionInfo = new ExtensionVersionInfo_1.ExtensionVersionInfo(extensionVersion.latestVersionMetadata, extensionVersion.timestamp);
            if (extensionVersionInfo.getTimestamp() > Date.now() - 24 * 60 * 60 * 1000 /* Cache the version for a day */) {
                extensionVersionPromise = Promise.resolve(extensionVersionInfo);
            }
        }
        if (!extensionVersionPromise) {
            // Takes the slow path and checks for newer version in the VS Code Marketplace
            extensionVersionPromise = ExtensionVersionInfo_1.ExtensionVersionInfo.createFromMarketplace();
        }
        extensionVersionPromise.then(function (extensionInfo) {
            if (extensionInfo) {
                context.globalState.update('ExtensionVersionInfo', { latestVersionMetadata: extensionInfo.getLatestVersionMeta(), timestamp: extensionInfo.getTimestamp() }); // save in cache
                if (!extensionInfo.isLatest()) {
                    vscode.window.showWarningMessage("A new version of the NativeScript extension is available. Run \"Extensions: Show Outdated Extensions\" command and select \"NativeScript\" to update to v" + extensionInfo.getLatestVersionMeta().version + ".");
                }
            }
        }, function (error) { });
    }
}
// this method is called when the extension is activated
function activate(context) {
    ExtensionServer_1.ExtensionServer.getInstance().start();
    performVersionsCheck(context);
    var runCommand = function (project) {
        if (vscode.workspace.rootPath === undefined) {
            vscode.window.showErrorMessage('No workspace opened.');
            return;
        }
        // Show output channel
        var runChannel = vscode.window.createOutputChannel("Run on " + project.platform());
        runChannel.clear();
        runChannel.show(vscode.ViewColumn.Two);
        AnalyticsService_1.AnalyticsService.getInstance().runRunCommand(project.platform());
        return project.run()
            .then(function (tnsProcess) {
            tnsProcess.on('error', function (err) {
                vscode.window.showErrorMessage('Unexpected error executing NativeScript Run command.');
            });
            tnsProcess.stderr.on('data', function (data) {
                runChannel.append(data.toString());
            });
            tnsProcess.stdout.on('data', function (data) {
                runChannel.append(data.toString());
            });
            tnsProcess.on('exit', function (exitCode) {
                tnsProcess.stdout.removeAllListeners('data');
                tnsProcess.stderr.removeAllListeners('data');
            });
            tnsProcess.on('close', function (exitCode) {
                runChannel.hide();
            });
        });
    };
    var runIosCommand = vscode.commands.registerCommand('nativescript.runIos', function () {
        return runCommand(new ns.IosProject(vscode.workspace.rootPath));
    });
    var runAndroidCommand = vscode.commands.registerCommand('nativescript.runAndroid', function () {
        return runCommand(new ns.AndroidProject(vscode.workspace.rootPath));
    });
    context.subscriptions.push(runIosCommand);
    context.subscriptions.push(runAndroidCommand);
}
exports.activate = activate;
function deactivate() {
    ExtensionServer_1.ExtensionServer.getInstance().stop();
}
exports.deactivate = deactivate;
//# sourceMappingURL=main.js.map