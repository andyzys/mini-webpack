const { bundleByAPath, createBundle, createGraph } = require('../bundle.js');

// const fnStr = bundleByAPath('./source/entry.js');
// console.log('编译后的代码是：', fnStr)
// eval(fnStr)
const bundleAst = createGraph('./source/entry.js');
console.log(bundleAst);