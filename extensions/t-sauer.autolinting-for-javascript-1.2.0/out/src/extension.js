"use strict";
const vscode_1 = require('vscode');
const fs = require('fs');
const path = require('path');
const linter_configs_1 = require('./linter-configs');
function activate(context) {
    const autoLinter = new AutoLinter();
    let disposable = vscode_1.commands.registerCommand('extension.setLinter', () => autoLinter.autosetLinters());
    context.subscriptions.push(disposable);
}
exports.activate = activate;
function deactivate() {
}
exports.deactivate = deactivate;
function updateConfigIfChanged(section, value) {
    const config = vscode_1.workspace.getConfiguration();
    if (config.get(section) !== value) {
        config.update(section, value, false);
    }
}
class AutoLinter {
    constructor() {
        if (this.isEnabled) {
            this.autosetLinters();
        }
        vscode_1.workspace.onDidChangeConfiguration(this.autosetLinters, this);
    }
    get isEnabled() {
        return vscode_1.workspace.getConfiguration().get('jsAutolint.enable');
    }
    get showStatus() {
        return vscode_1.workspace.getConfiguration().get('jsAutolint.showStatus');
    }
    get defaultLinters() {
        const settings = vscode_1.workspace.getConfiguration().get('jsAutolint.defaultLinters');
        return settings.map((setting) => {
            return linter_configs_1.LINTERS.find((linter) => linter.enableConfig.startsWith(setting));
        });
    }
    autosetLinters() {
        const { rootPath } = vscode_1.workspace;
        if (!rootPath) {
            return;
        }
        let lintersInProject = [
            ...this.findLintersInWorkspace(),
            ...this.findLintersInPackageJSON()
        ];
        // Get rid of duplicate entries
        lintersInProject = [...new Set(lintersInProject)];
        this.setWorkspaceSettings(lintersInProject);
        if (this.showStatus) {
            this.setStatusbarInformation(lintersInProject);
        }
        else if (this.statusBarItem) {
            this.statusBarItem.hide();
        }
    }
    findLintersInWorkspace() {
        const { rootPath } = vscode_1.workspace;
        return linter_configs_1.LINTERS.filter((linter) => {
            return linter.configFiles.some((file) => {
                const configPath = path.join(rootPath, file);
                return fs.existsSync(configPath);
            });
        });
    }
    findLintersInPackageJSON() {
        const { rootPath } = vscode_1.workspace;
        const packageJSONPath = path.join(rootPath, 'package.json');
        if (fs.existsSync(packageJSONPath)) {
            let packageContent = {};
            try {
                packageContent = JSON.parse(fs.readFileSync(packageJSONPath, 'utf8'));
            }
            catch (e) { }
            return linter_configs_1.LINTERS.filter((linter) => {
                if (typeof packageContent[linter.packageJSONConfig] === 'object') {
                    return true;
                }
                if (linter.packageDependency) {
                    const inDevDependencies = packageContent.devDependencies && packageContent.devDependencies[linter.packageDependency];
                    const inDependencies = packageContent.dependencies && packageContent.dependencies[linter.packageDependency];
                    return inDevDependencies || inDependencies;
                }
                return false;
            });
        }
        return [];
    }
    setWorkspaceSettings(activeLinters) {
        const lintersToActivate = activeLinters.length > 0 ? activeLinters : this.defaultLinters;
        linter_configs_1.LINTERS.forEach((linter) => {
            const isActive = lintersToActivate.indexOf(linter) !== -1;
            updateConfigIfChanged(linter.enableConfig, isActive);
        });
    }
    setStatusbarInformation(activeLinters) {
        if (!this.statusBarItem) {
            this.statusBarItem = vscode_1.window.createStatusBarItem(vscode_1.StatusBarAlignment.Left, 100);
            this.statusBarItem.tooltip = 'Active linters';
        }
        const lintersToList = activeLinters.length > 0 ? activeLinters : this.defaultLinters;
        if (lintersToList.length === 0) {
            this.statusBarItem.hide();
            return;
        }
        const activeLintersText = lintersToList.map((linter) => linter.name).join(', ');
        this.statusBarItem.text = `$(info) ${activeLintersText}`;
        this.statusBarItem.show();
    }
}
//# sourceMappingURL=extension.js.map