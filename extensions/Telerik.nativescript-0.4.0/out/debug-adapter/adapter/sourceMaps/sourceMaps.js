/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
"use strict";
/* tslint:disable */
var Path = require('path');
var URL = require('url');
var FS = require('fs');
var source_map_1 = require('source-map');
var PathUtils = require('./pathUtilities');
var utils = require('../../utilities');
var utilities_1 = require('../../utilities');
var SourceMaps = (function () {
    function SourceMaps(webRoot) {
        this._generatedToSourceMaps = {}; // generated -> source file
        this._sourceToGeneratedMaps = {}; // source file -> generated
        this._webRoot = webRoot;
    }
    SourceMaps.prototype.MapPathFromSource = function (pathToSource) {
        var map = this._findSourceToGeneratedMapping(pathToSource);
        if (map)
            return map.generatedPath();
        return null;
    };
    SourceMaps.prototype.MapFromSource = function (pathToSource, line, column) {
        var map = this._findSourceToGeneratedMapping(pathToSource);
        if (map) {
            line += 1; // source map impl is 1 based
            var mr = map.generatedPositionFor(pathToSource, line, column, Bias.LEAST_UPPER_BOUND);
            if (typeof mr.line === 'number') {
                if (SourceMaps.TRACE)
                    console.error(Path.basename(pathToSource) + " " + line + ":" + column + " -> " + mr.line + ":" + mr.column);
                return { path: map.generatedPath(), line: mr.line - 1, column: mr.column };
            }
        }
        return null;
    };
    SourceMaps.prototype.MapToSource = function (pathToGenerated, line, column) {
        var map = this._generatedToSourceMaps[pathToGenerated];
        if (map) {
            line += 1; // source map impl is 1 based
            var mr = map.originalPositionFor(line, column);
            if (mr.source) {
                if (SourceMaps.TRACE)
                    console.error(Path.basename(pathToGenerated) + " " + line + ":" + column + " -> " + mr.line + ":" + mr.column);
                return { path: mr.source, line: mr.line - 1, column: mr.column };
            }
        }
        return null;
    };
    SourceMaps.prototype.AllMappedSources = function (pathToGenerated) {
        var map = this._generatedToSourceMaps[pathToGenerated];
        return map ? map.sources : null;
    };
    SourceMaps.prototype.ProcessNewSourceMap = function (pathToGenerated, sourceMapURL) {
        return this._findGeneratedToSourceMapping(pathToGenerated, sourceMapURL).then(function () { });
    };
    //---- private -----------------------------------------------------------------------
    SourceMaps.prototype._findSourceToGeneratedMapping = function (pathToSource) {
        var _this = this;
        if (!pathToSource) {
            return null;
        }
        if (pathToSource in this._sourceToGeneratedMaps) {
            return this._sourceToGeneratedMaps[pathToSource];
        }
        // a reverse lookup: in all source maps try to find pathToSource in the sources array
        for (var key in this._generatedToSourceMaps) {
            var m = this._generatedToSourceMaps[key];
            if (m.doesOriginateFrom(pathToSource)) {
                this._sourceToGeneratedMaps[pathToSource] = m;
                return m;
            }
        }
        //try finding a map file next to the source file
        var generatedFilePath = null;
        var pos = pathToSource.lastIndexOf('.');
        if (pos >= 0) {
            generatedFilePath = pathToSource.substr(0, pos) + '.js';
        }
        if (FS.existsSync(generatedFilePath)) {
            var parsedSourceMap = this.findGeneratedToSourceMappingSync(generatedFilePath);
            if (parsedSourceMap) {
                if (parsedSourceMap.doesOriginateFrom(pathToSource)) {
                    this._sourceToGeneratedMaps[pathToSource] = parsedSourceMap;
                    return parsedSourceMap;
                }
            }
        }
        //try finding all js files in app root and parse their source maps
        var files = this.walkPath(this._webRoot);
        files.forEach(function (file) {
            var parsedSourceMap = _this.findGeneratedToSourceMappingSync(file);
            if (parsedSourceMap) {
                if (parsedSourceMap.doesOriginateFrom(pathToSource)) {
                    _this._sourceToGeneratedMaps[pathToSource] = parsedSourceMap;
                    return parsedSourceMap;
                }
            }
        });
        // let module_files = this.walkPath(Path.join(this._webRoot, "node_modules"));
        // module_files.forEach(file => {
        //     let parsedSourceMap =  this.findGeneratedToSourceMappingSync(file);
        //     if (parsedSourceMap)
        //     {
        //         if (parsedSourceMap.doesOriginateFrom(pathToSource))
        //         {
        //             this._sourceToGeneratedMaps[pathToSource] = parsedSourceMap;
        //             return parsedSourceMap;
        //         }
        //     }
        // });
        return null;
        // not found in existing maps
    };
    /**
     * try to find the 'sourceMappingURL' in the file with the given path.
     * Returns null in case of errors.
     */
    SourceMaps.prototype.FindSourceMapUrlInFile = function (generatedFilePath) {
        try {
            var contents = FS.readFileSync(generatedFilePath).toString();
            var lines = contents.split('\n');
            for (var _i = 0, lines_1 = lines; _i < lines_1.length; _i++) {
                var line = lines_1[_i];
                var matches = SourceMaps.SOURCE_MAPPING_MATCHER.exec(line);
                if (matches && matches.length === 2) {
                    var uri = matches[1].trim();
                    utilities_1.Logger.log("_findSourceMapUrlInFile: source map url at end of generated file '" + generatedFilePath + "''");
                    return uri;
                }
            }
        }
        catch (e) {
        }
        return null;
    };
    SourceMaps.prototype.walkPath = function (path) {
        var _this = this;
        var results = [];
        var list = FS.readdirSync(path);
        list.forEach(function (file) {
            file = Path.join(path, file);
            var stat = FS.statSync(file);
            if (stat && stat.isDirectory()) {
                results = results.concat(_this.walkPath(file));
            }
            else {
                results.push(file);
            }
        });
        return results;
    };
    // /**
    //  * Loads source map from file system.
    //  * If no generatedPath is given, the 'file' attribute of the source map is used.
    //  */
    // private _loadSourceMap(map_path: string, generatedPath?: string): SourceMap {
    // 	if (map_path in this._allSourceMaps) {
    // 		return this._allSourceMaps[map_path];
    // 	}
    // 	try {
    // 		const mp = Path.join(map_path);
    // 		const contents = FS.readFileSync(mp).toString();
    // 		const map = new SourceMap(mp, generatedPath, contents);
    // 		this._allSourceMaps[map_path] = map;
    // 		this._registerSourceMap(map);
    // 		Logger.log(`_loadSourceMap: successfully loaded source map '${map_path}'`);
    // 		return map;
    // 	}
    // 	catch (e) {
    // 		Logger.log(`_loadSourceMap: loading source map '${map_path}' failed with exception: ${e}`);
    // 	}
    // 	return null;
    // }
    // private _registerSourceMap(map: SourceMap) {
    // 	const gp = map.generatedPath();
    // 	if (gp) {
    // 		this._generatedToSourceMaps[gp] = map;
    // 	}
    // }
    /**
     * pathToGenerated - an absolute local path or a URL.
     * mapPath - a path relative to pathToGenerated.
     */
    SourceMaps.prototype._findGeneratedToSourceMapping = function (generatedFilePath, mapPath) {
        var _this = this;
        if (!generatedFilePath) {
            return Promise.resolve(null);
        }
        if (generatedFilePath in this._generatedToSourceMaps) {
            return Promise.resolve(this._generatedToSourceMaps[generatedFilePath]);
        }
        var parsedSourceMap = this.parseInlineSourceMap(mapPath, generatedFilePath);
        if (parsedSourceMap) {
            return Promise.resolve(parsedSourceMap);
        }
        // if path is relative make it absolute
        if (!Path.isAbsolute(mapPath)) {
            if (Path.isAbsolute(generatedFilePath)) {
                // runtime script is on disk, so map should be too
                mapPath = PathUtils.makePathAbsolute(generatedFilePath, mapPath);
            }
            else {
                // runtime script is not on disk, construct the full url for the source map
                var scriptUrl = URL.parse(generatedFilePath);
                mapPath = scriptUrl.protocol + "//" + scriptUrl.host + Path.dirname(scriptUrl.pathname) + "/" + mapPath;
            }
        }
        return this._createSourceMap(mapPath, generatedFilePath).then(function (map) {
            if (!map) {
                var mapPathNextToSource = generatedFilePath + ".map";
                if (mapPathNextToSource !== mapPath) {
                    return _this._createSourceMap(mapPathNextToSource, generatedFilePath);
                }
            }
            return map;
        }).then(function (map) {
            if (map) {
                _this._generatedToSourceMaps[generatedFilePath] = map;
            }
            return map || null;
        });
    };
    /**
     * generatedFilePath - an absolute local path to the generated file
     * returns the SourceMap parsed from inlined value or from a map file available next to the generated file
     */
    SourceMaps.prototype.findGeneratedToSourceMappingSync = function (generatedFilePath) {
        if (!generatedFilePath) {
            return null;
        }
        if (generatedFilePath in this._generatedToSourceMaps) {
            return this._generatedToSourceMaps[generatedFilePath];
        }
        var sourceMapUrlValue = this.FindSourceMapUrlInFile(generatedFilePath);
        if (!sourceMapUrlValue) {
            return null;
        }
        var parsedSourceMap = this.parseInlineSourceMap(sourceMapUrlValue, generatedFilePath);
        if (parsedSourceMap) {
            return parsedSourceMap;
        }
        if (!FS.existsSync(generatedFilePath)) {
            utilities_1.Logger.log("findGeneratedToSourceMappingSync: can't find the sourceMapping for file: " + generatedFilePath);
            return null;
        }
        // if path is relative make it absolute
        if (!Path.isAbsolute(sourceMapUrlValue)) {
            if (Path.isAbsolute(generatedFilePath)) {
                // runtime script is on disk, so map should be too
                sourceMapUrlValue = PathUtils.makePathAbsolute(generatedFilePath, sourceMapUrlValue);
            }
            else {
                // runtime script is not on disk, construct the full url for the source map
                // const scriptUrl = URL.parse(generatedFilePath);
                // mapPath = `${scriptUrl.protocol}//${scriptUrl.host}${Path.dirname(scriptUrl.pathname)}/${mapPath}`;
                return null;
            }
        }
        var map = this._createSourceMapSync(sourceMapUrlValue, generatedFilePath);
        if (!map) {
            var mapPathNextToSource = generatedFilePath + ".map";
            if (mapPathNextToSource !== sourceMapUrlValue) {
                map = this._createSourceMapSync(mapPathNextToSource, generatedFilePath);
            }
        }
        if (map) {
            this._generatedToSourceMaps[generatedFilePath] = map;
            return map;
        }
        return null;
    };
    SourceMaps.prototype.parseInlineSourceMap = function (sourceMapContents, generatedFilePath) {
        if (sourceMapContents.indexOf("data:application/json;base64,") >= 0) {
            // sourcemap is inlined
            var pos = sourceMapContents.indexOf(',');
            var data = sourceMapContents.substr(pos + 1);
            try {
                var buffer = new Buffer(data, 'base64');
                var json = buffer.toString();
                if (json) {
                    var map = new SourceMap(generatedFilePath, json, this._webRoot);
                    this._generatedToSourceMaps[generatedFilePath] = map;
                    return map;
                }
            }
            catch (e) {
                utilities_1.Logger.log("can't parse inlince sourcemap. exception while processing data url (" + e.stack + ")");
            }
        }
        return null;
    };
    SourceMaps.prototype._createSourceMap = function (mapPath, pathToGenerated) {
        var _this = this;
        var contentsP;
        if (utils.isURL(mapPath)) {
            contentsP = utils.getURL(mapPath).catch(function (e) {
                utilities_1.Logger.log("SourceMaps.createSourceMap: Could not download map from " + mapPath);
                return null;
            });
        }
        else {
            contentsP = new Promise(function (resolve, reject) {
                FS.readFile(mapPath, function (err, data) {
                    if (err) {
                        utilities_1.Logger.log("SourceMaps.createSourceMap: Could not read map from " + mapPath);
                        resolve(null);
                    }
                    else {
                        resolve(data);
                    }
                });
            });
        }
        return contentsP.then(function (contents) {
            if (contents) {
                try {
                    // Throws for invalid contents JSON
                    return new SourceMap(pathToGenerated, contents, _this._webRoot);
                }
                catch (e) {
                    utilities_1.Logger.log("SourceMaps.createSourceMap: exception while processing sourcemap: " + e.stack);
                    return null;
                }
            }
            else {
                return null;
            }
        });
    };
    SourceMaps.prototype._createSourceMapSync = function (mapPath, pathToGenerated) {
        var contents = FS.readFileSync(mapPath, 'utf8');
        try {
            // Throws for invalid contents JSON
            return new SourceMap(pathToGenerated, contents, this._webRoot);
        }
        catch (e) {
            utilities_1.Logger.log("SourceMaps.createSourceMap: exception while processing sourcemap: " + e.stack);
            return null;
        }
    };
    SourceMaps.TRACE = false;
    SourceMaps.SOURCE_MAPPING_MATCHER = new RegExp("//[#@] ?sourceMappingURL=(.+)$");
    return SourceMaps;
}());
exports.SourceMaps = SourceMaps;
var Bias;
(function (Bias) {
    Bias[Bias["GREATEST_LOWER_BOUND"] = 1] = "GREATEST_LOWER_BOUND";
    Bias[Bias["LEAST_UPPER_BOUND"] = 2] = "LEAST_UPPER_BOUND";
})(Bias || (Bias = {}));
var SourceMap = (function () {
    /**
     * pathToGenerated - an absolute local path or a URL
     * json - sourcemap contents
     * webRoot - an absolute path
     */
    function SourceMap(generatedPath, json, webRoot) {
        var _this = this;
        utilities_1.Logger.log("SourceMap: creating SM for " + generatedPath);
        this._generatedPath = generatedPath;
        this._webRoot = webRoot;
        var sm = JSON.parse(json);
        this._absSourceRoot = PathUtils.getAbsSourceRoot(sm.sourceRoot, this._webRoot, this._generatedPath);
        // Overwrite the sourcemap's sourceRoot with the version that's resolved to an absolute path,
        // so the work above only has to be done once
        if (this._absSourceRoot.startsWith('/')) {
            // OSX paths
            sm.sourceRoot = 'file://' + this._absSourceRoot;
        }
        else {
            // Windows paths
            sm.sourceRoot = 'file:///' + this._absSourceRoot;
        }
        sm.sources = sm.sources.map(function (sourcePath) {
            // special-case webpack:/// prefixed sources which is kind of meaningless
            sourcePath = utils.lstrip(sourcePath, 'webpack:///');
            // Force correct format for sanity
            return utils.fixDriveLetterAndSlashes(sourcePath);
        });
        this._smc = new source_map_1.SourceMapConsumer(sm);
        // rewrite sources as absolute paths
        this._sources = sm.sources.map(function (sourcePath) {
            if (sourcePath.startsWith('file:///')) {
                // If one source is a URL, assume all are
                _this._sourcesAreURLs = true;
            }
            sourcePath = utils.lstrip(sourcePath, 'webpack:///');
            sourcePath = PathUtils.canonicalizeUrl(sourcePath);
            if (Path.isAbsolute(sourcePath)) {
                return utils.fixDriveLetterAndSlashes(sourcePath);
            }
            else {
                return Path.join(_this._absSourceRoot, sourcePath);
            }
        });
    }
    Object.defineProperty(SourceMap.prototype, "sources", {
        /*
         * Return all mapped sources as absolute paths
         */
        get: function () {
            return this._sources;
        },
        enumerable: true,
        configurable: true
    });
    /*
     * the generated file of this source map.
     */
    SourceMap.prototype.generatedPath = function () {
        return this._generatedPath;
    };
    /*
     * returns true if this source map originates from the given source.
     */
    SourceMap.prototype.doesOriginateFrom = function (absPath) {
        return this.sources.some(function (path) { return path === absPath; });
    };
    /*
     * finds the nearest source location for the given location in the generated file.
     */
    SourceMap.prototype.originalPositionFor = function (line, column, bias) {
        if (bias === void 0) { bias = Bias.GREATEST_LOWER_BOUND; }
        var mp = this._smc.originalPositionFor({
            line: line,
            column: column,
            bias: bias
        });
        if (mp.source) {
            mp.source = PathUtils.canonicalizeUrl(mp.source);
        }
        return mp;
    };
    /*
     * finds the nearest location in the generated file for the given source location.
     */
    SourceMap.prototype.generatedPositionFor = function (src, line, column, bias) {
        if (bias === void 0) { bias = Bias.GREATEST_LOWER_BOUND; }
        if (this._sourcesAreURLs) {
            src = 'file:///' + src;
        }
        else if (this._absSourceRoot) {
            // make input path relative to sourceRoot
            src = Path.relative(this._absSourceRoot, src);
            // source-maps use forward slashes unless the source is specified with file:///
            if (process.platform === 'win32') {
                src = src.replace(/\\/g, '/');
            }
        }
        var needle = {
            source: src,
            line: line,
            column: column,
            bias: bias
        };
        return this._smc.generatedPositionFor(needle);
    };
    return SourceMap;
}());
//# sourceMappingURL=sourceMaps.js.map