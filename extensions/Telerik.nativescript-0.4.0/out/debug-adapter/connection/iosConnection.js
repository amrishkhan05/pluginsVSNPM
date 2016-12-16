/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var net = require('net');
var stream = require('stream');
var events_1 = require('events');
var utils = require('../utilities');
var utilities_1 = require('../utilities');
var PacketStream = (function (_super) {
    __extends(PacketStream, _super);
    function PacketStream(opts) {
        _super.call(this, opts);
    }
    PacketStream.prototype._transform = function (packet, encoding, done) {
        while (packet.length > 0) {
            if (!this.buffer) {
                // read length
                var length_1 = packet.readInt32BE(0);
                this.buffer = new Buffer(length_1);
                this.offset = 0;
                packet = packet.slice(4);
            }
            packet.copy(this.buffer, this.offset);
            var copied = Math.min(this.buffer.length - this.offset, packet.length);
            this.offset += copied;
            packet = packet.slice(copied);
            if (this.offset === this.buffer.length) {
                this.push(this.buffer);
                this.buffer = undefined;
            }
        }
        done();
    };
    return PacketStream;
}(stream.Transform));
exports.PacketStream = PacketStream;
/**
 * Implements a Request/Response API on top of a Unix domain socket for messages that are marked with an `id` property.
 * Emits `message.method` for messages that don't have `id`.
 */
var ResReqTcpSocket = (function (_super) {
    __extends(ResReqTcpSocket, _super);
    function ResReqTcpSocket() {
        _super.apply(this, arguments);
        this._pendingRequests = new Map();
    }
    /**
     * Attach to the given filePath
     */
    ResReqTcpSocket.prototype.attach = function (filePath) {
        var _this = this;
        this._unixSocketAttached = new Promise(function (resolve, reject) {
            var unixSocket;
            try {
                unixSocket = net.createConnection(filePath);
                unixSocket.on('connect', function () {
                    resolve(unixSocket);
                });
                unixSocket.on('error', function (e) {
                    reject(e);
                });
                unixSocket.on('close', function () {
                    utilities_1.Logger.log('Unix socket closed');
                    _this.emit('close');
                });
                var packetsStream = new PacketStream();
                unixSocket.pipe(packetsStream);
                packetsStream.on('data', function (buffer) {
                    var packet = buffer.toString('utf16le');
                    utilities_1.Logger.log('From target: ' + packet);
                    _this.onMessage(JSON.parse(packet));
                });
            }
            catch (e) {
                // invalid url e.g.
                reject(e.message);
                return;
            }
        });
        return this._unixSocketAttached;
    };
    ResReqTcpSocket.prototype.close = function () {
        if (this._unixSocketAttached) {
            this._unixSocketAttached.then(function (socket) { return socket.destroy(); });
        }
    };
    /**
     * Send a message which must have an id. Ok to call immediately after attach. Messages will be queued until
     * the websocket actually attaches.
     */
    ResReqTcpSocket.prototype.sendMessage = function (message) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this._pendingRequests.set(message.id, resolve);
            _this._unixSocketAttached.then(function (socket) {
                var msgStr = JSON.stringify(message);
                utilities_1.Logger.log('To target: ' + msgStr);
                var encoding = "utf16le";
                var length = Buffer.byteLength(msgStr, encoding);
                var payload = new Buffer(length + 4);
                payload.writeInt32BE(length, 0);
                payload.write(msgStr, 4, length, encoding);
                socket.write(payload);
            });
        });
    };
    ResReqTcpSocket.prototype.onMessage = function (message) {
        if (message.id) {
            if (this._pendingRequests.has(message.id)) {
                // Resolve the pending request with this response
                this._pendingRequests.get(message.id)(message);
                this._pendingRequests.delete(message.id);
            }
            else {
                console.error("Got a response with id " + message.id + " for which there is no pending request, weird.");
            }
        }
        else if (message.method) {
            this.emit(message.method, message.params);
        }
    };
    return ResReqTcpSocket;
}(events_1.EventEmitter));
/**
 * Connects to a target supporting the webkit protocol and sends and receives messages
 */
