"use strict";
var Version_1 = require('../common/Version');
var https = require('https');
var ExtensionVersionInfo = (function () {
    function ExtensionVersionInfo(latestVersionMeta, timestamp) {
        this.latestVersionMeta = latestVersionMeta;
        this.timestamp = timestamp || Date.now();
    }
    ExtensionVersionInfo.initVersionsFromPackageJson = function () {
        var packageJson = require('../../package.json');
        this.extensionVersion = Version_1.Version.parse(packageJson.version);
        this.minNativescriptCliVersion = Version_1.Version.parse(packageJson.minNativescriptCliVersion);
    };
    ExtensionVersionInfo.getExtensionVersion = function () {
        if (this.extensionVersion === null) {
            this.initVersionsFromPackageJson();
        }
        return this.extensionVersion;
    };
    ExtensionVersionInfo.getMinSupportedNativeScriptVersion = function () {
        if (this.minNativescriptCliVersion === null) {
            this.initVersionsFromPackageJson();
        }
        return this.minNativescriptCliVersion;
    };
    ExtensionVersionInfo.getMarketplaceExtensionData = function () {
        if (this.marketplaceQueryResult == null) {
            this.marketplaceQueryResult = new Promise(function (resolve, reject) {
                var postData = "{ filters: [{ criteria: [{ filterType: 4, value: \"" + ExtensionVersionInfo.extensionId + "\" }] }], flags: 262 }";
                var request = https.request({
                    hostname: 'marketplace.visualstudio.com',
                    path: '/_apis/public/gallery/extensionquery',
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json;api-version=2.2-preview.1',
                        'Content-Type': 'application/json',
                        'Transfer-Encoding': 'chunked',
                        'Content-Length': Buffer.byteLength(postData)
                    }
                }, function (response) {
                    if (response.statusCode != 200) {
                        reject("Unable to download data from Visual Studio Marketplace. Status code: " + response.statusCode);
                        return;
                    }
                    var body = '';
                    response.on('data', function (chunk) {
                        body += chunk;
                    });
                    response.on('end', function () {
                        resolve(JSON.parse(body));
                    });
                });
                request.on('error', function (e) {
                    reject(e);
                });
                request.end(postData);
            });
        }
        return this.marketplaceQueryResult;
    };
    ExtensionVersionInfo.createFromMarketplace = function () {
        return this.getMarketplaceExtensionData()
            .then(function (marketplaceData) {
            var latestVersion = null;
            try {
                if (marketplaceData.results[0].extensions[0].extensionId == ExtensionVersionInfo.extensionId) {
                    latestVersion = marketplaceData.results[0].extensions[0].versions[0];
                }
            }
            catch (e) { }
            return new ExtensionVersionInfo(latestVersion);
        });
    };
    ExtensionVersionInfo.prototype.getLatestVersionMeta = function () {
        return this.latestVersionMeta;
    };
    ExtensionVersionInfo.prototype.isLatest = function () {
        if (!this.getLatestVersionMeta()) {
            return true;
        }
        return Version_1.Version.compareBySubminor(ExtensionVersionInfo.getExtensionVersion(), Version_1.Version.parse(this.getLatestVersionMeta().version)) >= 0;
    };
    ExtensionVersionInfo.prototype.getTimestamp = function () {
        return this.timestamp;
    };
    ExtensionVersionInfo.extensionVersion = null;
    ExtensionVersionInfo.minNativescriptCliVersion = null;
    ExtensionVersionInfo.extensionId = '8d837914-d8fa-45b5-965d-f76ebd6dbf5c';
    ExtensionVersionInfo.marketplaceQueryResult = null;
    return ExtensionVersionInfo;
}());
exports.ExtensionVersionInfo = ExtensionVersionInfo;
//# sourceMappingURL=ExtensionVersionInfo.js.map