"use strict";
var ua = require('universal-analytics');
var AnalyticsBaseInfo_1 = require('./AnalyticsBaseInfo');
/**
 * Google Universal Analytics Service
 */
var GUAService = (function () {
    function GUAService(trackingId, baseInfo) {
        this._visitor = ua(trackingId, baseInfo.userId, { requestOptions: {}, strictCidFormat: false });
        this._getBasePayload = function () {
            return {
                uid: baseInfo.userId,
                dh: 'ns-vs-extension.org',
                cd5: baseInfo.cliVersion,
                cd6: AnalyticsBaseInfo_1.OperatingSystem[baseInfo.operatingSystem],
                cd7: baseInfo.extensionVersion
            };
        };
    }
    GUAService.prototype.launchDebugger = function (request, platform) {
        var payload = this._getBasePayload();
        payload.ec = 'vscode-extension-debug'; // event category
        payload.ea = "debug-" + request + "-on-" + platform; // event action
        return this.sendEvent(payload);
    };
    GUAService.prototype.runRunCommand = function (platform) {
        var payload = this._getBasePayload();
        payload.ec = 'vscode-extension-command'; // event category
        payload.ea = "command-run-on-" + platform; // event action
        return this.sendEvent(payload);
    };
    GUAService.prototype.sendEvent = function (params) {
        var _this = this;
        return new Promise(function (res, rej) {
            _this._visitor.event(params, function (err) {
                return err ? rej(err) : res();
            });
        });
    };
    return GUAService;
}());
exports.GUAService = GUAService;
//# sourceMappingURL=GUAService.js.map