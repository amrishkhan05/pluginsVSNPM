# Autolinting for Javascript in VSCode

[![Build Status](https://travis-ci.org/t-sauer/autolinting-for-javascript.svg?branch=master)](https://travis-ci.org/t-sauer/autolinting-for-javascript)

## Features

Automatically activates/deactivates the correct linters in Visual Studio Code for your current Javascript workspace depending on which configuration files can be found.  
If no configuration can be found, user defined default linters will be used.

Currently supported linters:

* ESLint
* JSHint
* JSCS
* Standard

## Requirements

All linter extensions you want to use have to be installed in Visual Studio Code.  
You can find these extensions here:

* [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)
* [JSHint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.jshint)
* [JSCS](https://marketplace.visualstudio.com/items?itemName=ms-vscode.jscs)
* Standard: [JavaScript Standard Style](https://marketplace.visualstudio.com/items?itemName=chenxsan.vscode-standardjs) or [JS "Standard" Linter](https://marketplace.visualstudio.com/items?itemName=shinnn.standard) 

## Extension Settings

### Default Linters

If you want to set one or more default linters (for the case that no configuration can be found), you can add a setting to your configuration:

* `jsAutolint.defaultLinters`: Set to an Array containing all linters you want to activate if no known linter configuration can be found (e.g. `["jshint", "jscs"]`).   
Possible Values:
  * `eslint`
  * `jscs`
  * `jshint`
  * `standard`

The default linters will be set if you either open a Javascript file while a folder is opened (if you just open single files the linters won't get set automatically) or if you run the command `Automatically set correct Javascript linters` from the command palette.

### Disabling

* `jsAutolint.enable`: If set to `false` the extension won't automatically set the linters. This is useful in certain project settings if you want to handle the configuration yourself. The command to automatically set linters is still available if you want to run it manually.

### Status information

* `jsAutolint.showStatus`: If set to `false` current active linters won't be displayed in the status bar.

## Release Notes

### 1.2.0

* Support for the Standard linter added.
* Active linters are now displayed in the status bar. To turn it off set `jsAutolint.showStatus` to `false` .
* Automatically setting of linters can now be turned off if you don't want the linters to be set whenever you open a folder. The setting for this is `jsAutolint.enable`.
* Bugfix: The extension should now properly activate and set the correct linters if any configuration can be found in the workspace root folder.

### 1.1.0

* All possible ESLint, JSHint and JSCS configurations should work now (until now only `.eslintrc`, `.jscsrc` and `.eslintrc` were recognized).

### 1.0.0

* Initial release
