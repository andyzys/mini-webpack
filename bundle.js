"use strict";
exports.__esModule = true;
exports.bundleByAPath = exports.createGraph = exports.createBundle = void 0;
var fs = require('fs');
var path = require('path');
var parser = require('@babel/parser');
var tranverse = require('@babel/traverse')["default"];
var babel = require('@babel/core');
var BUNDLE_ID = 0;
function createBundle(pathToFile) {
    var fileContent = fs.readFileSync(pathToFile, 'utf-8');
    // https://babeljs.io/docs/en/next/babel-parser.html
    var astJson = parser.parse(fileContent, {
        // parse in strict mode and allow module declarations
        // 没有配置则会报错：SyntaxError: 'import' and 'export' may appear only with 'sourceType: "module"' (1:0)
        sourceType: 'module'
    });
    var deps = [];
    // https://babeljs.io/docs/en/next/babel-traverse.html
    tranverse(astJson, {
        // https://babeljs.io/docs/en/babel-types#api
        ImportDeclaration: function (path) {
            var node = path.node;
            deps.push(node.source.value);
        }
    });
    // https://babeljs.io/docs/en/next/babel-core.html
    var _a = babel.transformFromAstSync(astJson, null, {
        presets: ['@babel/preset-env']
    }), code = _a.code, map = _a.map, ast = _a.ast;
    return {
        bundleId: BUNDLE_ID++,
        fileName: pathToFile,
        dependencies: deps,
        transformedCodeAfterBabel: code,
        mapping: {}
    };
}
exports.createBundle = createBundle;
/**
 * 从入口开始分析所有依赖项，形成依赖图
 *
 * @param {string} pathToFile
 * @returns
 */
function createGraph(pathToFile) {
    var entryAsset = createBundle(pathToFile);
    var queue = [entryAsset];
    var _loop_1 = function (bundle) {
        // 获取前面的文件夹
        var baseDir = path.dirname(bundle.fileName);
        bundle.dependencies.forEach(function (depRelativePath) {
            // 拼接出依赖的绝对路径
            var absolutePath = path.join(baseDir, depRelativePath);
            // 获取子依赖的依赖项、转义后的代码、模块ID、文件名
            var depBundle = createBundle(absolutePath);
            // 往模块中添加模块映射
            bundle.mapping[depRelativePath] = depBundle.bundleId;
            // 依赖图
            queue.push(depBundle);
        });
    };
    // 注意这里因为后面会对queue进行append，所以用的for of遍历，没有用forEach
    for (var _i = 0, queue_1 = queue; _i < queue_1.length; _i++) {
        var bundle = queue_1[_i];
        _loop_1(bundle);
    }
    return queue;
}
exports.createGraph = createGraph;
/**
 * 打包所有的模块到一个文件中
 *
 * @param {*} graph 所有依赖的模板
 * @returns
 */
function bundleByGraph(graph) {
    var modules = '';
    // 生成所有模块
    graph.forEach(function (module) {
        // 内部的每一个模块都包裹子啊Function作用域内，
        modules += module.bundleId + ": [\n      function(require, module, exports) {\n        " + module.transformedCodeAfterBabel + "\n      },\n      " + JSON.stringify(module.mapping) + "\n    ],";
    });
    // 刚刚生成的所有模块作为参数注入，然后内部实现require方法，从第一个模块开始启动
    var result = "\n    (function(modules) {\n      function require(moduleId) {\n        const [fn, mapping] = modules[moduleId];\n\n        function localRequire(relativePath) {\n          // babel\u6253\u5305\u51FA\u6765\u7684\u5C31\u662Frequire\uFF0C\u6240\u4EE5\u8FD9\u91CC\u76F4\u63A5\u8C03\u7528require\u53BB\u521A\u751F\u6210\u7684\u6A21\u5757\u4E2D\u627E\u5230\u4F9D\u8D56\u9879\n          const depBundleId = mapping[relativePath];\n          return require(depBundleId);\n        }\n        // babel\u6253\u5305\u51FA\u7684\u4EE3\u7801\uFF0C\u5BFC\u51FA\u7684\u6A21\u5757\u5C31\u662F\u6302\u8F7D\u5728exports\u5BF9\u8C61\u4E0A\u7684\n        const module = { exports: {} }\n        // \u6267\u884C\u8F6C\u4E49\u540E\u7684\u5305\u88F9wrapper\uFF0C\u6CE8\u5165\u91CD\u5199\u7684\u4E09\u4E2A\u53C2\u6570\n        fn(localRequire, module, module.exports);\n\n        return module.exports;\n      }\n      require(0);\n    })({\n      " + modules + "\n    })\n  ";
    return result;
}
function bundleByAPath(entryPath) {
    var graph = createGraph(entryPath);
    var bundle = bundleByGraph(graph);
    return bundle;
}
exports.bundleByAPath = bundleByAPath;
