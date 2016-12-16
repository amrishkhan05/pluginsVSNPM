"use strict";
var path = require('path');
var os = require('os');
var crypto = require('crypto');
var ipc = require('node-ipc');
var ExtensionClient = (function () {
    function ExtensionClient() {
        var _this = this;
        this._idCounter = 0;
        if (!ExtensionClient.getAppRoot()) {
            throw new Error("Unable to connect to extension host. App root is '" + ExtensionClient.getAppRoot() + "'");
        }
        this._idCounter = 0;
        this._pendingRequests = {};
        ipc.config.id = 'debug-adpater-' + process.pid;
        ipc.config.retry = 1500;
        this._ipcClientInitialized = new Promise(function (res, rej) {
            ipc.connectTo('extHost', ExtensionClient.getTempFilePathForDirectory(ExtensionClient.getAppRoot()), function () {
                ipc.of.extHost.on('connect', function () {
                    res();
                });
                ipc.of.extHost.on('extension-protocol-message', function (response) {
                    _this._pendingRequests[response.requestId](response.result);
                });
            });
        });
    }
    ExtensionClient.getInstance = function () {
        if (!this._instance) {
            this._instance = new ExtensionClient();
        }
        return this._instance;
    };
    ExtensionClient.getAppRoot = function () {
        return this._appRoot;
    };
    ExtensionClient.getTempFilePathForDirectory = function (directoryPath) {
        var fileName = 'vsc-ns-ext-' + crypto.createHash('md5').update(directoryPath).digest("hex") + '.sock';
        return path.join(os.tmpdir(), fileName);
    };
    ExtensionClient.setAppRoot = function (appRoot) {
        this._appRoot = appRoot;
    };
    ExtensionClient.prototype.callRemoteMethod = function (method, args) {
        var _this = this;
        var request = { id: 'req' + (++this._idCounter), method: method, args: args };
        return new Promise(function (res, rej) {
            _this._pendingRequests[request.id] = res;
            ipc.of.extHost.emit('extension-protocol-message', request);
        });
    };
    ExtensionClient.prototype.analyticsLaunchDebugger = function (args) {
        return this.callRemoteMethod('analyticsLaunchDebugger', args);
    };
    ExtensionClient.prototype.runRunCommand = function (args) {
        return this.callRemoteMethod('runRunCommand', args);
    };
    return ExtensionClient;
}());
exports.ExtensionClient = ExtensionClient;
//# sourceMappingURL=ExtensionClient.js.map