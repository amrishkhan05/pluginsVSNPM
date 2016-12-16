"use strict";
var os = require('os');
var vscode = require('vscode');
var Version_1 = require('../../common/Version');
var GUAService_1 = require('./GUAService');
var TelerikAnalyticsService_1 = require('./TelerikAnalyticsService');
var AnalyticsBaseInfo_1 = require('./AnalyticsBaseInfo');
var ExtensionVersionInfo_1 = require('../ExtensionVersionInfo');
var ns = require('../NsCliService');
var AnalyticsService = (function () {
    function AnalyticsService() {
        this._analyticsEnabled = vscode.workspace.getConfiguration('nativescript').get('analytics.enabled');
        var operatingSystem = AnalyticsBaseInfo_1.OperatingSystem.Other;
        switch (process.platform) {
            case 'win32': {
                operatingSystem = AnalyticsBaseInfo_1.OperatingSystem.Windows;
                break;
            }
            case 'darwin': {
                operatingSystem = AnalyticsBaseInfo_1.OperatingSystem.OSX;
                break;
            }
            case 'linux':
            case 'freebsd': {
                operatingSystem = AnalyticsBaseInfo_1.OperatingSystem.Linux;
                break;
            }
        }
        ;
        this._baseInfo = {
            cliVersion: Version_1.Version.stringify(ns.CliVersionInfo.getInstalledCliVersion()),
            extensionVersion: Version_1.Version.stringify(ExtensionVersionInfo_1.ExtensionVersionInfo.getExtensionVersion()),
            operatingSystem: operatingSystem,
            userId: AnalyticsService.generateMachineId()
        };
        if (this._analyticsEnabled) {
            this._gua = new GUAService_1.GUAService('UA-111455-29', this._baseInfo);
            this._ta = new TelerikAnalyticsService_1.TelerikAnalyticsService('b8b2e51f188f43e9b0dfb899f7b71cc6', this._baseInfo);
        }
    }
    AnalyticsService.getInstance = function () {
        if (!this._instance) {
            this._instance = new AnalyticsService();
        }
        return this._instance;
    };
    AnalyticsService.generateMachineId = function () {
        var machineId = '';
        try {
            var netInterfaces_1 = os.networkInterfaces();
            Object.keys(netInterfaces_1).forEach(function (interfName) {
                netInterfaces_1[interfName].forEach(function (interf) {
                    if (!interf.internal) {
                        machineId += interf.mac + "-";
                    }
                });
            });
        }
        catch (e) { }
        return machineId;
    };
    AnalyticsService.prototype.launchDebugger = function (request, platform) {
        if (this._analyticsEnabled) {
            try {
                return Promise.all([
                    this._gua.launchDebugger(request, platform),
                    this._ta.launchDebugger(request, platform)
                ]);
            }
            catch (e) { }
        }
        return Promise.resolve();
    };
    AnalyticsService.prototype.runRunCommand = function (platform) {
        if (this._analyticsEnabled) {
            try {
                return Promise.all([
                    this._gua.runRunCommand(platform),
                    this._ta.runRunCommand(platform)
                ]);
            }
            catch (e) { }
        }
        return Promise.resolve();
    };
    return AnalyticsService;
}());
exports.AnalyticsService = AnalyticsService;
//# sourceMappingURL=AnalyticsService.js.map