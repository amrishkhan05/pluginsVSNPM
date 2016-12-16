"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var http = require('http');
var events_1 = require('events');
var utilities_1 = require('../utilities');
var Net = require('net');
var Callbacks = (function () {
    function Callbacks() {
        this.lastId = 1;
        this.callbacks = {};
    }
    Callbacks.prototype.wrap = function (callback) {
        var callbackId = this.lastId++;
        this.callbacks[callbackId] = callback || function () { };
        return callbackId;
    };
    Callbacks.prototype.processResponse = function (callbackId, args) {
        var callback = this.callbacks[callbackId];
        if (callback) {
            callback.apply(null, args);
        }
        delete this.callbacks[callbackId];
    };
    Callbacks.prototype.removeResponseCallbackEntry = function (callbackId) {
        delete this.callbacks[callbackId];
    };
    return Callbacks;
}());
var ResReqNetSocket = (function (_super) {
    __extends(ResReqNetSocket, _super);
    function ResReqNetSocket() {
        _super.apply(this, arguments);
        this._pendingRequests = new Map();
        this.connected = false;
        this.debugBuffer = '';
        this.msg = false;
        this.isMessageFlushLoopStarted = false;
        this.hasNewDataMessage = false;
    }
    ResReqNetSocket.prototype.attach = function (port, url, timeout) {
        if (timeout === void 0) { timeout = 10000; }
        var that = this;
        this.callbacks = new Callbacks();
        return new Promise(function (resolve, reject) {
            that.conn = Net.createConnection(port, url),
                that.conn.setEncoding('utf8');
            setTimeout(function () {
                reject('Connection timed out');
            }, timeout);
            that.conn.on('error', reject);
            that.conn.on('connect', function () {
                // Replace the promise-rejecting handler
                that.conn.removeListener('error', reject);
                that.conn.on('error', function (e) {
                    console.error('socket error: ' + e.toString());
                    if (e.code == 'ECONNREFUSED') {
                        e.helpString = 'Is node running with --debug port ' + port + '?';
                    }
                    else if (e.code == 'ECONNRESET') {
                        e.helpString = 'Check there is no other debugger client attached to port ' + port + '.';
                    }
                    that.lastError = e.toString();
                    if (e.helpString) {
                        that.lastError += '. ' + e.helpString;
                    }
                    that.emit('error', e);
                });
                that.conn.on('data', function (data) {
                    that.debugBuffer += data;
                    that.parse(function () {
                        that.connected = true;
                        that.emit('connect');
                        resolve();
                    });
                });
                that.conn.on('end', function () {
                    that.close();
                });
                that.conn.on('close', function () {
                    if (!that.connected) {
                        reject("Can't connect. Check the application is running on the device");
                        that.emit('close', that.lastError || 'Debugged process exited.');
                        return;
                    }
                    that.connected = false;
                    that.emit('close', that.lastError || 'Debugged process exited.');
                });
            });
        });
    };
    ResReqNetSocket.prototype.makeMessage = function () {
        return {
            headersDone: false,
            headers: null,
            contentLength: 0
        };
    };
    ResReqNetSocket.prototype.parse = function (connectedCallback) {
        var b, obj;
        var that = this;
        if (this.msg && this.msg.headersDone) {
            //parse body
            if (Buffer.byteLength(this.debugBuffer) >= this.msg.contentLength) {
                b = new Buffer(this.debugBuffer);
                this.msg.body = b.toString('utf8', 0, this.msg.contentLength);
                this.debugBuffer = b.toString('utf8', this.msg.contentLength, b.length);
                if (this.msg.body.length > 0) {
                    obj = JSON.parse(this.msg.body);
                    utilities_1.Logger.log('From target(' + (obj.type ? obj.type : '') + '): ' + this.msg.body);
                    if (typeof obj.running === 'boolean') {
                        this.isRunning = obj.running;
                    }
                    if (obj.type === 'response' && obj.request_seq > 0) {
                        this.callbacks.processResponse(obj.request_seq, [obj]);
                    }
                    else if (obj.type === 'event') {
                        if (obj.event === "afterCompile") {
                            if (!that.connected && connectedCallback) {
                                connectedCallback();
                            }
                        }
                        this.emit(obj.event, obj);
                    }
                }
                this.msg = false;
                this.parse(connectedCallback);
            }
            return;
        }
        if (!this.msg) {
            this.msg = this.makeMessage();
        }
        this.offset = this.debugBuffer.indexOf('\r\n\r\n');
        if (this.offset > 0) {
            this.msg.headersDone = true;
            this.msg.headers = this.debugBuffer.substr(0, this.offset + 4);
            this.contentLengthMatch = /Content-Length: (\d+)/.exec(this.msg.headers);
            if (this.contentLengthMatch[1]) {
                this.msg.contentLength = parseInt(this.contentLengthMatch[1], 10);
            }
            else {
                console.warn('no Content-Length');
            }
            this.debugBuffer = this.debugBuffer.slice(this.offset + 4);
            this.parse(connectedCallback);
        }
    };
    ResReqNetSocket.prototype.send = function (data) {
        var _this = this;
        if (this.connected) {
            utilities_1.Logger.log('To target: ' + data);
            this.conn.write('Content-Length: ' + data.length + '\r\n\r\n' + data);
            this.hasNewDataMessage = true;
            if (!this.isMessageFlushLoopStarted) {
                this.isMessageFlushLoopStarted = true;
                setInterval(function () {
                    if (_this.hasNewDataMessage) {
                        var msg = 'FLUSH BUFFERS';
                        _this.conn.write('Content-Length: ' + msg.length + '\r\n\r\n' + msg);
                        _this.hasNewDataMessage = false;
                    }
                }, 200);
            }
        }
    };
    ResReqNetSocket.prototype.request = function (command, params, callback) {
        var msg = {
            seq: 0,
            type: 'request',
            command: command
        };
        if (typeof callback == 'function') {
            msg.seq = this.callbacks.wrap(callback);
        }
        if (params) {
            Object.keys(params).forEach(function (key) {
                msg[key] = params[key];
            });
        }
        this.send(JSON.stringify(msg));
    };
    ResReqNetSocket.prototype.close = function () {
        if (this.conn) {
            this.conn.end();
        }
    };
    return ResReqNetSocket;
}(events_1.EventEmitter));
var AndroidConnection = (function () {
    function AndroidConnection() {
        this._nextId = 1;
        //this._socket = new ResReqWebSocket();
        var that = this;
        this._socket = new ResReqNetSocket();
        this._socket.on("afterCompile", function (params) {
            var scriptData = {
                scriptId: String(params.body.script.id),
                url: params.body.script.name,
                startLine: params.body.script.lineOffset,
                startColumn: params.body.script.columnOffset
            };
            that._socket.emit("Debugger.scriptParsed", scriptData);
        });
        this._socket.on("break", function (params) {
            that.handleBreakEvent(params);
        });
        this._socket.on("exception", function (params) {
            that.handleBreakEvent(params);
        });
        this._socket.on("messageAdded", function (params) {
            that._socket.emit("Console.messageAdded", params.body);
        });
    }
    AndroidConnection.prototype.handleBreakEvent = function (params) {
        var that = this;
        return this.fetchCallFrames().then(function (callFrames) {
            var scriptData = {
                reason: "other",
                hitBreakpoints: params ? (params.breakpoints || []) : [],
                callFrames: callFrames
            };
            that._socket.emit("Debugger.paused", scriptData);
        });
    };
    AndroidConnection.prototype.v8ScopeTypeToString = function (v8ScopeType) {
        switch (v8ScopeType) {
            case 0:
                return 'global';
            case 1:
                return 'local';
            case 2:
                return 'with';
            case 3:
                return 'closure';
            case 4:
                return 'catch';
            default:
                return 'unknown';
        }
    };
    AndroidConnection.prototype.v8ResultToInspectorResult = function (result) {
        if (['object', 'function', 'regexp', 'error'].indexOf(result.type) > -1) {
            return this.v8RefToInspectorObject(result);
        }
        if (result.type == 'null') {
            // workaround for the problem with front-end's setVariableValue
            // implementation not preserving null type
            result.value = null;
        }
        return {
            type: result.type,
            value: result.value,
            description: String(result.value)
        };
    };
    AndroidConnection.prototype.inspectorUrlToV8Name = function (url) {
        var path = url.replace(/^file:\/\//, '');
        if (/^\/[a-zA-Z]:\//.test(path))
            return path.substring(1).replace(/\//g, '\\'); // Windows disk path
        if (/^\//.test(path))
            return path; // UNIX-style
        if (/^file:\/\//.test(url))
            return '\\\\' + path.replace(/\//g, '\\'); // Windows UNC path
        return url;
    };
    ;
    AndroidConnection.prototype.v8LocationToInspectorLocation = function (v8loc) {
        return {
            scriptId: v8loc.script_id.toString(),
            lineNumber: v8loc.line,
            columnNumber: v8loc.column
        };
    };
    ;
    AndroidConnection.prototype.v8RefToInspectorObject = function (ref) {
        var desc = '', type = ref.type, size, name, objectId;
        switch (type) {
            case 'object':
                name = /#<(\w+)>/.exec(ref.text);
                if (name && name.length > 1) {
                    desc = name[1];
                    if (desc === 'Array' || desc === 'Buffer') {
                        size = ref.properties.filter(function (p) { return /^\d+$/.test(p.name); }).length;
                        desc += '[' + size + ']';
                    }
                }
                else if (ref.className === 'Date') {
                    desc = new Date(ref.value).toString();
                    type = 'date';
                }
                else {
                    desc = ref.className || 'Object';
                }
                break;
            case 'function':
                desc = ref.text || 'function()';
                break;
            case 'error':
                type = 'object';
                desc = ref.text || 'Error';
                break;
            default:
                desc = ref.text || '';
                break;
        }
        if (desc.length > 100) {
            desc = desc.substring(0, 100) + '\u2026';
        }
        objectId = ref.handle;
        if (objectId === undefined)
            objectId = ref.ref;
        return {
            type: type,
            objectId: String(objectId),
            className: ref.className,
            description: desc
        };
    };
    AndroidConnection.prototype.v8ErrorToInspectorError = function (message) {
        var nameMatch = /^([^:]+):/.exec(message);
        return {
            type: 'object',
            objectId: 'ERROR',
            className: nameMatch ? nameMatch[1] : 'Error',
            description: message
        };
    };
    ;
    AndroidConnection.prototype.fetchCallFrames = function () {
        var that = this;
        return this.request("backtrace", {
            inlineRefs: true,
            fromFrame: 0,
            toFrame: 50
        })
            .then(function (response) {
            var debuggerFrames = response.frames || [];
            var frames = debuggerFrames.map(function (frame) {
                var scopeChain = frame.scopes.map(function (scope) {
                    return {
                        object: {
                            type: 'object',
                            objectId: 'scope:' + frame.index + ':' + scope.index,
                            className: 'Object',
                            description: 'Object'
                        },
                        type: that.v8ScopeTypeToString(scope.type)
                    };
                });
                return {
                    callFrameId: frame.index.toString(),
                    functionName: frame.func.inferredName || frame.func.name,
                    location: {
                        scriptId: String(frame.func.scriptId),
                        lineNumber: frame.line,
                        columnNumber: frame.column
                    },
                    scopeChain: scopeChain,
                    this: that.v8RefToInspectorObject(frame.receiver)
                };
            });
            return frames;
        });
    };
    AndroidConnection.prototype.on = function (eventName, handler) {
        this._socket.on(eventName, handler);
    };
    AndroidConnection.prototype.attach = function (port, url) {
        utilities_1.Logger.log('Attempting to attach on port ' + port);
        return this._attach(port, url);
        //.then(() => this.sendMessage('Console.enable'))
    };
    AndroidConnection.prototype._attach = function (port, url) {
        return this._socket.attach(port, url);
    };
    AndroidConnection.prototype.close = function () {
        this._socket.close();
    };
    AndroidConnection.prototype.debugger_setBreakpointByUrl = function (url, lineNumber, columnNumber, condition) {
        //throw new Error("Not implemented");
        //return this.sendMessage('Debugger.setBreakpointByUrl', <WebKitProtocol.Debugger.SetBreakpointByUrlParams>{ url, lineNumber, columnNumber });
        var that = this;
        var requestParams = {
            type: 'script',
            target: that.inspectorUrlToV8Name(url),
            line: lineNumber,
            column: columnNumber,
            condition: condition
        };
        return this.request("setbreakpoint", requestParams)
            .then(function (response) {
            return {
                result: {
                    breakpointId: response.breakpoint.toString(),
                    locations: response.actual_locations.map(that.v8LocationToInspectorLocation),
                },
            };
        });
    };
    AndroidConnection.prototype.debugger_removeBreakpoint = function (breakpointId) {
        //throw new Error("Not implemented");
        //return this.sendMessage('Debugger.removeBreakpoint', <WebKitProtocol.Debugger.RemoveBreakpointParams>{ breakpointId });
        //ok
        return this.request("clearbreakpoint", {
            breakpoint: breakpointId
        })
            .then(function (response) {
            return {};
        });
    };
    AndroidConnection.prototype.debugger_stepOver = function () {
        //throw new Error("Not implemented");
        //return this.sendMessage('Debugger.stepOver');
        //locations: response.actual_locations.map(that.v8LocationToInspectorLocation)
        return this.sendContinue('next').then(function (reponse) {
            return {};
        });
        //ok
    };
    AndroidConnection.prototype.sendContinue = function (stepAction) {
        var that = this;
        var args = stepAction ? { stepaction: stepAction } : undefined;
        return this.request("continue", args).then(function (response) {
            that._socket.emit("'Debugger.resumed");
            return response;
        });
    };
    AndroidConnection.prototype.debugger_stepIn = function () {
        //return this.sendMessage('Debugger.stepInto');
        //throw new Error("Not implemented");
        //ok
        return this.sendContinue('in').then(function (reponse) {
            return {};
        });
    };
    AndroidConnection.prototype.debugger_stepOut = function () {
        //return this.sendMessage('Debugger.stepOut');
        //throw new Error("Not implemented");
        //ok
        return this.sendContinue('out').then(function (reponse) {
            return {};
        });
    };
    AndroidConnection.prototype.debugger_resume = function () {
        //return this.sendMessage('Debugger.resume');
        //throw new Error("Not implemented");
        //ok
        return this.sendContinue(null).then(function (reponse) {
            return {};
        });
    };
    AndroidConnection.prototype.debugger_pause = function () {
        //return this.sendMessage('Debugger.pause');
        //throw new Error("Not implemented");
        //ok
        var that = this;
        return this.request("suspend", {})
            .then(function (reponse) { return that.handleBreakEvent(null); });
        // .then(reponse => {
        //     return <WebKitProtocol.Response>{};
        // });
    };
    AndroidConnection.prototype.debugger_evaluateOnCallFrame = function (callFrameId, expression, objectGroup, returnByValue) {
        //return this.sendMessage('Debugger.evaluateOnCallFrame', <WebKitProtocol.Debugger.EvaluateOnCallFrameParams>{ callFrameId, expression, objectGroup, returnByValue });
        //throw new Error("Not implemented");
        if (objectGroup === void 0) { objectGroup = 'dummyObjectGroup'; }
        var requestParams = {
            expression: expression,
            frame: callFrameId
        };
        var messageId = this._nextId++;
        var that = this;
        return this.request("evaluate", requestParams).then(function (response) {
            return {
                result: {
                    result: that.v8ResultToInspectorResult(response),
                    wasThrown: false
                }
            };
        });
    };
    AndroidConnection.prototype.debugger_setPauseOnExceptions = function (state) {
        //return this.sendMessage('Debugger.setPauseOnExceptions', <WebKitProtocol.Debugger.SetPauseOnExceptionsParams>{ state });
        var requestParams = {
            type: state !== 'none' ? state : "uncaught",
            enabled: state !== 'none'
        };
        var messageId = this._nextId++;
        return this.request("setexceptionbreak", requestParams).then(function (response) {
            return new Promise(function (resolve, reject) {
                if (response.error) {
                    reject(response.error);
                    return;
                }
                resolve({ id: messageId });
            });
        });
    };
    AndroidConnection.prototype.debugger_getScriptSource = function (scriptId) {
        //return this.sendMessage('Debugger.getScriptSource', //<WebKitProtocol.Debugger.GetScriptSourceParams>{ scriptId });
        var requestParams = {
            includeSource: true,
            types: 4,
            ids: [Number(scriptId)]
        };
        var messageId = this._nextId++;
        return this.request("scripts", requestParams).then(function (response) {
            return new Promise(function (resolve, reject) {
                if (response.error) {
                    reject(response.error);
                    return;
                }
                var source = undefined;
                if (Array.isArray(response)) {
                    source = response[0].source;
                }
                else if (response.result) {
                    source = response.result[0].source;
                }
                else if (response.source) {
                    source = response.source;
                }
                var result = {
                    id: messageId,
                    result: {
                        scriptSource: source
                    }
                };
                resolve(result);
            });
        });
    };
    AndroidConnection.prototype.request = function (command, args) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this._socket.request(command, { arguments: args }, function (response) {
                if (!response.success) {
                    reject(new Error(response.message));
                    return;
                }
                if (response.refs) {
                    var refsLookup_1 = {};
                    response.refs.forEach(function (r) { refsLookup_1[r.handle] = r; });
                    //TODO: response.body may be undefined in that case set it to {} here
                    response.body.refsLookup = refsLookup_1;
                }
                resolve(response.body);
            });
        });
    };
    ////getProperties Functions. Implementation in RuntimeAgent.js
    AndroidConnection.prototype.runtime_getProperties = function (objectId, ownProperties, accessorPropertiesOnly) {
        //return this.sendMessage('Runtime.getProperties', <WebKitProtocol.Runtime.GetPropertiesParams>{ objectId, ownProperties, accessorPropertiesOnly });
        //throw new Error("Not implemented");
        var _this = this;
        return this.isScopeId(objectId).then(function (response) {
            if (response) {
                return _this.getPropertiesOfScopeId(objectId);
            }
            else {
                if (!ownProperties || accessorPropertiesOnly) {
                    // Temporary fix for missing getInternalProperties() implementation
                    // See the comment in RuntimeAgent.js->getProperties and GH issue #213 (node-inspector repo)
                    return { result: [] };
                }
                return _this.getPropertiesOfObjectId(objectId);
            }
        }).then(function (response) {
            var properties = response.result;
            var result = [];
            for (var i = 0; properties && i < properties.length; ++i) {
                var property = properties[i];
                //convert the result to <WebKitProtocol.Runtime.PropertyDescriptor>
                result.push({
                    name: property.name,
                    writeable: property.writable,
                    enumerable: property.enumerable,
                    value: property.value
                });
            }
            return {
                result: {
                    result: result
                }
            };
        });
    };
    AndroidConnection.prototype.isScopeId = function (objectId) {
        var SCOPE_ID_MATCHER = /^scope:(\d+):(\d+)$/;
        return Promise.resolve(SCOPE_ID_MATCHER.test(objectId));
    };
    AndroidConnection.prototype.getPropertiesOfScopeId = function (scopeId) {
        var SCOPE_ID_MATCHER = /^scope:(\d+):(\d+)$/;
        var scopeIdMatch = SCOPE_ID_MATCHER.exec(scopeId);
        if (!scopeIdMatch) {
            return Promise.reject(new Error('Invalid scope id "' + scopeId + '"'));
        }
        var that = this;
        return this.request("scope", {
            number: Number(scopeIdMatch[2]),
            frameNumber: Number(scopeIdMatch[1])
        })
            .then(function (response) {
            return response.object.ref;
        }).then(function (response) {
            return that.getPropertiesOfObjectId(response);
        });
    };
    ;
    AndroidConnection.prototype.getPropertiesOfObjectId = function (objectId) {
        var handle = parseInt(objectId, 10);
        var request = { handles: [handle], includeSource: false };
        var that = this;
        return this.request("lookup", request)
            .then(function (response) {
            var obj;
            var proto;
            var props;
            obj = response[handle];
            proto = obj.proto;
            props = obj.properties;
            if (props) {
                props = props.map(function (p) {
                    var ref = response.refsLookup[p.ref];
                    return {
                        name: String(p.name),
                        writable: (p.attributes & 1) != 1,
                        enumerable: (p.attributes & 2) != 2,
                        value: that.v8ResultToInspectorResult(ref)
                    };
                });
            }
            if (proto)
                props.push({
                    name: '__proto__',
                    value: that.v8RefToInspectorObject(response.refsLookup[proto.ref])
                });
            return { result: props };
        });
    };
    ////getProperties Functions END
    AndroidConnection.prototype.runtime_evaluate = function (expression, objectGroup, contextId, returnByValue) {
        if (objectGroup === void 0) { objectGroup = 'dummyObjectGroup'; }
        if (returnByValue === void 0) { returnByValue = false; }
        //return this.sendMessage('Runtime.evaluate', <WebKitProtocol.Runtime.EvaluateParams>{ expression, objectGroup, contextId, returnByValue });
        throw new Error("Not implemented");
    };
    return AndroidConnection;
}());
exports.AndroidConnection = AndroidConnection;
/**
 * Helper function to GET the contents of a url
 */
function getUrl(url) {
    return new Promise(function (resolve, reject) {
        http.get(url, function (response) {
            var jsonResponse = '';
            response.on('data', function (chunk) { return jsonResponse += chunk; });
            response.on('end', function () {
                resolve(jsonResponse);
            });
        }).on('error', function (e) {
            reject('Cannot connect to the target: ' + e.message);
        });
    });
}
//# sourceMappingURL=androidConnection.js.map