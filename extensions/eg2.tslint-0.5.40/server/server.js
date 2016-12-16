/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
'use strict';
const minimatch = require('minimatch');
const server = require('vscode-languageserver');
const fs = require('fs');
const vscFixLib = require('./vscFix');
const delayer_1 = require('./delayer');
class ID {
    static next() {
        return `${ID.base}${ID.counter++}`;
    }
}
ID.base = `${Date.now().toString()}-`;
ID.counter = 0;
function computeKey(diagnostic) {
    let range = diagnostic.range;
    return `[${range.start.line},${range.start.character},${range.end.line},${range.end.character}]-${diagnostic.code}`;
}
var Status;
(function (Status) {
    Status[Status["ok"] = 1] = "ok";
    Status[Status["warn"] = 2] = "warn";
    Status[Status["error"] = 3] = "error";
})(Status || (Status = {}));
var StatusNotification;
(function (StatusNotification) {
    StatusNotification.type = { get method() { return 'tslint/status'; } };
})(StatusNotification || (StatusNotification = {}));
let settings = null;
let linter = null;
let validationDelayer = Object.create(null); // key is the URI of the document
let tslintNotFound = `Failed to load tslint library. Please install tslint in your workspace
folder using \'npm install tslint\' or \'npm install -g tslint\' and then press Retry.`;
// Options passed to tslint
let options = {
    formatter: "json",
    configuration: {},
    rulesDirectory: undefined,
    formattersDirectory: undefined
};
let configFile = null;
let configFileWatcher = null;
let configCache = {
    filePath: null,
    configuration: null,
    isDefaultConfig: false
};
function makeDiagnostic(problem) {
    let message = (problem.ruleName !== null)
        ? `${problem.failure} (${problem.ruleName})`
        : `${problem.failure}`;
    let diagnostic = {
        severity: 2 /* Warning */,
        message: message,
        range: {
            start: {
                line: problem.startPosition.line,
                character: problem.startPosition.character
            },
            end: {
                line: problem.endPosition.line,
                character: problem.endPosition.character
            },
        },
        code: problem.ruleName,
        source: 'tslint'
    };
    return diagnostic;
}
let codeActions = Object.create(null);
/**
 * convert problem in diagnostic
 * add fix if availble fom vsc or tsl
 * in order to support migration (while not all users move to last version of tslint) and exceptional cases (where IDE information may needed) the rule is:
 *  - tsl fix as to be applier versys vsc fix
 *  - a part when vscFix.overrideTslFix = true
 *
 * !! this algo does not support several fixes provided by tslint engine. Only the first element of the innerReplacements array is used
 * !! let's improve when the case will be raised
 */
