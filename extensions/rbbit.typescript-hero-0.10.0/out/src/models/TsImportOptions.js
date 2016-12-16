"use strict";
/**
 * Where a new import should be located.
 *
 * @export
 * @enum {number}
 */
(function (ImportLocation) {
    ImportLocation[ImportLocation["TopOfFile"] = 0] = "TopOfFile";
    ImportLocation[ImportLocation["AtCursorLocation"] = 1] = "AtCursorLocation";
})(exports.ImportLocation || (exports.ImportLocation = {}));
var ImportLocation = exports.ImportLocation;
