const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const tranverse = require('@babel/traverse').default;
const babel = require('@babel/core');

let BUNDLE_ID = 0;

/**
 * 一个资源文件解析后的对象
 *
 * @interface IBundle
 * @property {number} bundleId 资源唯一标识
 * @property {string} fileName 包含相对路径资源名称
 * @property {array} dependencies 本资源的外部依赖，每一项也是包含相对路径的资源名称
 * @property {string} transformedCodeAfterBabel 转为es5之后的代码
 * @property {Record} [mapping] 外部依赖的坐标，key是dependencies的一项，value是bundleId
 */
interface IBundle {
  bundleId: number;
  fileName: string;
  dependencies: string[];
  transformedCodeAfterBabel: string;
  mapping?: Record<string, number>;
}

export function createBundle(pathToFile: string): IBundle {
  const fileContent = fs.readFileSync(pathToFile, 'utf-8');
  // https://babeljs.io/docs/en/next/babel-parser.html
  const astJson = parser.parse(fileContent, {
    // parse in strict mode and allow module declarations
    // 没有配置则会报错：SyntaxError: 'import' and 'export' may appear only with 'sourceType: "module"' (1:0)
    sourceType: 'module'
  });
  const deps = [];
  // https://babeljs.io/docs/en/next/babel-traverse.html
  tranverse(astJson, {
    // https://babeljs.io/docs/en/babel-types#api
    ImportDeclaration: (path) => {
      const { node } = path;
      deps.push(node.source.value)
    }
  })

  // https://babeljs.io/docs/en/next/babel-core.html
  const { code, map, ast } = babel.transformFromAstSync(astJson, null, {
    presets: ['@babel/preset-env'],
  });
  return {
    bundleId: BUNDLE_ID++,
    fileName: pathToFile,
    dependencies: deps,
    transformedCodeAfterBabel: code,
    mapping: {}
  }
}

/**
 * 从入口开始分析所有依赖项，形成依赖图
 *
 * @param {string} pathToFile
 * @returns
 */
export function createGraph(pathToFile: string): IBundle[] {
  const entryAsset = createBundle(pathToFile);
  const queue = [entryAsset];
  // 注意这里因为后面会对queue进行append，所以用的for of遍历，没有用forEach
  for (const bundle of queue) {
    // 获取前面的文件夹
    const baseDir = path.dirname(bundle.fileName);
    bundle.dependencies.forEach(depRelativePath => {
      // 拼接出依赖的绝对路径
      const absolutePath = path.join(baseDir, depRelativePath);
      // 获取子依赖的依赖项、转义后的代码、模块ID、文件名
      const depBundle = createBundle(absolutePath);
      // 往模块中添加模块映射
      bundle.mapping[depRelativePath] = depBundle.bundleId;
      // 依赖图
      queue.push(depBundle);
    })
  }
  return queue;
}

/**
 * 打包所有的模块到一个文件中
 *
 * @param {*} graph 所有依赖的模板
 * @returns
 */
export function bundleByGraph(bundleList: IBundle[]): string {
  let modules = '';
  // 生成所有模块
  bundleList.forEach(bundle => {
    // 内部的每一个模块都包裹子啊Function作用域内，
    modules += `${bundle.bundleId}: [
      function(require, module, exports) {
        ${bundle.transformedCodeAfterBabel}
      },
      ${JSON.stringify(bundle.mapping)}
    ],`
  })
  // 刚刚生成的所有模块作为参数注入，然后内部实现require方法，从第一个模块开始启动
  const result = `
    (function(modules) {
      function require(moduleId) {
        const [fn, mapping] = modules[moduleId];

        function localRequire(relativePath) {
          // babel打包出来的就是require，所以这里直接调用require去刚生成的模块中找到依赖项
          const depBundleId = mapping[relativePath];
          return require(depBundleId);
        }
        // babel打包出的代码，导出的模块就是挂载在exports对象上的
        const module = { exports: {} }
        // 执行转义后的包裹wrapper，注入重写的三个参数
        fn(localRequire, module, module.exports);

        return module.exports;
      }
      require(0);
    })({
      ${modules}
    })
  `;
  return result;
}

export function bundleByAPath(entryPath: string) {
  const graph: IBundle[] = createGraph(entryPath);
  const bundle = bundleByGraph(graph);
  return bundle;
}
