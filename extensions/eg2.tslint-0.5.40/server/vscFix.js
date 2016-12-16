"use strict";
exports.vscFixes = [];
/**
 * AutoFix rules are all in this file
 * each autoFix should support the interface TsLintAutoFix and added in this.tsLintAutoFixes
 *
 * the key to map tsLint problem and autofix rules is => tsLintMessage
 */
let vscFix;
vscFix = {
    tsLintMessage: "missing whitespace",
    autoFix: (codeBefore) => {
        let codeAfter = " " + codeBefore;
        return codeAfter;
    },
    overrideTSLintFix: false
};
this.vscFixes.push(vscFix);
vscFix = {
    tsLintMessage: "Missing semicolon",
    autoFix: (codeBefore) => {
        let codeAfter = codeBefore + ";";
        return codeAfter;
    },
    overrideTSLintFix: false
};
this.vscFixes.push(vscFix);
vscFix = {
    tsLintMessage: "missing trailing comma",
    autoFix: (codeBefore) => {
        let codeAfter = codeBefore + ",";
        return codeAfter;
    },
    overrideTSLintFix: false
};
this.vscFixes.push(vscFix);
vscFix = {
    tsLintMessage: "' should be \"",
    autoFix: (codeBefore) => {
        let codeAfter = "\"" + codeBefore.slice(1, codeBefore.length - 1) + "\"";
        return codeAfter;
    },
    overrideTSLintFix: false
};
this.vscFixes.push(vscFix);
vscFix = {
    tsLintMessage: "\" should be '",
    autoFix: (codeBefore) => {
        let codeAfter = "'" + codeBefore.slice(1, codeBefore.length - 1) + "'";
        return codeAfter;
    },
    overrideTSLintFix: false
};
this.vscFixes.push(vscFix);
vscFix = {
    tsLintMessage: "trailing whitespace",
    autoFix: (codeBefore) => {
        let codeAfter = "";
        return codeAfter;
    },
    overrideTSLintFix: false
};
this.vscFixes.push(vscFix);
vscFix = {
    tsLintMessage: "tab indentation expected",
    autoFix: (codeBefore) => {
        let howManySpaces = codeBefore.length;
        let codeAfter = Array(Math.round(howManySpaces / 4) + 1).join(" ");
        return codeAfter;
    },
    overrideTSLintFix: false
};
this.vscFixes.push(vscFix);
vscFix = {
    tsLintMessage: "space indentation expected",
    autoFix: (codeBefore) => {
        let howManyTabs = codeBefore.length;
        let codeAfter = Array(howManyTabs + 1).join("	");
        return codeAfter;
    },
    overrideTSLintFix: false
};
this.vscFixes.push(vscFix);
vscFix = {
    tsLintMessage: "Forbidden 'var' keyword, use 'let' or 'const' instead",
    autoFix: (codeBefore) => {
        let codeAfter = "let";
        return codeAfter;
    },
    overrideTSLintFix: false
};
this.vscFixes.push(vscFix);
vscFix = {
    tsLintMessage: "file should end with a newline",
    autoFix: (codeBefore) => {
        let codeAfter = "\n";
        return codeAfter;
    },
    overrideTSLintFix: false
};
this.vscFixes.push(vscFix);
vscFix = {
    tsLintMessage: "Forbidden 'var' keyword, use 'let' or 'const' instead",
    autoFix: (codeBefore) => {
        let codeAfter = "let";
        return codeAfter;
    },
    overrideTSLintFix: false
};
this.vscFixes.push(vscFix);
vscFix = {
    tsLintMessage: "== should be ===",
    autoFix: (codeBefore) => {
        let codeAfter = "===";
        return codeAfter;
    },
    overrideTSLintFix: false
};
this.vscFixes.push(vscFix);
vscFix = {
    tsLintMessage: "Comment must start with a space",
    autoFix: (codeBefore) => {
        let codeAfter = " " + codeBefore;
        return codeAfter;
    },
    overrideTSLintFix: false
};
this.vscFixes.push(vscFix);
//# sourceMappingURL=vscFix.js.map