function recordCodeAction(document, diagnostic, problem) {
    let fixText = null;
    let fixStart;
    let fixEnd;
    // console.log("----------***************************", problem);
    // check tsl fix
    if (!!problem.fix) {
        fixText = problem.fix.innerReplacements[0].innerText;
        // fixStart = problem.fix.innerReplacements[0].innerStart;
        // fixEnd = problem.fix.innerReplacements[0].innerStart + problem.fix.innerReplacements[0].innerLength;
        fixStart = problem.startPosition;
        fixEnd = problem.endPosition;
    }
    //check vsc fix
    let vscFix = vscFixLib.vscFixes.filter(fix => fix.tsLintMessage.toLowerCase() === problem.failure.toLocaleLowerCase());
    if ((vscFix.length > 0)) {
        // not tslFix or vscFix.override
        if ((!problem.fix) || (vscFix[0].overrideTSLintFix)) {
            fixText = vscFix[0].autoFix(document.getText().slice(problem.startPosition.position, problem.endPosition.position));
            fixStart = problem.startPosition;
            fixEnd = problem.endPosition;
        }
    }
    if (fixText !== null) {
        // fix is defined
        // create an autoFixEntry for the document in the codeActions
        let uri = document.uri;
        let edits = codeActions[uri];
        if (!edits) {
            edits = Object.create(null);
            codeActions[uri] = edits;
        }
        /** temporary variable for debugging purpose
         * it's not possible to use console.log to trace the autofx rules.
         * so uncomment the following variable put a break point on the line and check in/out of autofix rules
        */
        // let debugCodeBefore = document.getText().slice(problem.startPosition.position, problem.endPosition.position);
        // let debugCodeAfter = afix[0].autoFix(document.getText().slice(problem.startPosition.position, problem.endPosition.position));
        edits[computeKey(diagnostic)] = {
            label: `Fix this "${problem.failure}" tslint warning?`,
            documentVersion: document.version,
            ruleId: problem.failure,
            edit: {
                range: [fixStart, fixEnd],
                //text: vscFix[0].autoFix(document.getText().slice(problem.startPosition.position, problem.endPosition.position))
                text: fixText
            }
        };
    }
}
function getConfiguration(filePath, configFileName) {
    if (configCache.configuration && configCache.filePath === filePath) {
        return configCache.configuration;
    }
    let isDefaultConfig = false;
    if (linter.findConfigurationPath) {
        isDefaultConfig = linter.findConfigurationPath(configFileName, filePath) === undefined;
    }
    configCache = {
        filePath: filePath,
        isDefaultConfig: isDefaultConfig,
        configuration: linter.findConfiguration(configFileName, filePath)
    };
    return configCache.configuration;
}
function flushConfigCache() {
    configCache = {
        filePath: null,
        configuration: null,
        isDefaultConfig: false
    };
}
function getErrorMessage(err, document) {
    let errorMessage = `unknown error`;
    if (typeof err.message === 'string' || err.message instanceof String) {
        errorMessage = err.message;
    }
    let fsPath = server.Files.uriToFilePath(document.uri);
    let message = `vscode-tslint: '${errorMessage}' while validating: ${fsPath} stacktrace: ${err.stack}`;
    return message;
}
function getConfigurationFailureMessage(err) {
    let errorMessage = `unknown error`;
    if (typeof err.message === 'string' || err.message instanceof String) {
        errorMessage = err.message;
    }
    return `vscode-tslint: Cannot read tslint configuration - '${errorMessage}'`;
}
function showConfigurationFailure(conn, err) {
    let message = getConfigurationFailureMessage(err);
    conn.window.showInformationMessage(message);
}
function validateAllTextDocuments(connection, documents) {
    let tracker = new server.ErrorMessageTracker();
    documents.forEach(document => {
        try {
            validateTextDocument(connection, document);
        }
        catch (err) {
            tracker.add(getErrorMessage(err, document));
        }
    });
    tracker.sendErrors(connection);
}
function validateTextDocument(connection, document) {
    try {
        let uri = document.uri;
        let diagnostics = doValidate(connection, document);
        connection.sendDiagnostics({ uri, diagnostics });
    }
    catch (err) {
        connection.window.showErrorMessage(getErrorMessage(err, document));
    }
}
let connection = server.createConnection(process.stdin, process.stdout);
let documents = new server.TextDocuments();
documents.listen(connection);
function trace(message, verbose) {
    connection.tracer.log(message, verbose);
}
connection.onInitialize((params) => {
    let rootFolder = params.rootPath;
    let initOptions = params.initializationOptions;
    let nodePath = initOptions ? (initOptions.nodePath ? initOptions.nodePath : undefined) : undefined;
    return server.Files.resolveModule2(rootFolder, 'tslint', nodePath, trace).
        then((value) => {
        linter = value;
        let result = { capabilities: { textDocumentSync: documents.syncKind, codeActionProvider: true } };
        return result;
    }, (error) => {
        // We only want to show the tslint load failed error, when the workspace is configured for tslint.
        // However, only tslint knows whether a config file exists, but since we cannot load it we cannot ask it.
        // For now we hard code a common case and only show the error in this case.
        if (fs.existsSync('tslint.json')) {
            return Promise.reject(new server.ResponseError(99, tslintNotFound, { retry: true }));
        }
        // Respond that initialization failed silently, without prompting the user.
        return Promise.reject(new server.ResponseError(100, null, // do not show an error message
        { retry: false }));
    });
});
function doValidate(conn, document) {
    let uri = document.uri;
    let diagnostics = [];
    // Clean previously computed code actions.
    delete codeActions[uri];
    let fsPath = server.Files.uriToFilePath(uri);
    if (!fsPath) {
        // tslint can only lint files on disk
        return diagnostics;
    }
    if (fileIsExcluded(fsPath)) {
        return diagnostics;
    }
    let contents = document.getText();
    try {
        options.configuration = getConfiguration(fsPath, configFile);
    }
    catch (err) {
        // this should not happen since we guard against incorrect configurations
        showConfigurationFailure(conn, err);
        return diagnostics;
    }
    if (settings && settings.tslint && settings.tslint.validateWithDefaultConfig === false && configCache.isDefaultConfig) {
        return diagnostics;
    }
    if (configCache.isDefaultConfig && settings.tslint.validateWithDefaultConfig === false) {
        return;
    }
    let result;
    try {
        let tslint = new linter(fsPath, contents, options);
        result = tslint.lint();
    }
    catch (err) {
        // TO DO show an indication in the workbench
        conn.console.info(getErrorMessage(err, document));
        connection.sendNotification(StatusNotification.type, { state: Status.error });
        return diagnostics;
    }
    if (result.failureCount > 0) {
        let lintProblems = JSON.parse(result.output);
        lintProblems.forEach(problem => {
            let diagnostic = makeDiagnostic(problem);
            diagnostics.push(diagnostic);
            recordCodeAction(document, diagnostic, problem);
        });
    }
    connection.sendNotification(StatusNotification.type, { state: Status.ok });
    return diagnostics;
}
function fileIsExcluded(path) {
    function testForExclusionPattern(path, pattern) {
        return minimatch(path, pattern);
    }
    if (settings && settings.tslint) {
        if (settings.tslint.ignoreDefinitionFiles) {
            if (minimatch(path, "**/*.d.ts")) {
                return true;
            }
        }
        if (settings.tslint.exclude) {
            if (Array.isArray(settings.tslint.exclude)) {
                for (let pattern of settings.tslint.exclude) {
                    if (testForExclusionPattern(path, pattern)) {
                        return true;
                    }
                }
            }
            else if (testForExclusionPattern(path, settings.tslint.exclude)) {
                return true;
            }
        }
    }
}
// A text document has changed. Validate the document.
documents.onDidChangeContent((event) => {
    if (settings.tslint.run === 'onType') {
        triggerValidateDocument(event.document);
    }
});
documents.onDidSave((event) => {
    if (settings.tslint.run === 'onSave') {
        triggerValidateDocument(event.document);
    }
});
// A text document was closed. Clear the diagnostics .
documents.onDidClose((event) => {
    connection.sendDiagnostics({ uri: event.document.uri, diagnostics: [] });
});
function triggerValidateDocument(document) {
    let d = validationDelayer[document.uri];
    if (!d) {
        d = new delayer_1.Delayer(200);
        validationDelayer[document.uri] = d;
    }
    d.trigger(() => {
        validateTextDocument(connection, document);
        delete validationDelayer[document.uri];
    });
}
function tslintConfigurationValid() {
    try {
        documents.all().forEach((each) => {
            let fsPath = server.Files.uriToFilePath(each.uri);
            if (fsPath) {
                getConfiguration(fsPath, configFile);
            }
        });
    }
    catch (err) {
        connection.console.info(getConfigurationFailureMessage(err));
        connection.sendNotification(StatusNotification.type, { state: Status.error });
        return false;
    }
    return true;
}
// The VS Code tslint settings have changed. Revalidate all documents.
connection.onDidChangeConfiguration((params) => {
    flushConfigCache();
    settings = params.settings;
    if (settings.tslint) {
        options.rulesDirectory = settings.tslint.rulesDirectory || null;
        let newConfigFile = settings.tslint.configFile || null;
        if (configFile !== newConfigFile) {
            if (configFileWatcher) {
                configFileWatcher.close();
                configFileWatcher = null;
            }
            if (!fs.existsSync(newConfigFile)) {
                connection.window.showWarningMessage(`The file ${newConfigFile} refered to by 'tslint.configFile' does not exist`);
                configFile = null;
                return;
            }
            configFile = newConfigFile;
            if (configFile) {
                configFileWatcher = fs.watch(configFile, { persistent: false }, (event, fileName) => {
                    validateAllTextDocuments(connection, documents.all());
                });
            }
        }
    }
    validateAllTextDocuments(connection, documents.all());
});
// The watched tslint.json has changed. Revalidate all documents, IF the configuration is valid.
connection.onDidChangeWatchedFiles((params) => {
    // Tslint 3.7 started to load configuration files using 'require' and they are now
    // cached in the node module cache. To ensure that the extension uses
    // the latest configuration file we remove the config file from the module cache.
    params.changes.forEach(element => {
        let configFilePath = server.Files.uriToFilePath(element.uri);
        let cached = require.cache[configFilePath];
        if (cached) {
            delete require.cache[configFilePath];
        }
    });
    flushConfigCache();
    if (tslintConfigurationValid()) {
        validateAllTextDocuments(connection, documents.all());
    }
});
connection.onCodeAction((params) => {
    let result = [];
    let uri = params.textDocument.uri;
    let edits = codeActions[uri];
    let documentVersion = -1;
    let ruleId;
    // function createTextEdit(editInfo: AutoFix): server.TextEdit {
    // 	return server.TextEdit.replace(
    // 		server.Range.create(
    // 			editInfo.edit.range[0],
    // 			editInfo.edit.range[1]),
    // 		editInfo.edit.text || '');
    // }
    if (edits) {
        for (let diagnostic of params.context.diagnostics) {
            let key = computeKey(diagnostic);
            let editInfo = edits[key];
            if (editInfo) {
                documentVersion = editInfo.documentVersion;
                ruleId = editInfo.ruleId;
                result.push(server.Command.create(editInfo.label, 'tslint.applySingleFix', uri, documentVersion, [
                    createTextEdit(editInfo)
                ]));
            }
        }
        if (result.length > 0) {
            let same = [];
            let all = [];
            let fixes = Object.keys(edits).map(key => edits[key]);
            // TODO from eslint: why? order the fixes for? overlap?
            // fixes = fixes.sort((a, b) => {
            // 	let d = a.edit.range[0] - b.edit.range[0];
            // 	if (d !== 0) {
            // 		return d;
            // 	}
            // 	if (a.edit.range[1] === 0) {
            // 		return -1;
            // 	}
            // 	if (b.edit.range[1] === 0) {
            // 		return 1;
            // 	}
            // 	return a.edit.range[1] - b.edit.range[1];
            // });
            for (let editInfo of fixes) {
                if (documentVersion === -1) {
                    documentVersion = editInfo.documentVersion;
                }
                if (editInfo.ruleId === ruleId && !overlaps(getLastEdit(same), editInfo)) {
                    same.push(editInfo);
                }
                if (!overlaps(getLastEdit(all), editInfo)) {
                    all.push(editInfo);
                }
            }
            // if there several time the same rule identified => propose to fix all
            if (same.length > 1) {
                result.push(server.Command.create(`Fix all "${same[0].ruleId}" tslint warnings?`, 'tslint.applySameFixes', uri, documentVersion, same.map(createTextEdit)));
            }
            // propose to fix all
            if (all.length > 1) {
                result.push(server.Command.create(`Fix all auto-fixable problems`, 'tslint.applyAllFixes', uri, documentVersion, all.map(createTextEdit)));
            }
        }
    }
    return result;
});
// check if there are fixes overlaps
function overlaps(lastEdit, newEdit) {
    return !!lastEdit && lastEdit.edit.range[1] > newEdit.edit.range[0];
}
function getLastEdit(array) {
    let length = array.length;
    if (length === 0) {
        return undefined;
    }
    return array[length - 1];
}
function createTextEdit(editInfo) {
    return server.TextEdit.replace(server.Range.create(editInfo.edit.range[0], editInfo.edit.range[1]), editInfo.edit.text || '');
}
var AllFixesRequest;
(function (AllFixesRequest) {
    AllFixesRequest.type = { get method() { return 'textDocument/tslint/allFixes'; } };
})(AllFixesRequest || (AllFixesRequest = {}));
connection.onRequest(AllFixesRequest.type, (params) => {
    let result = null;
    let uri = params.textDocument.uri;
    let edits = codeActions[uri];
    let documentVersion = -1;
    if (!edits) {
        return null;
    }
    // retrive document version
    let fixes = Object.keys(edits).map(key => edits[key]);
    for (let fix of fixes) {
        if (documentVersion === -1) {
            documentVersion = fix.documentVersion;
            break;
        }
    }
    // convert autoFix in textEdits
    // let textEdits: server.TextEdit[] = fixes.map((fix) => {
    // 	let range  = server.Range.create(fix.edit.range[0], fix.edit.range[1]);
    // 	return server.TextEdit.replace( range , fix.edit.text);
    // });
    let textEdits = fixes.map(createTextEdit);
    result = {
        documentVersion: documentVersion,
        edits: textEdits
    };
    return result;
});
connection.listen();
//# sourceMappingURL=server.js.map