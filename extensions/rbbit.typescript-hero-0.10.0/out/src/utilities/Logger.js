"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
const ExtensionConfig_1 = require('../ExtensionConfig');
const inversify_1 = require('inversify');
const util = require('util');
const vscode_1 = require('vscode');
/**
 * Central logger instance of the extension.
 *
 * @export
 * @class Logger
 */
let Logger_1 = class Logger {
    constructor(context, config, prefix) {
        this.config = config;
        this.prefix = prefix;
        if (!Logger_1.channel) {
            Logger_1.channel = vscode_1.window.createOutputChannel('Typescript Hero Extension');
            context.subscriptions.push(Logger_1.channel);
        }
    }
    /**
     * Logs an error message. Provided data is logged out after the message.
     *
     * @param {string} message
     * @param {*} [data]
     *
     * @memberOf Logger
     */
    error(message, data) {
        this.log(1 /* Errors */, `ERROR\t ${message}`, data);
    }
    /**
     * Logs a warning message. Provided data is logged out after the message.
     *
     * @param {string} message
     * @param {*} [data]
     *
     * @memberOf Logger
     */
    warning(message, data) {
        this.log(2 /* Warnings */, `WARNING\t ${message}`, data);
    }
    /**
     * Logs an info message. Provided data is logged out after the message.
     *
     * @param {string} message
     * @param {*} [data]
     *
     * @memberOf Logger
     */
    info(message, data) {
        this.log(3 /* All */, `INFO\t ${message}`, data);
    }
    /**
     * Internal method to actually do the logging. Checks if the output should be done and logs
     * the data into the output channel and the console (if debugging).
     *
     * @private
     * @param {LogLevel} level
     * @param {string} message
     * @param {*} [data]
     *
     * @memberOf Logger
     */
    log(level, message, data) {
        if (this.config.logLevel >= level) {
            // tslint:disable-next-line
            console.log(`${this.prefix ? `${this.prefix}: ` : ''}${message}`, data);
            Logger_1.channel.appendLine(`${this.prefix ? `${this.prefix}: ` : ''}${message}`);
            if (data) {
                Logger_1.channel.appendLine(`\tData:\t${util.inspect(data, {})}`);
            }
        }
    }
};
let Logger = Logger_1;
Logger = Logger_1 = __decorate([
    inversify_1.injectable(), 
    __metadata('design:paramtypes', [Object, ExtensionConfig_1.ExtensionConfig, String])
], Logger);
exports.Logger = Logger;
