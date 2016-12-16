"use strict";
var os = require('os');
/**
 * Google Universal Analytics Service
 */
// Hack needed for the Telerik Analytics JavaScript monitor to work in node environment
global.XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
global.XMLHttpRequest.prototype.withCredentials = false;
function capitalizeFirstLetter(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}
var TelerikAnalyticsService = (function () {
    function TelerikAnalyticsService(projectKey, baseInfo) {
        var _this = this;
        require("./EqatecMonitor.min");
        var eqatec = global._eqatec;
        var settings = eqatec.createSettings(projectKey);
        settings.useHttps = false;
        settings.userAgent = TelerikAnalyticsService.getUserAgentString();
        settings.version = baseInfo.extensionVersion;
        settings.useCookies = false;
        /*
        settings.loggingInterface = {
            logMessage: console.log,
            logError: console.log
        };
        */
        //settings.testMode = true;
        this._eqatecMonitor = eqatec.createMonitor(settings);
        this._eqatecMonitor.setInstallationID(baseInfo.userId);
        this._eqatecMonitor.setUserID(baseInfo.userId);
        this._eqatecMonitor.start();
        process.on('exit', function () {
            _this._eqatecMonitor.stop();
        });
        this._eqatecMonitor.trackFeature("CLIVersion." + baseInfo.cliVersion);
        this._eqatecMonitor.trackFeature("ExtensionVersion." + baseInfo.extensionVersion);
    }
    TelerikAnalyticsService.getUserAgentString = function () {
        var userAgentString;
        var osType = os.type();
        if (osType === "Windows_NT") {
            userAgentString = "(Windows NT " + os.release() + ")";
        }
        else if (osType === "Darwin") {
            userAgentString = "(Mac OS X " + os.release() + ")";
        }
        else {
            userAgentString = "(" + osType + ")";
        }
        return userAgentString;
    };
    TelerikAnalyticsService.prototype.launchDebugger = function (request, platform) {
        this._eqatecMonitor.trackFeature(capitalizeFirstLetter(request) + "." + capitalizeFirstLetter(platform));
        return Promise.resolve();
    };
    TelerikAnalyticsService.prototype.runRunCommand = function (platform) {
        this._eqatecMonitor.trackFeature("Run." + capitalizeFirstLetter(platform));
        return Promise.resolve();
    };
    return TelerikAnalyticsService;
}());
exports.TelerikAnalyticsService = TelerikAnalyticsService;
//# sourceMappingURL=TelerikAnalyticsService.js.map