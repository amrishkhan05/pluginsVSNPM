"use strict";
var Version = (function () {
    function Version() {
    }
    Version.parse = function (versionStr) {
        if (versionStr === null) {
            return null;
        }
        var version = versionStr.split('.').map(function (str, index, array) { return parseInt(str); });
        for (var i = version.length; i < 3; i++) {
            version.push(0);
        }
        return version;
    };
    Version.stringify = function (version) {
        return version[0] + "." + version[1] + "." + version[2];
    };
    Version.compareBySubminor = function (v1, v2) {
        return (v1[0] - v2[0] != 0) ? (v1[0] - v2[0]) : (v1[1] - v2[1] != 0) ? v1[1] - v2[1] : v1[2] - v2[2];
    };
    return Version;
}());
exports.Version = Version;
//# sourceMappingURL=Version.js.map