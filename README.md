# PowCSS

[![badge](https://img.shields.io/badge/Pow-CSS-green.svg?style=flat-square)](https://github.com/powjs/powcss)
[![npm](https://img.shields.io/npm/l/powcss.svg?style=flat-square)](https://www.npmjs.org/package/powcss)
[![npm](https://img.shields.io/npm/dm/powcss.svg?style=flat-square)](https://www.npmjs.org/package/powcss)
[![npm](https://img.shields.io/npm/dt/powcss.svg?style=flat-square)](https://www.npmjs.org/package/powcss)

PowCSS 是个 CSS 预处理工具. 特征:

    混合 CSS, JavaScript 缩进语法
    编译结果是原生 JavaScript 函数

用 PowCSS 写 CSS 才够原生

![image](https://user-images.githubusercontent.com/489285/31862371-77c9cce0-b702-11e7-824d-8604fda54703.png)

工作原理:

    针对 CSS 语法特点对源码进行 Tree 结构转化, 丢弃行尾注释, 续行被拼接为单行
    编译插件对节点进行编译并返回编译后的代码, 嵌套占位符为 '...'
    依据 Tree 结构, 把这些代码拼接(嵌套)到一起

PowCSS 的写法简单直接, 示例:

```styl
let x = [1,2,3];
each(x, (n, i) => {...}) // 源码中自带嵌套占位符
  col-${n}
    color: red
```

编译步骤分解:

step 1

```js
let x = [1,2,3]; // JS 原生语法, 原样保留
```

step 2

```js
let x = [1,2,3];
ctx.each(x, (n, i) => {...}) // 插件只是补全了 ctx., 也可以在源码中直接这样写.
```

step 3

```js
let x = [1,2,3];
ctx.each(x, (n, i) => {
  // 嵌套占位符被 'col-${n}' 生成的代码替换, 'col-${n}' 也产生了新的嵌套占位符
  ctx.open(`col-${n}`);
  ...
  ctx.close();
})
```

step 4

```js
let x = [1,2,3];
ctx.each(x, (n, i) => {
  ctx.open(`col-${n}`);
  // 嵌套占位符被 'color: red' 生成的代码替换, 没有产生新的嵌套占位符
  ctx.decl('color', 'red');
  ctx.close();
})
```

最终的编译结果:

```js
function(ctx) {
  let x = [1,2,3];
  ctx.each(x, (n, i) => {
    ctx.open(`col-${n}`);
    ctx.decl('color', 'red');
    ctx.close();
  })
  return ctx; // PowCSS 补全最后一条语句
}
```

编译插件被称作 Compiler, ctx 被称作 Context, 它们配套使用且完成真正的构建行为.

## install

nodejs 环境

```sh
yarn add powcss
```

浏览器环境

```html
<script src="//unpkg.com/powcss/dist/powcss.min.js"></script>
```

## usage

nodejs 环境, 演示 [runkit][]

```js
const powcss = require('powcss');

// const context = require('powcss/lib/context');

let ctx = powcss().run(`
.class
  color: green
`);
// ctx.toCSS() or ...
```

浏览器环境, 演示 [codepen][], [requirebin][]

```html
<script>
// const context = powcss.context;
let ctx = powcss().run(`
.class
  color: green
`);
// ctx.toCSS() or ...
</script>
```

## 缩进语法

PowCSS 支持缩进风格的 CSS 源码, 花括号和分号是可选的, 确保正确的缩进即可.

```styl
/**
 * 支持块注释, 单行注释以及行尾注释, '/*!' 开头的顶层注释被保留, 其它注释被抛弃.
 * 兼容 CSS 花括号块写法.
 */

/*!
 * Reserved comment, top and start with '/*!'
 */
selector1 {
  key: val;
}

selector2
  key: val

// 续行符是 '&\,+-/*|=([' 之一
continuation
  border: 1px solid \ // 符号 '\' 会被剔除, 其它续行符会被保留
    red
```

**属性分隔符 ':' 后面必须跟一个空格或换行, 除非该行以 '@' 开头.**

## Compiler

编译器负责识别嵌入的 ES6 语句, 并编译返回 JS 源代码.

编译器需要实现 `compile` 方法作为编译接口

```js
/**
 * 编译接口
 * @param  {object}   n  解析后节点树中的一个节点对象
 * @param  {number}   i  节点 n 在 ns 中的序号
 * @param  {object[]} ns 节点 n 所在的兄弟节点集合
 * @return {?string}  js 编译节点 n 产生的 js 源码, 最多包含一个嵌套占位符
 */
compile(n, i, ns){}
```

PowCSS 实现的 Compiler 直接使用原生 JS 语法, 不对语法进行分析.

参见 [API](api.md)

**提示: 把 CSS 当作 JavaScript 来写就对了**

源码中比较容易常犯的错误:

```styl
// incorrect
if (something)
  color: 1px
  border: 1px

// correct
if (something) {...}
  color: 1px
  border: 1px
```

下面两种写法具有相同效果:

```styl
if (something)
  color: 1px
border: 1px

// same

if (something)
color: 1px
border: 1px
```

## Context

Context 负责提供生成和维护 CSS 规则的基本方法, 值表达式由配套的 Compiler 生成.

PowCSS 实现的 Context 维护规则的 open 和 close 等操作, 并负责处理 '&' 占位符.

参见 [API](api.md)

## 赞助

赞助以帮助 PowCSS 持续更新

![通过支付宝赞助](https://user-images.githubusercontent.com/489285/31326203-9b0c95c0-ac8a-11e7-9161-b2d8f1cc00e8.png)
![通过微信赞助](https://user-images.githubusercontent.com/489285/31326223-c62b133a-ac8a-11e7-9af5-ff5465872280.png)
[![通过 Paypal 赞助](https://user-images.githubusercontent.com/489285/31326166-63e63682-ac8a-11e7-829a-0f75875ac88a.png)](https://www.paypal.me/HengChunYU/5)

## License

MIT License <https://github.com/powjs/powcss/blob/master/LICENSE>

[runkit]: https://runkit.com/achun/powcss-demo
[codepen]: https://codepen.io/achun/pen/eGVzpq
[requirebin]: http://requirebin.com/?gist=7f29bedba40cb8029e30880fc857fc9b