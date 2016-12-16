"use strict";
const ResolveIndex_1 = require('./caches/ResolveIndex');
const ExtensionConfig_1 = require('./ExtensionConfig');
const CodeFixExtension_1 = require('./extensions/CodeFixExtension');
const ResolveExtension_1 = require('./extensions/ResolveExtension');
const RestartDebuggerExtension_1 = require('./extensions/RestartDebuggerExtension');
const TsResourceParser_1 = require('./parser/TsResourceParser');
const GuiProvider_1 = require('./provider/GuiProvider');
const ResolveCompletionItemProvider_1 = require('./provider/ResolveCompletionItemProvider');
const ResolveQuickPickProvider_1 = require('./provider/ResolveQuickPickProvider');
const TypescriptCodeActionProvider_1 = require('./provider/TypescriptCodeActionProvider');
const TypeScriptHero_1 = require('./TypeScriptHero');
const Logger_1 = require('./utilities/Logger');
const inversify_1 = require('inversify');
const inversify_inject_decorators_1 = require('inversify-inject-decorators');
let injector = new inversify_1.Kernel();
injector.bind(TypeScriptHero_1.TypeScriptHero).to(TypeScriptHero_1.TypeScriptHero).inSingletonScope();
injector.bind(ExtensionConfig_1.ExtensionConfig).to(ExtensionConfig_1.ExtensionConfig).inSingletonScope();
// Providers
injector.bind(GuiProvider_1.GuiProvider).to(GuiProvider_1.GuiProvider).inSingletonScope();
injector.bind(ResolveQuickPickProvider_1.ResolveQuickPickProvider).to(ResolveQuickPickProvider_1.ResolveQuickPickProvider).inSingletonScope();
injector.bind(ResolveCompletionItemProvider_1.ResolveCompletionItemProvider).to(ResolveCompletionItemProvider_1.ResolveCompletionItemProvider).inSingletonScope();
injector.bind(TypescriptCodeActionProvider_1.TypescriptCodeActionProvider).to(TypescriptCodeActionProvider_1.TypescriptCodeActionProvider).inSingletonScope();
// Symbol resolving
injector.bind(ResolveIndex_1.ResolveIndex).to(ResolveIndex_1.ResolveIndex).inSingletonScope();
injector.bind(TsResourceParser_1.TsResourceParser).to(TsResourceParser_1.TsResourceParser);
// Extensions
injector.bind('Extension').to(ResolveExtension_1.ResolveExtension).inSingletonScope();
injector.bind('Extension').to(RestartDebuggerExtension_1.RestartDebuggerExtension).inSingletonScope();
injector.bind('Extension').to(CodeFixExtension_1.CodeFixExtension).inSingletonScope();
// Logging
injector.bind('LoggerFactory').toFactory((context) => {
    return (prefix) => {
        let extContext = context.kernel.get('context'), config = context.kernel.get(ExtensionConfig_1.ExtensionConfig);
        return new Logger_1.Logger(extContext, config, prefix);
    };
});
exports.Injector = injector;
exports.InjectorDecorators = inversify_inject_decorators_1.default(injector);
