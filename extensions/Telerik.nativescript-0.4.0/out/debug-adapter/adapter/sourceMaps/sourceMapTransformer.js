/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
"use strict";
var path = require('path');
var sourceMaps_1 = require('./sourceMaps');
var utils = require('../../utilities');
/**
 * If sourcemaps are enabled, converts from source files on the client side to runtime files on the target side
 */
var SourceMapTransformer = (function () {
    function SourceMapTransformer() {
        this._pendingBreakpointsByPath = new Map();
    }
    SourceMapTransformer.prototype.launch = function (args) {
        this.init(args);
    };
    SourceMapTransformer.prototype.attach = function (args) {
        this.init(args);
    };
    SourceMapTransformer.prototype.init = function (args) {
        if (args.sourceMaps) {
            this._webRoot = utils.getAppRoot(args);
            this._sourceMaps = new sourceMaps_1.SourceMaps(this._webRoot);
            this._requestSeqToSetBreakpointsArgs = new Map();
            this._allRuntimeScriptPaths = new Set();
            this._authoredPathsToMappedBPLines = new Map();
            this._authoredPathsToMappedBPCols = new Map();
        }
    };
    SourceMapTransformer.prototype.clearTargetContext = function () {
        this._allRuntimeScriptPaths = new Set();
    };
    /**
     * Apply sourcemapping to the setBreakpoints request path/lines
     */
    SourceMapTransformer.prototype.setBreakpoints = function (args, requestSeq) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            if (_this._sourceMaps && args.source.path && path.extname(args.source.path) !== ".js") {
                var argsPath_1 = args.source.path;
                var mappedPath_1 = _this._sourceMaps.MapPathFromSource(argsPath_1);
                if (mappedPath_1) {
                    utils.Logger.log("SourceMaps.setBP: Mapped " + argsPath_1 + " to " + mappedPath_1);
                    args.authoredPath = argsPath_1;
                    args.source.path = mappedPath_1;
                    // DebugProtocol doesn't send cols, but they need to be added from sourcemaps
                    var mappedCols_1 = [];
                    var mappedLines = args.lines.map(function (line, i) {
                        var mapped = _this._sourceMaps.MapFromSource(argsPath_1, line, /*column=*/ 0);
                        if (mapped) {
                            utils.Logger.log("SourceMaps.setBP: Mapped " + argsPath_1 + ":" + line + ":0 to " + mappedPath_1 + ":" + mapped.line + ":" + mapped.column);
                            mappedCols_1[i] = mapped.column;
                            return mapped.line;
                        }
                        else {
                            utils.Logger.log("SourceMaps.setBP: Mapped " + argsPath_1 + " but not line " + line + ", column 0");
                            mappedCols_1[i] = 0;
                            return line;
                        }
                    });
                    _this._authoredPathsToMappedBPLines.set(argsPath_1, mappedLines);
                    _this._authoredPathsToMappedBPCols.set(argsPath_1, mappedCols_1);
                    // Include BPs from other files that map to the same file. Ensure the current file's breakpoints go first
                    args.lines = mappedLines;
                    args.cols = mappedCols_1;
                    _this._sourceMaps.AllMappedSources(mappedPath_1).forEach(function (sourcePath) {
                        if (sourcePath === argsPath_1) {
                            return;
                        }
                        var sourceBPLines = _this._authoredPathsToMappedBPLines.get(sourcePath);
                        var sourceBPCols = _this._authoredPathsToMappedBPCols.get(sourcePath);
                        if (sourceBPLines && sourceBPCols) {
                            // Don't modify the cached array
                            args.lines = args.lines.concat(sourceBPLines);
                            args.cols = args.cols.concat(sourceBPCols);
                        }
                    });
                }
                else if (_this._allRuntimeScriptPaths.has(argsPath_1)) {
                    // It's a generated file which is loaded
                    utils.Logger.log("SourceMaps.setBP: SourceMaps are enabled but " + argsPath_1 + " is a runtime script");
                }
                else {
                    // Source (or generated) file which is not loaded, need to wait
                    utils.Logger.log("SourceMaps.setBP: " + argsPath_1 + " can't be resolved to a loaded script.");
                    _this._pendingBreakpointsByPath.set(argsPath_1, { resolve: resolve, reject: reject, args: args, requestSeq: requestSeq });
                    return;
                }
                _this._requestSeqToSetBreakpointsArgs.set(requestSeq, JSON.parse(JSON.stringify(args)));
                resolve();
            }
            else {
                resolve();
            }
        });
    };
    /**
     * Apply sourcemapping back to authored files from the response
     */
    SourceMapTransformer.prototype.setBreakpointsResponse = function (response, requestSeq) {
        var _this = this;
        if (this._sourceMaps && this._requestSeqToSetBreakpointsArgs.has(requestSeq)) {
            var args_1 = this._requestSeqToSetBreakpointsArgs.get(requestSeq);
            if (args_1.authoredPath) {
                var sourceBPLines_1 = this._authoredPathsToMappedBPLines.get(args_1.authoredPath);
                if (sourceBPLines_1) {
                    // authoredPath is set, so the file was mapped to source.
                    // Remove breakpoints from files that map to the same file, and map back to source.
                    response.breakpoints = response.breakpoints.filter(function (_, i) { return i < sourceBPLines_1.length; });
                    response.breakpoints.forEach(function (bp, i) {
                        var mapped = _this._sourceMaps.MapToSource(args_1.source.path, args_1.lines[i], args_1.cols[i]);
                        if (mapped) {
                            utils.Logger.log("SourceMaps.setBP: Mapped " + args_1.source.path + ":" + bp.line + ":" + bp.column + " to " + mapped.path + ":" + mapped.line);
                            bp.line = mapped.line;
                        }
                        else {
                            utils.Logger.log("SourceMaps.setBP: Can't map " + args_1.source.path + ":" + bp.line + ":" + bp.column + ", keeping the line number as-is.");
                        }
                        _this._requestSeqToSetBreakpointsArgs.delete(requestSeq);
                    });
                }
            }
        }
        // Cleanup column, which is passed in here in case it's needed for sourcemaps, but isn't actually
        // part of the DebugProtocol
        response.breakpoints.forEach(function (bp) {
            delete bp.column;
        });
    };
    /**
     * Apply sourcemapping to the stacktrace response
     */
    SourceMapTransformer.prototype.stackTraceResponse = function (response) {
        var _this = this;
        if (this._sourceMaps) {
            response.stackFrames.forEach(function (stackFrame) {
                var mapped = _this._sourceMaps.MapToSource(stackFrame.source.path, stackFrame.line, stackFrame.column);
                if (mapped && utils.existsSync(mapped.path)) {
                    // Script was mapped to a valid path
                    stackFrame.source.path = utils.canonicalizeUrl(mapped.path);
                    stackFrame.source.sourceReference = 0;
                    stackFrame.source.name = path.basename(mapped.path);
                    stackFrame.line = mapped.line;
                    stackFrame.column = mapped.column;
                }
                else if (utils.existsSync(stackFrame.source.path)) {
                    // Script could not be mapped, but does exist on disk. Keep it and clear the sourceReference.
                    stackFrame.source.sourceReference = 0;
                }
                else {
                    // Script could not be mapped and doesn't exist on disk. Clear the path, use sourceReference.
                    stackFrame.source.path = undefined;
                }
            });
        }
        else {
            response.stackFrames.forEach(function (stackFrame) {
                // PathTransformer needs to leave the frame in an unfinished state because it doesn't know whether sourcemaps are enabled
                if (stackFrame.source.path && stackFrame.source.sourceReference) {
                    stackFrame.source.path = undefined;
                }
            });
        }
    };
    SourceMapTransformer.prototype.scriptParsed = function (event) {
        var _this = this;
        if (this._sourceMaps) {
            this._allRuntimeScriptPaths.add(event.body.scriptUrl);
            var sourceMapUrlValue = event.body.sourceMapURL;
            if (!sourceMapUrlValue) {
                sourceMapUrlValue = this._sourceMaps.FindSourceMapUrlInFile(event.body.scriptUrl);
            }
            if (!sourceMapUrlValue || sourceMapUrlValue === "") {
                this.resolvePendingBreakpoints(event.body.scriptUrl);
                return;
            }
            this._sourceMaps.ProcessNewSourceMap(event.body.scriptUrl, sourceMapUrlValue).then(function () {
                var sources = _this._sourceMaps.AllMappedSources(event.body.scriptUrl);
                if (sources) {
                    utils.Logger.log("SourceMaps.scriptParsed: " + event.body.scriptUrl + " was just loaded and has mapped sources: " + JSON.stringify(sources));
                    sources.forEach(_this.resolvePendingBreakpoints, _this);
                }
            });
        }
    };
    // private getSourceMappingFile(filePathOrSourceMapValue: string): string {
    //     let result = filePathOrSourceMapValue;
    //     if (!fs.existsSync(filePathOrSourceMapValue)) {
    //         return result;
    //     }
    //     let fileContents = fs.readFileSync(filePathOrSourceMapValue, 'utf8');
    //     var baseRegex = "\\s*[@#]\\s*sourceMappingURL\\s*=\\s*([^\\s]*)";
    //     // Matches /* ... */ comments
    //     var blockCommentRegex = new RegExp("/\\*" + baseRegex + "\\s*\\*/");
    //     // Matches // .... comments
    //     var commentRegex = new RegExp("//" + baseRegex + "($|\n|\r\n?)");
    //     let match = fileContents.match(commentRegex);
    //     if (!match) {
    //         match = fileContents.match(blockCommentRegex);
    //     }
    //     if (match) {
    //         result = match[1];
    //     }
    //     return result;
    // }
    SourceMapTransformer.prototype.resolvePendingBreakpoints = function (sourcePath) {
        // If there's a setBreakpoints request waiting on this script, go through setBreakpoints again
        if (this._pendingBreakpointsByPath.has(sourcePath)) {
            utils.Logger.log("SourceMaps.scriptParsed: Resolving pending breakpoints for " + sourcePath);
            var pendingBreakpoint = this._pendingBreakpointsByPath.get(sourcePath);
            this._pendingBreakpointsByPath.delete(sourcePath);
            this.setBreakpoints(pendingBreakpoint.args, pendingBreakpoint.requestSeq)
                .then(pendingBreakpoint.resolve, pendingBreakpoint.reject);
        }
    };
    return SourceMapTransformer;
}());
exports.SourceMapTransformer = SourceMapTransformer;
//# sourceMappingURL=sourceMapTransformer.js.map