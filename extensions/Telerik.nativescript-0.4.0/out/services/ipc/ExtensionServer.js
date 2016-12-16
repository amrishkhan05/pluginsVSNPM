"use strict";
var path = require('path');
var os = require('os');
var crypto = require('crypto');
var vscode = require('vscode');
var AnalyticsService_1 = require('../analytics/AnalyticsService');
var ipc = require('node-ipc');
var ExtensionServer = (function () {
    function ExtensionServer() {
        this._isRunning = false;
    }
    ExtensionServer.getInstance = function () {
        if (!this._instance) {
            this._instance = new ExtensionServer();
        }
        return this._instance;
    };
    ExtensionServer.getTempFilePathForDirectory = function (directoryPath) {
        var fileName = 'vsc-ns-ext-' + crypto.createHash('md5').update(directoryPath).digest("hex") + '.sock';
        return path.join(os.tmpdir(), fileName);
    };
    ExtensionServer.prototype.getPipeHandlePath = function () {
        return vscode.workspace.rootPath ?
            ExtensionServer.getTempFilePathForDirectory(vscode.workspace.rootPath) :
            null;
    };
    ExtensionServer.prototype.start = function () {
        var _this = this;
        if (!this._isRunning) {
            var pipeHandlePath = this.getPipeHandlePath();
            if (pipeHandlePath) {
                ipc.serve(pipeHandlePath, function () {
                    ipc.server.on('extension-protocol-message', function (data, socket) {
                        return _this[data.method].call(_this, data.args).then(function (result) {
                            var response = { requestId: data.id, result: result };
                            return ipc.server.emit(socket, 'extension-protocol-message', response);
                        });
                    });
                });
                ipc.server.start();
                this._isRunning = true;
            }
        }
        return this._isRunning;
    };
    ExtensionServer.prototype.stop = function () {
        if (this._isRunning) {
            ipc.server.stop();
            this._isRunning = false;
        }
    };
    ExtensionServer.prototype.isRunning = function () {
        return this._isRunning;
    };
    ExtensionServer.prototype.analyticsLaunchDebugger = function (args) {
        return AnalyticsService_1.AnalyticsService.getInstance().launchDebugger(args.request, args.platform);
    };
    ExtensionServer.prototype.runRunCommand = function (args) {
        return AnalyticsService_1.AnalyticsService.getInstance().runRunCommand(args.platform);
    };
    return ExtensionServer;
}());
exports.ExtensionServer = ExtensionServer;
//# sourceMappingURL=ExtensionServer.js.map