var IosConnection = (function () {
    function IosConnection() {
        this._nextId = 1;
        this._socket = new ResReqTcpSocket();
    }
    IosConnection.prototype.on = function (eventName, eventHandler) {
        this._socket.on(eventName, eventHandler);
    };
    /**
     * Attach the underlying Unix socket
     */
    IosConnection.prototype.attach = function (filePath) {
        var _this = this;
        utilities_1.Logger.log('Attempting to attach to path ' + filePath);
        return utils.retryAsync(function () { return _this._attach(filePath); }, 6000)
            .then(function () {
            Promise.all([
                _this.sendMessage('Debugger.enable'),
                _this.sendMessage('Console.enable'),
                _this.sendMessage('Debugger.setBreakpointsActive', { active: true })
            ]);
        });
    };
    IosConnection.prototype._attach = function (filePath) {
        return this._socket.attach(filePath);
    };
    IosConnection.prototype.close = function () {
        this._socket.close();
    };
    IosConnection.prototype.debugger_setBreakpoint = function (location, condition) {
        return this.sendMessage('Debugger.setBreakpoint', { location: location, options: { condition: condition } });
    };
    IosConnection.prototype.debugger_setBreakpointByUrl = function (url, lineNumber, columnNumber, condition) {
        return this.sendMessage('Debugger.setBreakpointByUrl', { url: url, lineNumber: lineNumber, columnNumber: 0 /* a columnNumber different from 0 confuses the debugger */, options: { condition: condition } });
    };
    IosConnection.prototype.debugger_removeBreakpoint = function (breakpointId) {
        return this.sendMessage('Debugger.removeBreakpoint', { breakpointId: breakpointId });
    };
    IosConnection.prototype.debugger_stepOver = function () {
        return this.sendMessage('Debugger.stepOver');
    };
    IosConnection.prototype.debugger_stepIn = function () {
        return this.sendMessage('Debugger.stepInto');
    };
    IosConnection.prototype.debugger_stepOut = function () {
        return this.sendMessage('Debugger.stepOut');
    };
    IosConnection.prototype.debugger_resume = function () {
        return this.sendMessage('Debugger.resume');
    };
    IosConnection.prototype.debugger_pause = function () {
        return this.sendMessage('Debugger.pause');
    };
    IosConnection.prototype.debugger_evaluateOnCallFrame = function (callFrameId, expression, objectGroup, returnByValue) {
        if (objectGroup === void 0) { objectGroup = 'dummyObjectGroup'; }
        return this.sendMessage('Debugger.evaluateOnCallFrame', { callFrameId: callFrameId, expression: expression, objectGroup: objectGroup, returnByValue: returnByValue });
    };
    IosConnection.prototype.debugger_setPauseOnExceptions = function (state) {
        return this.sendMessage('Debugger.setPauseOnExceptions', { state: state });
    };
    IosConnection.prototype.debugger_getScriptSource = function (scriptId) {
        return this.sendMessage('Debugger.getScriptSource', { scriptId: scriptId });
    };
    IosConnection.prototype.runtime_getProperties = function (objectId, ownProperties, accessorPropertiesOnly) {
        return this.sendMessage('Runtime.getProperties', { objectId: objectId, ownProperties: ownProperties, accessorPropertiesOnly: accessorPropertiesOnly });
    };
    IosConnection.prototype.runtime_evaluate = function (expression, objectGroup, contextId, returnByValue) {
        if (objectGroup === void 0) { objectGroup = 'dummyObjectGroup'; }
        if (returnByValue === void 0) { returnByValue = false; }
        return this.sendMessage('Runtime.evaluate', { expression: expression, objectGroup: objectGroup, contextId: contextId, returnByValue: returnByValue });
    };
    IosConnection.prototype.sendMessage = function (method, params) {
        return this._socket.sendMessage({
            id: this._nextId++,
            method: method,
            params: params
        });
    };
    return IosConnection;
}());
exports.IosConnection = IosConnection;
//# sourceMappingURL=iosConnection.js.map