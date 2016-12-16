"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var child_process_1 = require('child_process');
var fs = require('fs');
var events_1 = require('events');
var Version_1 = require('../common/Version');
var utilities_1 = require('../debug-adapter/utilities');
var ExtensionVersionInfo_1 = require('./ExtensionVersionInfo');
(function (CliVersionState) {
    CliVersionState[CliVersionState["NotExisting"] = 0] = "NotExisting";
    CliVersionState[CliVersionState["OlderThanSupported"] = 1] = "OlderThanSupported";
    CliVersionState[CliVersionState["Compatible"] = 2] = "Compatible";
})(exports.CliVersionState || (exports.CliVersionState = {}));
var CliVersionState = exports.CliVersionState;
var CliVersionInfo = (function () {
    function CliVersionInfo() {
        var installedCliVersion = CliVersionInfo.getInstalledCliVersion();
        if (installedCliVersion === null) {
            this._state = CliVersionState.NotExisting;
        }
        else {
            var minSupportedCliVersion = ExtensionVersionInfo_1.ExtensionVersionInfo.getMinSupportedNativeScriptVersion();
            this._state = Version_1.Version.compareBySubminor(installedCliVersion, minSupportedCliVersion) < 0 ? CliVersionState.OlderThanSupported : CliVersionState.Compatible;
        }
    }
    CliVersionInfo.getInstalledCliVersion = function () {
        if (this.installedCliVersion === null) {
            // get the currently installed CLI version
            var getVersionCommand = new CommandBuilder().appendParam('--version').buildAsString(); // tns --version
            try {
                var versionStr = child_process_1.execSync(getVersionCommand).toString().trim(); // execute it
                this.installedCliVersion = versionStr ? Version_1.Version.parse(versionStr) : null; // parse the version string
            }
            catch (e) {
                this.installedCliVersion = null;
            }
        }
        return this.installedCliVersion;
    };
    CliVersionInfo.prototype.getState = function () {
        return this._state;
    };
    CliVersionInfo.prototype.isCompatible = function () {
        return this._state === CliVersionState.Compatible;
    };
    CliVersionInfo.prototype.getErrorMessage = function () {
        switch (this._state) {
            case CliVersionState.NotExisting:
                return "NativeScript CLI not found, please run 'npm -g install nativescript' to install it.";
            case CliVersionState.OlderThanSupported:
                return "The existing NativeScript extension is compatible with NativeScript CLI v" + Version_1.Version.stringify(ExtensionVersionInfo_1.ExtensionVersionInfo.getMinSupportedNativeScriptVersion()) + " or greater. The currently installed NativeScript CLI is v" + Version_1.Version.stringify(CliVersionInfo.getInstalledCliVersion()) + ". You can update the NativeScript CLI by executing 'npm install -g nativescript'.";
            default:
                return null;
        }
    };
    CliVersionInfo.installedCliVersion = null;
    return CliVersionInfo;
}());
exports.CliVersionInfo = CliVersionInfo;
var NSProject = (function (_super) {
    __extends(NSProject, _super);
    function NSProject(projectPath, tnsOutputFilePath) {
        _super.call(this);
        this._projectPath = projectPath;
        this._tnsOutputFileStream = tnsOutputFilePath ? fs.createWriteStream(tnsOutputFilePath) : null;
        this._cliVersionInfo = new CliVersionInfo();
    }
    NSProject.prototype.getProjectPath = function () {
        return this._projectPath;
    };
    NSProject.prototype.getCliVersionInfo = function () {
        return this._cliVersionInfo;
    };
    NSProject.prototype.spawnProcess = function (commandPath, commandArgs, tnsOutput) {
        var options = { cwd: this.getProjectPath(), shell: true };
        var child = child_process_1.spawn(commandPath, commandArgs, options);
        child.stdout.setEncoding('utf8');
        child.stderr.setEncoding('utf8');
        return child;
    };
    NSProject.prototype.writeToTnsOutputFile = function (message) {
        if (this._tnsOutputFileStream) {
            this._tnsOutputFileStream.write(message, 'utf8');
        }
    };
    return NSProject;
}(events_1.EventEmitter));
exports.NSProject = NSProject;
var IosProject = (function (_super) {
    __extends(IosProject, _super);
    function IosProject(projectPath, tnsOutputFilePath) {
        _super.call(this, projectPath, tnsOutputFilePath);
    }
    IosProject.prototype.platform = function () {
        return 'ios';
    };
    IosProject.prototype.run = function () {
        if (!this.isOSX()) {
            return Promise.reject('iOS platform is only supported on OS X.');
        }
        // build command to execute
        var command = new CommandBuilder()
            .appendParam("run")
            .appendParam(this.platform())
            .build();
        var child = this.spawnProcess(command.path, command.args);
        return Promise.resolve(child);
    };
    IosProject.prototype.debug = function (args) {
        var _this = this;
        if (!this.isOSX()) {
            return Promise.reject('iOS platform is supported only on OS X.');
        }
        var rebuild = (args.request == "launch") ? args.rebuild : true;
        // build command to execute
        var command = new CommandBuilder(args.nativescriptCliPath)
            .appendParam("debug")
            .appendParam(this.platform())
            .appendParamIf("--emulator", args.emulator)
            .appendParamIf("--start", args.request === "attach")
            .appendParamIf("--debug-brk", args.request === "launch")
            .appendParamIf("--no-rebuild", !rebuild)
            .appendParamIf("--syncAllFiles", args.request === "launch" && !rebuild && args.syncAllFiles)
            .appendParam("--no-client")
            .appendParams(args.tnsArgs)
            .build();
        var socketPathPrefix = 'socket-file-location: ';
        var socketPathPattern = new RegExp(socketPathPrefix + '.*\.sock');
        var isSocketOpened = function (cliOutput) {
            var matches = cliOutput.match(socketPathPattern);
            if (matches && matches.length > 0) {
                return matches[0].substr(socketPathPrefix.length);
            }
            return null;
        };
        var isAppSynced = function (cliOutput) {
            return cliOutput.indexOf('Successfully synced application') > -1;
        };
        return new Promise(function (resolve, reject) {
            // run NativeScript CLI command
            var child = _this.spawnProcess(command.path, command.args, args.tnsOutput);
            var appSynced = false;
            var socketPath = null;
            child.stdout.on('data', function (data) {
                var cliOutput = data.toString();
                _this.emit('TNS.outputMessage', cliOutput, 'log');
                _this.writeToTnsOutputFile(cliOutput);
                socketPath = socketPath || isSocketOpened(cliOutput);
                appSynced = rebuild ? false : (appSynced || isAppSynced(cliOutput));
                if ((rebuild && socketPath) || (!rebuild && socketPath && appSynced)) {
                    resolve(socketPath);
                }
            });
            child.stderr.on('data', function (data) {
                _this.emit('TNS.outputMessage', data, 'error');
                _this.writeToTnsOutputFile(data.toString());
            });
            child.on('close', function (code, signal) {
                reject("The debug process exited unexpectedly code:" + code);
            });
        });
    };
    IosProject.prototype.isOSX = function () {
        return /^darwin/.test(process.platform);
    };
    return IosProject;
}(NSProject));
exports.IosProject = IosProject;
var AndroidProject = (function (_super) {
    __extends(AndroidProject, _super);
    function AndroidProject(projectPath, tnsOutputFilePath) {
        _super.call(this, projectPath, tnsOutputFilePath);
    }
    AndroidProject.prototype.platform = function () {
        return 'android';
    };
    AndroidProject.prototype.run = function () {
        // build command to execute
        var command = new CommandBuilder()
            .appendParam("run")
            .appendParam(this.platform())
            .build();
        var child = this.spawnProcess(command.path, command.args);
        return Promise.resolve(child);
    };
    AndroidProject.prototype.debug = function (params) {
        var _this = this;
        if (params.request === "attach") {
            return Promise.resolve();
        }
        else if (params.request === "launch") {
            var args_1 = params;
            var that_1 = this;
            var launched_1 = false;
            return new Promise(function (resolve, reject) {
                var command = new CommandBuilder(args_1.nativescriptCliPath)
                    .appendParam("debug")
                    .appendParam(_this.platform())
                    .appendParamIf("--emulator", args_1.emulator)
                    .appendParamIf("--no-rebuild", args_1.rebuild !== true)
                    .appendParam("--debug-brk")
                    .appendParam("--no-client")
                    .appendParams(args_1.tnsArgs)
                    .build();
                utilities_1.Logger.log("tns  debug command: " + command);
                // run NativeScript CLI command
                var child = _this.spawnProcess(command.path, command.args, args_1.tnsOutput);
                child.stdout.on('data', function (data) {
                    var strData = data.toString();
                    that_1.emit('TNS.outputMessage', data.toString(), 'log');
                    that_1.writeToTnsOutputFile(strData);
                    if (!launched_1) {
                        if (args_1.request === "launch" && strData.indexOf('# NativeScript Debugger started #') > -1) {
                            launched_1 = true;
                            //wait a little before trying to connect, this gives a changes for adb to be able to connect to the debug socket
                            setTimeout(function () {
                                resolve();
                            }, 500);
                        }
                    }
                });
                child.stderr.on('data', function (data) {
                    that_1.emit('TNS.outputMessage', data.toString(), 'error');
                    that_1.writeToTnsOutputFile(data.toString());
                });
                child.on('close', function (code) {
                    if (!args_1.rebuild) {
                        setTimeout(function () {
                            reject("The debug process exited unexpectedly code:" + code);
                        }, 3000);
                    }
                    else {
                        reject("The debug process exited unexpectedly code:" + code);
                    }
                });
            });
        }
    };
    AndroidProject.prototype.getDebugPort = function (args) {
        //TODO: Call CLI to get the debug port
        //return Promise.resolve(40001);
        var _this = this;
        //return Promise.resolve(40001);
        var command = new CommandBuilder(args.nativescriptCliPath)
            .appendParam("debug")
            .appendParam(this.platform())
            .appendParam("--get-port")
            .appendParams(args.tnsArgs)
            .build();
        var that = this;
        // run NativeScript CLI command
        return new Promise(function (resolve, reject) {
            var child = _this.spawnProcess(command.path, command.args, args.tnsOutput);
            child.stdout.on('data', function (data) {
                that.emit('TNS.outputMessage', data.toString(), 'log');
                that.writeToTnsOutputFile(data.toString());
                var regexp = new RegExp("(?:debug port: )([\\d]{5})");
                //for the new output
                // var input = "device: 030b258308e6ce89 debug port: 40001";
                var portNumberMatch = null;
                var match = data.toString().match(regexp);
                if (match) {
                    portNumberMatch = match[1];
                }
                if (portNumberMatch) {
                    utilities_1.Logger.log("port number match '" + portNumberMatch + "'");
                    var portNumber = parseInt(portNumberMatch);
                    if (portNumber) {
                        utilities_1.Logger.log("port number " + portNumber);
                        child.stdout.removeAllListeners('data');
                        resolve(portNumber);
                    }
                }
            });
            child.stderr.on('data', function (data) {
                that.emit('TNS.outputMessage', data.toString(), 'error');
                that.writeToTnsOutputFile(data.toString());
            });
            child.on('close', function (code) {
                reject("Getting debug port failed with code: " + code);
            });
        });
    };
    return AndroidProject;
}(NSProject));
exports.AndroidProject = AndroidProject;
var CommandBuilder = (function () {
    function CommandBuilder(tnsPath) {
        this._command = [];
        this._tnsPath = tnsPath || "tns";
    }
    CommandBuilder.prototype.appendParam = function (parameter) {
        this._command.push(parameter);
        return this;
    };
    CommandBuilder.prototype.appendParams = function (parameters) {
        var _this = this;
        if (parameters === void 0) { parameters = []; }
        parameters.forEach(function (param) { return _this.appendParam(param); });
        return this;
    };
    CommandBuilder.prototype.appendParamIf = function (parameter, condtion) {
        if (condtion) {
            this._command.push(parameter);
        }
        return this;
    };
    CommandBuilder.prototype.build = function () {
        return { path: this._tnsPath, args: this._command };
    };
    CommandBuilder.prototype.buildAsString = function () {
        var result = this.build();
        return (result.path + " ") + result.args.join(' ');
    };
    return CommandBuilder;
}());
//# sourceMappingURL=NsCliService.js.map