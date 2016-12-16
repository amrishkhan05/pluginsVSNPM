/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
"use strict";
var path = require('path');
var vscode_debugadapter_1 = require('vscode-debugadapter');
var iosConnection_1 = require('./connection/iosConnection');
var androidConnection_1 = require('./connection/androidConnection');
var utils = require('./utilities');
var consoleHelper_1 = require('./consoleHelper');
var ns = require('../services/NsCliService');
var ExtensionClient_1 = require('../services/ipc/ExtensionClient');
var WebKitDebugAdapter = (function () {
    function WebKitDebugAdapter() {
        this._variableHandles = new vscode_debugadapter_1.Handles();
        this._overlayHelper = new utils.DebounceHelper(/*timeoutMs=*/ 200);
        this.clearEverything();
    }
    Object.defineProperty(WebKitDebugAdapter.prototype, "paused", {
        get: function () {
            return !!this._currentStack;
        },
        enumerable: true,
        configurable: true
    });
    WebKitDebugAdapter.prototype.clearTargetContext = function () {
        this._scriptsById = new Map();
        this._committedBreakpointsByUrl = new Map();
        this._setBreakpointsRequestQ = Promise.resolve();
        this.fireEvent({ seq: 0, type: 'event', event: 'clearTargetContext' });
    };
    WebKitDebugAdapter.prototype.clearClientContext = function () {
        this._clientAttached = false;
        this.fireEvent({ seq: 0, type: 'event', event: 'clearClientContext' });
    };
    WebKitDebugAdapter.prototype.registerEventHandler = function (eventHandler) {
        this._eventHandler = eventHandler;
    };
    WebKitDebugAdapter.prototype.initialize = function (args) {
        // Cache to log if diagnostic logging is enabled later
        this._initArgs = args;
        return {
            supportsConfigurationDoneRequest: true,
            supportsFunctionBreakpoints: false,
            supportsConditionalBreakpoints: true,
            supportsEvaluateForHovers: false,
            exceptionBreakpointFilters: [{
                    label: 'All Exceptions',
                    filter: 'all',
                    default: false
                },
                {
                    label: 'Uncaught Exceptions',
                    filter: 'uncaught',
                    default: true
                }]
        };
    };
    WebKitDebugAdapter.prototype.configurationDone = function (args) {
    };
    WebKitDebugAdapter.prototype.launch = function (args) {
        return this._attach(args);
    };
    WebKitDebugAdapter.prototype.attach = function (args) {
        return this._attach(args);
    };
    WebKitDebugAdapter.prototype.initDiagnosticLogging = function (name, args) {
        if (args.diagnosticLogging) {
            utils.Logger.enableDiagnosticLogging();
            utils.Logger.log("initialize(" + JSON.stringify(this._initArgs) + ")");
            utils.Logger.log(name + "(" + JSON.stringify(args) + ")");
        }
    };
    WebKitDebugAdapter.prototype._attach = function (args) {
        var _this = this;
        ExtensionClient_1.ExtensionClient.setAppRoot(utils.getAppRoot(args));
        var analyticsRequest = (args.request == "launch" && !args.rebuild) ? "sync" : args.request;
        ExtensionClient_1.ExtensionClient.getInstance().analyticsLaunchDebugger({ request: analyticsRequest, platform: args.platform });
        this.initDiagnosticLogging(args.request, args);
        this.appRoot = utils.getAppRoot(args);
        this.platform = args.platform;
        this.isAttached = false;
        return ((args.platform == 'ios') ? this._attachIos(args) : this._attachAndroid(args))
            .then(function () {
            _this.isAttached = true;
            _this.fireEvent(new vscode_debugadapter_1.InitializedEvent());
        }, function (e) {
            _this.onTnsOutputMessage("Command failed: " + e, "error");
            _this.clearEverything();
            return utils.errP(e);
        });
    };
    WebKitDebugAdapter.prototype._attachIos = function (args) {
        var _this = this;
        var iosProject = new ns.IosProject(this.appRoot, args.tnsOutput);
        iosProject.on('TNS.outputMessage', function (message, level) { return _this.onTnsOutputMessage.apply(_this, [message, level]); });
        return iosProject.debug(args)
            .then(function (socketFilePath) {
            var iosConnection = new iosConnection_1.IosConnection();
            _this.setConnection(iosConnection, args);
            return iosConnection.attach(socketFilePath);
        });
    };
    WebKitDebugAdapter.prototype._attachAndroid = function (args) {
        var _this = this;
        var androidProject = new ns.AndroidProject(this.appRoot, args.tnsOutput);
        var thisAdapter = this;
        androidProject.on('TNS.outputMessage', function (message, level) { return thisAdapter.onTnsOutputMessage.apply(thisAdapter, [message, level]); });
        this.onTnsOutputMessage("Getting debug port");
        var androidConnection = null;
        var runDebugCommand = (args.request == 'launch') ? androidProject.debug(args) : Promise.resolve();
        return runDebugCommand.then(function (_) {
            var port;
            return androidProject.getDebugPort(args).then(function (debugPort) {
                port = debugPort;
                if (!thisAdapter._webKitConnection) {
                    androidConnection = new androidConnection_1.AndroidConnection();
                    _this.setConnection(androidConnection, args);
                }
            }).then(function () {
                _this.onTnsOutputMessage("Attaching to debug application");
                return androidConnection.attach(port, 'localhost');
            });
        });
    };
    WebKitDebugAdapter.prototype.setConnection = function (connection, args) {
        var _this = this;
        connection.on('Debugger.paused', function (params) { return _this.onDebuggerPaused(params); });
        connection.on('Debugger.resumed', function () { return _this.onDebuggerResumed(); });
        connection.on('Debugger.scriptParsed', function (params) { return _this.onScriptParsed(params); });
        connection.on('Debugger.globalObjectCleared', function () { return _this.onGlobalObjectCleared(); });
        connection.on('Debugger.breakpointResolved', function (params) { return _this.onBreakpointResolved(params); });
        connection.on('Console.messageAdded', function (params) { return _this.onConsoleMessage(params); });
        connection.on('Console.messageRepeatCountUpdated', function (params) { return _this.onMessageRepeatCountUpdated(params); });
        connection.on('Inspector.detached', function () { return _this.terminateSession(); });
        connection.on('close', function () { return _this.terminateSession(); });
        connection.on('error', function () { return _this.terminateSession(); });
        connection.on('connect', function () { return _this.onConnected(args); });
        this._webKitConnection = connection;
        return connection;
    };
    WebKitDebugAdapter.prototype.onConnected = function (args) {
        this.onTnsOutputMessage("Debugger connected");
    };
    WebKitDebugAdapter.prototype.onTnsOutputMessage = function (message, level) {
        if (level === void 0) { level = "log"; }
        utils.Logger.log(message);
        if (!this.isAttached) {
            var messageParams = {
                message: {
                    level: level,
                    type: 'log',
                    text: message
                }
            };
            this.onConsoleMessage(messageParams);
        }
    };
    WebKitDebugAdapter.prototype.fireEvent = function (event) {
        if (this._eventHandler) {
            this._eventHandler(event);
        }
    };
    WebKitDebugAdapter.prototype.terminateSession = function () {
        if (this._clientAttached) {
            this.fireEvent(new vscode_debugadapter_1.TerminatedEvent());
        }
        this.onTnsOutputMessage("Terminating debug session");
        this.clearEverything();
    };
    WebKitDebugAdapter.prototype.clearEverything = function () {
        this.clearClientContext();
        this.clearTargetContext();
        this.isAttached = false;
        this._chromeProc = null;
        if (this._webKitConnection) {
            this.onTnsOutputMessage("Closing debug connection");
            this._webKitConnection.close();
            this._webKitConnection = null;
        }
    };
    /**
     * e.g. the target navigated
     */
    WebKitDebugAdapter.prototype.onGlobalObjectCleared = function () {
        this.clearTargetContext();
    };
    WebKitDebugAdapter.prototype.onDebuggerPaused = function (notification) {
        this._currentStack = notification.callFrames;
        // We can tell when we've broken on an exception. Otherwise if hitBreakpoints is set, assume we hit a
        // breakpoint. If not set, assume it was a step. We can't tell the difference between step and 'break on anything'.
        var reason;
        var exceptionText;
        if (notification.reason === 'exception') {
            reason = 'exception';
            if (notification.data && this._currentStack.length) {
                // Insert a scope to wrap the exception object. exceptionText is unused by Code at the moment.
                var remoteObjValue = utils.remoteObjectToValue(notification.data, false);
                var scopeObject = void 0;
                if (remoteObjValue.variableHandleRef) {
                    // If the remote object is an object (probably an Error), treat the object like a scope.
                    exceptionText = notification.data.description;
                    scopeObject = notification.data;
                }
                else {
                    // If it's a value, use a special flag and save the value for later.
                    exceptionText = notification.data.value;
                    scopeObject = { objectId: WebKitDebugAdapter.EXCEPTION_VALUE_ID };
                    this._exceptionValueObject = notification.data;
                }
                this._currentStack[0].scopeChain.unshift({ type: 'Exception', object: scopeObject });
            }
        }
        else if (notification.reason == "PauseOnNextStatement") {
            reason = 'pause';
        }
        else if (notification.reason == "Breakpoint") {
            reason = 'breakpoint';
        }
        else {
            reason = 'step';
        }
        this.fireEvent(new vscode_debugadapter_1.StoppedEvent(reason, /*threadId=*/ WebKitDebugAdapter.THREAD_ID, exceptionText));
    };
    WebKitDebugAdapter.prototype.onDebuggerResumed = function () {
        this._currentStack = null;
        if (!this._expectingResumedEvent) {
            // This is a private undocumented event provided by VS Code to support the 'continue' button on a paused Chrome page
            var resumedEvent = { seq: 0, type: 'event', event: 'continued', body: { threadId: WebKitDebugAdapter.THREAD_ID } };
            this.fireEvent(resumedEvent);
        }
        else {
            this._expectingResumedEvent = false;
        }
    };
    WebKitDebugAdapter.prototype.onScriptParsed = function (script) {
        this._scriptsById.set(script.scriptId, script);
        if (this.scriptIsNotAnonymous(script)) {
            this.fireEvent({ seq: 0, type: 'event', event: 'scriptParsed', body: { scriptUrl: script.url, sourceMapURL: script.sourceMapURL } });
        }
    };
    WebKitDebugAdapter.prototype.onBreakpointResolved = function (params) {
        var script = this._scriptsById.get(params.location.scriptId);
        if (!script) {
            // Breakpoint resolved for a script we don't know about
            return;
        }
        var committedBps = this._committedBreakpointsByUrl.get(script.url) || [];
        committedBps.push(params.breakpointId);
        this._committedBreakpointsByUrl.set(script.url, committedBps);
    };
    WebKitDebugAdapter.prototype.onConsoleMessage = function (params) {
        var localMessage = params.message;
        var isClientPath = false;
        if (localMessage.url) {
            var clientPath = utils.webkitUrlToClientPath(this.appRoot, this.platform, localMessage.url);
            if (clientPath !== '') {
                localMessage.url = clientPath;
                isClientPath = true;
            }
        }
        var formattedMessage = consoleHelper_1.formatConsoleMessage(localMessage, isClientPath);
        if (formattedMessage) {
            var outputEvent = new vscode_debugadapter_1.OutputEvent(formattedMessage.text + '\n', formattedMessage.isError ? 'stderr' : 'stdout');
            this._lastOutputEvent = outputEvent;
            this.fireEvent(outputEvent);
        }
    };
    WebKitDebugAdapter.prototype.onMessageRepeatCountUpdated = function (params) {
        if (this._lastOutputEvent) {
            this.fireEvent(this._lastOutputEvent);
        }
    };
    WebKitDebugAdapter.prototype.disconnect = function () {
        if (this._chromeProc) {
            this._chromeProc.kill('SIGINT');
            this._chromeProc = null;
        }
        this.clearEverything();
        return Promise.resolve();
    };
    WebKitDebugAdapter.prototype.setBreakpoints = function (args) {
        var _this = this;
        var targetScriptUrl;
        if (args.source.path) {
            targetScriptUrl = args.source.path;
        }
        else if (args.source.sourceReference) {
            var targetScript = this._scriptsById.get(sourceReferenceToScriptId(args.source.sourceReference));
            if (targetScript) {
                targetScriptUrl = targetScript.url;
            }
        }
        if (targetScriptUrl) {
            // DebugProtocol sends all current breakpoints for the script. Clear all scripts for the breakpoint then add all of them
            var setBreakpointsPFailOnError = this._setBreakpointsRequestQ
                .then(function () { return _this._clearAllBreakpoints(targetScriptUrl); })
                .then(function () { return _this._addBreakpoints(targetScriptUrl, args); })
                .then(function (responses) { return ({ breakpoints: _this._webkitBreakpointResponsesToODPBreakpoints(targetScriptUrl, responses, args.lines) }); });
            var inDebug = typeof global.v8debug === 'object';
            console.log("InDebug: " + inDebug);
            var setBreakpointsPTimeout = utils.promiseTimeout(setBreakpointsPFailOnError, /*timeoutMs*/ inDebug ? 2000000 : 8000, 'Set breakpoints request timed out');
            // Do just one setBreakpointsRequest at a time to avoid interleaving breakpoint removed/breakpoint added requests to Chrome.
            // Swallow errors in the promise queue chain so it doesn't get blocked, but return the failing promise for error handling.
            this._setBreakpointsRequestQ = setBreakpointsPTimeout.catch(function () { return undefined; });
            return setBreakpointsPTimeout;
        }
        else {
            return utils.errP("Can't find script for breakpoint request");
        }
    };
    WebKitDebugAdapter.prototype._clearAllBreakpoints = function (url) {
        var _this = this;
        if (!this._committedBreakpointsByUrl.has(url)) {
            return Promise.resolve();
        }
        // Remove breakpoints one at a time. Seems like it would be ok to send the removes all at once,
        // but there is a chrome bug where when removing 5+ or so breakpoints at once, it gets into a weird
        // state where later adds on the same line will fail with 'breakpoint already exists' even though it
        // does not break there.
        return this._committedBreakpointsByUrl.get(url).reduce(function (p, bpId) {
            return p.then(function () { return _this._webKitConnection.debugger_removeBreakpoint(bpId); }).then(function () { });
        }, Promise.resolve()).then(function () {
            _this._committedBreakpointsByUrl.set(url, null);
        });
    };
    WebKitDebugAdapter.prototype._addBreakpoints = function (url, breakpoints) {
        var _this = this;
        // Call setBreakpoint for all breakpoints in the script simultaneously
        var responsePs = breakpoints.breakpoints
            .map(function (b, i) { return _this._webKitConnection.debugger_setBreakpointByUrl(url, breakpoints.lines[i], breakpoints.cols ? breakpoints.cols[i] : 0, b.condition); });
        // Join all setBreakpoint requests to a single promise
        return Promise.all(responsePs);
    };
    WebKitDebugAdapter.prototype._webkitBreakpointResponsesToODPBreakpoints = function (url, responses, requestLines) {
        // Don't cache errored responses
        var committedBpIds = responses
            .filter(function (response) { return !response.error; })
            .map(function (response) { return response.result.breakpointId; });
        // Cache successfully set breakpoint ids from webkit in committedBreakpoints set
        this._committedBreakpointsByUrl.set(url, committedBpIds);
        // Map committed breakpoints to DebugProtocol response breakpoints
        return responses
            .map(function (response, i) {
            // The output list needs to be the same length as the input list, so map errors to
            // unverified breakpoints.
            if (response.error || !response.result.locations.length) {
                return {
                    verified: !response.error,
                    line: requestLines[i],
                    column: 0
                };
            }
            return {
                verified: true,
                line: response.result.locations[0].lineNumber,
                column: response.result.locations[0].columnNumber
            };
        });
    };
    WebKitDebugAdapter.prototype.setExceptionBreakpoints = function (args) {
        var state;
        if (args.filters.indexOf('all') >= 0) {
            state = 'all';
        }
        else if (args.filters.indexOf('uncaught') >= 0) {
            state = 'uncaught';
        }
        else {
            state = 'none';
        }
        return this._webKitConnection.debugger_setPauseOnExceptions(state)
            .then(function () { });
    };
    WebKitDebugAdapter.prototype.continue = function () {
        this._expectingResumedEvent = true;
        return this._webKitConnection.debugger_resume()
            .then(function () { });
    };
    WebKitDebugAdapter.prototype.next = function () {
        this._expectingResumedEvent = true;
        return this._webKitConnection.debugger_stepOver()
            .then(function () { });
    };
    WebKitDebugAdapter.prototype.stepIn = function () {
        this._expectingResumedEvent = true;
        return this._webKitConnection.debugger_stepIn()
            .then(function () { });
    };
    WebKitDebugAdapter.prototype.stepOut = function () {
        this._expectingResumedEvent = true;
        return this._webKitConnection.debugger_stepOut()
            .then(function () { });
    };
    WebKitDebugAdapter.prototype.pause = function () {
        return this._webKitConnection.debugger_pause()
            .then(function () { });
    };
    WebKitDebugAdapter.prototype.stackTrace = function (args) {
        var _this = this;
        // Only process at the requested number of frames, if 'levels' is specified
        var stack = this._currentStack;
        if (args.levels) {
            stack = this._currentStack.filter(function (_, i) { return i < args.levels; });
        }
        var stackFrames = stack
            .map(function (callFrame, i) {
            var sourceReference = scriptIdToSourceReference(callFrame.location.scriptId);
            var scriptId = callFrame.location.scriptId;
            var script = _this._scriptsById.get(scriptId);
            var source;
            if (_this.scriptIsNotUnknown(scriptId)) {
                // We have received Debugger.scriptParsed event for the script.
                if (_this.scriptIsNotAnonymous(script)) {
                    /**
                     * We have received non-empty url with the Debugger.scriptParsed event.
                     * We set the url value to the path property. Later on, the PathTransformer will attempt to resolve it to a script in the app root folder.
                     * In case it fails to resolve it, we also set the sourceReference field in order to allow the client to send source request to retrieve the source.
                     * If the PathTransformer resolves the url successfully, it will change the value of sourceReference to 0.
                     */
                    source = {
                        name: path.basename(script.url),
                        path: script.url,
                        sourceReference: scriptIdToSourceReference(script.scriptId) // will be 0'd out by PathTransformer if not needed
                    };
                }
                else {
                    /**
                     * We have received Debugger.scriptParsed event with empty url value.
                     * Sending only the sourceId will make the client to send source request to retrieve the source of the script.
                     */
                    source = {
                        name: 'anonymous source',
                        sourceReference: sourceReference
                    };
                }
            }
            else {
                /**
                 * Unknown script. No Debugger.scriptParsed event received for the script.
                 *
                 * Some 'internal scripts' are intentionally referenced by id equal to 0. Others have id > 0 but no Debugger.scriptParsed event is sent when parsed.
                 * In both cases we can't get its source code. If we send back a zero sourceReference the VS Code client will not send source request.
                 * The most we can do is to include a dummy stack frame with no source associated and without specifing the sourceReference.
                 */
                source = {
                    name: 'unknown source',
                    origin: 'internal module',
                    sourceReference: 0
                };
            }
            // If the frame doesn't have a function name, it's either an anonymous function
            // or eval script. If its source has a name, it's probably an anonymous function.
            var frameName = callFrame.functionName || (script && script.url ? '(anonymous function)' : '(eval code)');
            return {
                id: i,
                name: frameName,
                source: source,
                line: callFrame.location.lineNumber,
                column: callFrame.location.columnNumber
            };
        });
        return { stackFrames: stackFrames };
    };
    WebKitDebugAdapter.prototype.scopes = function (args) {
        var _this = this;
        var scopes = this._currentStack[args.frameId].scopeChain.map(function (scope, i) {
            var scopeHandle = { objectId: scope.object.objectId };
            if (i === 0) {
                // The first scope should include 'this'. Keep the RemoteObject reference for use by the variables request
                scopeHandle.thisObj = _this._currentStack[args.frameId]['this'];
            }
            return {
                name: scope.type,
                variablesReference: _this._variableHandles.create(scopeHandle),
                expensive: scope.type === 'global'
            };
        });
        return { scopes: scopes };
    };
    WebKitDebugAdapter.prototype.variables = function (args) {
        var _this = this;
        var handle = this._variableHandles.get(args.variablesReference);
        if (handle.objectId === WebKitDebugAdapter.EXCEPTION_VALUE_ID) {
            // If this is the special marker for an exception value, create a fake property descriptor so the usual route can be used
            var excValuePropDescriptor = { name: 'exception', value: this._exceptionValueObject };
            return Promise.resolve({ variables: [this.propertyDescriptorToVariable(excValuePropDescriptor)] });
        }
        else if (handle != null) {
            return Promise.all([
                // Need to make two requests to get all properties
                this._webKitConnection.runtime_getProperties(handle.objectId, /*ownProperties=*/ false, /*accessorPropertiesOnly=*/ true),
                this._webKitConnection.runtime_getProperties(handle.objectId, /*ownProperties=*/ true, /*accessorPropertiesOnly=*/ false)
            ]).then(function (getPropsResponses) {
                // Sometimes duplicates will be returned - merge all property descriptors returned
                var propsByName = new Map();
                getPropsResponses.forEach(function (response) {
                    if (!response.error) {
                        response.result.result.forEach(function (propDesc) {
                            return propsByName.set(propDesc.name, propDesc);
                        });
                    }
                });
                // Convert WebKitProtocol prop descriptors to DebugProtocol vars, sort the result
                var variables = [];
                propsByName.forEach(function (propDesc) { return variables.push(_this.propertyDescriptorToVariable(propDesc)); });
                variables.sort(function (var1, var2) { return var1.name.localeCompare(var2.name); });
                // If this is a scope that should have the 'this', prop, insert it at the top of the list
                if (handle.thisObj) {
                    variables.unshift(_this.propertyDescriptorToVariable({ name: 'this', value: handle.thisObj }));
                }
                return { variables: variables };
            });
        }
        else {
            return Promise.resolve();
        }
    };
    WebKitDebugAdapter.prototype.source = function (args) {
        return this._webKitConnection.debugger_getScriptSource(sourceReferenceToScriptId(args.sourceReference)).then(function (webkitResponse) {
            if (webkitResponse.error) {
                throw new Error(webkitResponse.error.message);
            }
            return { content: webkitResponse.result.scriptSource };
        });
    };
    WebKitDebugAdapter.prototype.threads = function () {
        return {
            threads: [
                {
                    id: WebKitDebugAdapter.THREAD_ID,
                    name: 'Thread ' + WebKitDebugAdapter.THREAD_ID
                }
            ]
        };
    };
    WebKitDebugAdapter.prototype.evaluate = function (args) {
        var _this = this;
        var evalPromise;
        if (this.paused) {
            var callFrame = this._currentStack[args.frameId];
            if (!this.scriptIsNotUnknown(callFrame.location.scriptId)) {
                // The iOS debugger backend hangs and stops responding after receiving evaluate request on call frame which has unknown source.
                throw new Error('-'); // The message will be printed in the VS Code UI
            }
            evalPromise = this._webKitConnection.debugger_evaluateOnCallFrame(callFrame.callFrameId, args.expression);
        }
        else {
            evalPromise = this._webKitConnection.runtime_evaluate(args.expression);
        }
        return evalPromise.then(function (evalResponse) {
            if (evalResponse.result.wasThrown) {
                var errorMessage = evalResponse.result.exceptionDetails ? evalResponse.result.exceptionDetails.text : 'Error';
                return utils.errP(errorMessage);
            }
            var _a = _this.remoteObjectToValue(evalResponse.result.result), value = _a.value, variablesReference = _a.variablesReference;
            return { result: value, variablesReference: variablesReference };
        });
    };
    WebKitDebugAdapter.prototype.propertyDescriptorToVariable = function (propDesc) {
        if (propDesc.get || propDesc.set) {
            // A property doesn't have a value here, and we shouldn't evaluate the getter because it may have side effects.
            // Node adapter shows 'undefined', Chrome can eval the getter on demand.
            return { name: propDesc.name, value: 'property', variablesReference: 0 };
        }
        else {
            var _a = this.remoteObjectToValue(propDesc.value), value = _a.value, variablesReference = _a.variablesReference;
            return { name: propDesc.name, value: value, variablesReference: variablesReference };
        }
    };
    /**
     * Run the object through Utilities.remoteObjectToValue, and if it returns a variableHandle reference,
     * use it with this instance's variableHandles to create a variable handle.
     */
    WebKitDebugAdapter.prototype.remoteObjectToValue = function (object) {
        var _a = utils.remoteObjectToValue(object), value = _a.value, variableHandleRef = _a.variableHandleRef;
        var result = { value: value, variablesReference: 0 };
        if (variableHandleRef) {
            result.variablesReference = this._variableHandles.create({ objectId: variableHandleRef });
        }
        return result;
    };
    // Returns true if the script has url supplied in Debugger.scriptParsed event
    WebKitDebugAdapter.prototype.scriptIsNotAnonymous = function (script) {
        return script && !!script.url;
    };
    // Returns true if Debugger.scriptParsed event is received for the provided script id
    WebKitDebugAdapter.prototype.scriptIsNotUnknown = function (scriptId) {
        return !!this._scriptsById.get(scriptId);
    };
    WebKitDebugAdapter.THREAD_ID = 1;
    WebKitDebugAdapter.EXCEPTION_VALUE_ID = 'EXCEPTION_VALUE_ID';
    return WebKitDebugAdapter;
}());
exports.WebKitDebugAdapter = WebKitDebugAdapter;
function scriptIdToSourceReference(scriptId) {
    return parseInt(scriptId, 10);
}
function sourceReferenceToScriptId(sourceReference) {
    return '' + sourceReference;
}
//# sourceMappingURL=webKitDebugAdapter.js.map