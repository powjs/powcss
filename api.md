## Classes

<dl>
<dt><a href="#PowCSS">PowCSS</a></dt>
<dd><p>PowCSS 负责解析 source 为节点树, 并拼接编译器的编译结果.
在 PowCSS 中的插件就是 compiler, compiler 负责与 context 配合.</p>
</dd>
<dt><a href="#Compiler">Compiler</a></dt>
<dd><p>PowCSS 缺省的 Compiler 实现.
所有方法采用原生 js 语法, 要求源码自带嵌套占位符 &#39;...&#39;.</p>
</dd>
<dt><a href="#Context">Context</a></dt>
<dd><p>PowCSS 缺省的 Context 实现.
该实现不分析 CSS 规则的合法性, 只提供结构上的操作和一些辅助方法.
如果要对结果进行再次处理, 推荐使用 walk 方法.</p>
</dd>
<dt><a href="#lineify">lineify</a></dt>
<dd><p>lineify 是个非空白行扫描器, 扫描并返回非空白行信息.</p>
</dd>
</dl>

## Members

<dl>
<dt><a href="#util">util</a></dt>
<dd><p>辅助方法集合</p>
</dd>
</dl>

## Typedefs

<dl>
<dt><a href="#Rule">Rule</a> : <code>object</code></dt>
<dd><p>抽象规则</p>
</dd>
</dl>

<a name="PowCSS"></a>

## PowCSS
PowCSS 负责解析 source 为节点树, 并拼接编译器的编译结果.
在 PowCSS 中的插件就是 compiler, compiler 负责与 context 配合.

**Kind**: global class  

* [PowCSS](#PowCSS)
    * [new PowCSS(plugins)](#new_PowCSS_new)
    * [.use(plugin)](#PowCSS+use) ⇒ <code>this</code>
    * [.process(source)](#PowCSS+process) ⇒ <code>this</code>
    * [.parse(source)](#PowCSS+parse) ⇒ <code>object</code>
    * [.format(root)](#PowCSS+format) ⇒ <code>string</code>
    * [.compile()](#PowCSS+compile) ⇒ <code>string</code>
    * [.build(params)](#PowCSS+build) ⇒ <code>object</code>
    * [.run(source, params, args)](#PowCSS+run) ⇒ <code>object</code>
    * [.walk(nodes, context, callback)](#PowCSS+walk) ⇒ <code>this</code>

<a name="new_PowCSS_new"></a>

### new PowCSS(plugins)

| Param | Type | Description |
| --- | --- | --- |
| plugins | [<code>Array.&lt;Compiler&gt;</code>](#Compiler) | 编译器数组, 缺省为 [compiler()] |

<a name="PowCSS+use"></a>

### powCSS.use(plugin) ⇒ <code>this</code>
使用一个编译器插件

**Kind**: instance method of [<code>PowCSS</code>](#PowCSS)  

| Param | Type |
| --- | --- |
| plugin | [<code>Compiler</code>](#Compiler) | 

<a name="PowCSS+process"></a>

### powCSS.process(source) ⇒ <code>this</code>
包装 this.result = this.parse(source) 并返回 this.

**Kind**: instance method of [<code>PowCSS</code>](#PowCSS)  

| Param | Type | Description |
| --- | --- | --- |
| source | <code>string</code> | 源码 |

<a name="PowCSS+parse"></a>

### powCSS.parse(source) ⇒ <code>object</code>
解析 source 为节点树.
节点类型:
  1. root    {mode:'root', nodes}
  1. comment {mode:'comment', source} 只保留非行尾注释
  1. decl    {mode:'decl', source, key, val}
  1. pending {mode:'', source, nodes}

即所有 !mode 的节点需要通过编译插件进行确认

**Kind**: instance method of [<code>PowCSS</code>](#PowCSS)  
**Returns**: <code>object</code> - root 节点树  

| Param | Type | Description |
| --- | --- | --- |
| source | <code>string</code> | 源码 |

<a name="PowCSS+format"></a>

### powCSS.format(root) ⇒ <code>string</code>
格式化输出 root.nodes

**Kind**: instance method of [<code>PowCSS</code>](#PowCSS)  
**Returns**: <code>string</code> - CSS  无花括号两空格缩进格式  

| Param | Type | Description |
| --- | --- | --- |
| root | <code>object</code> | 解析后的节点树 |

<a name="PowCSS+compile"></a>

### powCSS.compile() ⇒ <code>string</code>
遍历 this.result 所有节点拼接编译插件的编译结果.
未被编译的节点和其子节点被抛弃.

**Kind**: instance method of [<code>PowCSS</code>](#PowCSS)  
**Returns**: <code>string</code> - body 编译后的函数主体代码;  
<a name="PowCSS+build"></a>

### powCSS.build(params) ⇒ <code>object</code>
返回 Function(params, this.compile(this.result + ';return '+ params.split(',')[0]))

**Kind**: instance method of [<code>PowCSS</code>](#PowCSS)  
**Returns**: <code>object</code> - ctx  

| Param | Type | Description |
| --- | --- | --- |
| params | <code>string</code> | 形参, 缺省为 'ctx' |

<a name="PowCSS+run"></a>

### powCSS.run(source, params, args) ⇒ <code>object</code>
包装 process, build 并返回执行结果

**Kind**: instance method of [<code>PowCSS</code>](#PowCSS)  

| Param | Type | Description |
| --- | --- | --- |
| source | <code>string</code> | CSS 源码 |
| params | <code>string</code> | 形参, 缺省为 'ctx' |
| args | <code>array</code> | 实参, 缺省为 [context()] |

<a name="PowCSS+walk"></a>

### powCSS.walk(nodes, context, callback) ⇒ <code>this</code>
使用 nodes.forEach 深度遍历节点树并调用 callback(item, context, index, nodes).
如果 callback 返回非真值, item.nodes 将不参与遍历.

**Kind**: instance method of [<code>PowCSS</code>](#PowCSS)  

| Param | Type | Description |
| --- | --- | --- |
| nodes | <code>array</code> |  |
| context | <code>Object</code> | 上下文 |
| callback | <code>function</code> | 回调函数 |

<a name="Compiler"></a>

## Compiler
PowCSS 缺省的 Compiler 实现.
所有方法采用原生 js 语法, 要求源码自带嵌套占位符 '...'.

**Kind**: global class  

* [Compiler](#Compiler)
    * [new Compiler()](#new_Compiler_new)
    * [.compile()](#Compiler+compile)
    * [.comment()](#Compiler+comment)
    * [.rule()](#Compiler+rule)
    * [.decl()](#Compiler+decl)
    * [.if()](#Compiler+if)
    * [.each()](#Compiler+each)
    * [.let()](#Compiler+let)

<a name="new_Compiler_new"></a>

### new Compiler()
构造, 参数用来对 this 进行扩展.
缺省 this.ctx = 'ctx' 表示 context 的形参名

<a name="Compiler+compile"></a>

### compiler.compile()
compile 接口

**Kind**: instance method of [<code>Compiler</code>](#Compiler)  
<a name="Compiler+comment"></a>

### compiler.comment()
编译 n.mode === 'comment' 的节点, '/*!' 开头的顶层注释被保留, 其它被抛弃.

**Kind**: instance method of [<code>Compiler</code>](#Compiler)  
<a name="Compiler+rule"></a>

### compiler.rule()
编译 !n.mode 的节点为规则节点

**Kind**: instance method of [<code>Compiler</code>](#Compiler)  
<a name="Compiler+decl"></a>

### compiler.decl()
编译 n.mode === 'decl' 的节点

**Kind**: instance method of [<code>Compiler</code>](#Compiler)  
<a name="Compiler+if"></a>

### compiler.if()
if 语句, 原生语法:
   if(expr) code;
   if (expr) code;

**Kind**: instance method of [<code>Compiler</code>](#Compiler)  
<a name="Compiler+each"></a>

### compiler.each()
each 语句, 原生语法:

  each(expr, (val, key)=>{code});
  ctx.each(expr, (val, key)=>{code});

**Kind**: instance method of [<code>Compiler</code>](#Compiler)  
<a name="Compiler+let"></a>

### compiler.let()
let 语句, 原生语法:

  let v1 = expr;
  let [v1,v2] = [expr, expr]; // ES6 解构赋值
  let v1 = expr; code;

**Kind**: instance method of [<code>Compiler</code>](#Compiler)  
<a name="Context"></a>

## Context
PowCSS 缺省的 Context 实现.
该实现不分析 CSS 规则的合法性, 只提供结构上的操作和一些辅助方法.
如果要对结果进行再次处理, 推荐使用 walk 方法.

**Kind**: global class  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| rule | [<code>Rule</code>](#Rule) | 当前维护的规则, 初始 null |
| rules | [<code>Array.&lt;Rule&gt;</code>](#Rule) | 最终的规则数组 |
| stack | [<code>Array.&lt;Rule&gt;</code>](#Rule) | 当前规则的 parent 栈 |


* [Context](#Context)
    * [new Context()](#new_Context_new)
    * [.reset()](#Context+reset) ⇒ <code>this</code>
    * [.each(x, callback)](#Context+each) ⇒ <code>this</code>
    * [.open(name)](#Context+open) ⇒ <code>this</code>
    * [.close()](#Context+close) ⇒ <code>this</code>
    * [.name()](#Context+name) ⇒ <code>string</code>
    * [.decl(key, val)](#Context+decl) ⇒ <code>string</code>
    * [.toCSS()](#Context+toCSS) ⇒ <code>string</code>
    * [.walk(context)](#Context+walk) ⇒ <code>boolean</code>

<a name="new_Context_new"></a>

### new Context()
构造, 参数用来对 this 进行扩展.

<a name="Context+reset"></a>

### context.reset() ⇒ <code>this</code>
重置 .rule, .rules, .stack 为初始状态

**Kind**: instance method of [<code>Context</code>](#Context)  
<a name="Context+each"></a>

### context.each(x, callback) ⇒ <code>this</code>
遍历 x 回调 callback(val, key)

**Kind**: instance method of [<code>Context</code>](#Context)  

| Param | Type | Description |
| --- | --- | --- |
| x | <code>object</code> \| <code>array</code> |  |
| callback | <code>function</code> | 参数顺序 (val, key) |

<a name="Context+open"></a>

### context.open(name) ⇒ <code>this</code>
开启一个具名规则并替换 name 中的占位符 '&', 该方法必须与 close 成对使用.
嵌套使用时 this.stack 会增长.

**Kind**: instance method of [<code>Context</code>](#Context)  

| Param | Type |
| --- | --- |
| name | <code>string</code> | 

<a name="Context+close"></a>

### context.close() ⇒ <code>this</code>
关闭当前的规则, this.stack 会减少, 该方法必须与 .open 成对使用.

**Kind**: instance method of [<code>Context</code>](#Context)  
<a name="Context+name"></a>

### context.name() ⇒ <code>string</code>
返回 this.rule.name

**Kind**: instance method of [<code>Context</code>](#Context)  
<a name="Context+decl"></a>

### context.decl(key, val) ⇒ <code>string</code>
返回或设置当前规则的 key 声明

**Kind**: instance method of [<code>Context</code>](#Context)  

| Param | Type |
| --- | --- |
| key | <code>string</code> | 
| val | <code>string</code> | 

<a name="Context+toCSS"></a>

### context.toCSS() ⇒ <code>string</code>
输出 this.rules 为 CSS 源码

**Kind**: instance method of [<code>Context</code>](#Context)  
**Returns**: <code>string</code> - css  
<a name="Context+walk"></a>

### context.walk(context) ⇒ <code>boolean</code>
遍历 this.rules 调用 context 的 open, close, decl 方法.
context 的 open, close 返回的对象会用于后续的迭代.
任何一个方法返回非真值会终止遍历.

**Kind**: instance method of [<code>Context</code>](#Context)  
**Returns**: <code>boolean</code> - finished 是否完全遍历  

| Param | Type | Description |
| --- | --- | --- |
| context | <code>object</code> | 实现 open, close, decl 方法的对象 |

<a name="lineify"></a>

## lineify
lineify 是个非空白行扫描器, 扫描并返回非空白行信息.

**Kind**: global class  

* [lineify](#lineify)
    * [new lineify(source)](#new_lineify_new)
    * [.scan()](#lineify+scan) ⇒ <code>Object</code> \| <code>null</code>

<a name="new_lineify_new"></a>

### new lineify(source)

| Param | Type | Description |
| --- | --- | --- |
| source | <code>string</code> | 待扫描的字符串 |

<a name="lineify+scan"></a>

### lineify.scan() ⇒ <code>Object</code> \| <code>null</code>
返回扫描到的非空白行字符串和位置信息, 并前进. 结构:
  {source, offset, line, column}

**Kind**: instance method of [<code>lineify</code>](#lineify)  
**Returns**: <code>Object</code> \| <code>null</code> - token 返回 null 表示 EOF  
<a name="util"></a>

## util
辅助方法集合

**Kind**: global variable  

* [util](#util)
    * [.info(message, loc, at)](#util.info) ⇒ <code>string</code>
    * [.isObject(x)](#util.isObject) ⇒ <code>Boolean</code>
    * [.isNumber(x)](#util.isNumber) ⇒ <code>Boolean</code>
    * [.isArray(x)](#util.isArray) ⇒ <code>Boolean</code>
    * [.isString(x)](#util.isString) ⇒ <code>Boolean</code>
    * [.isFunction(x)](#util.isFunction) ⇒ <code>Boolean</code>

<a name="util.info"></a>

### util.info(message, loc, at) ⇒ <code>string</code>
返回包含位置信息的字符串, 常用于出错信息

**Kind**: static method of [<code>util</code>](#util)  

| Param | Type | Description |
| --- | --- | --- |
| message | <code>string</code> | 自定义信息 |
| loc | <code>object</code> | 含有 line, column 的位置信息 |
| at | <code>string</code> | 缺省为 <anonymous> |

<a name="util.isObject"></a>

### util.isObject(x) ⇒ <code>Boolean</code>
isObject

**Kind**: static method of [<code>util</code>](#util)  

| Param | Type |
| --- | --- |
| x | <code>\*</code> | 

<a name="util.isNumber"></a>

### util.isNumber(x) ⇒ <code>Boolean</code>
isNumber

**Kind**: static method of [<code>util</code>](#util)  

| Param | Type |
| --- | --- |
| x | <code>\*</code> | 

<a name="util.isArray"></a>

### util.isArray(x) ⇒ <code>Boolean</code>
isArray

**Kind**: static method of [<code>util</code>](#util)  

| Param | Type |
| --- | --- |
| x | <code>\*</code> | 

<a name="util.isString"></a>

### util.isString(x) ⇒ <code>Boolean</code>
isString

**Kind**: static method of [<code>util</code>](#util)  

| Param | Type |
| --- | --- |
| x | <code>\*</code> | 

<a name="util.isFunction"></a>

### util.isFunction(x) ⇒ <code>Boolean</code>
isFunction

**Kind**: static method of [<code>util</code>](#util)  

| Param | Type |
| --- | --- |
| x | <code>\*</code> | 

<a name="Rule"></a>

## Rule : <code>object</code>
抽象规则

**Kind**: global typedef  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | 规则名, 也可能是个定义值, 比如 @charset |
| decls | <code>object.&lt;string, (string\|Rule)&gt;</code> | 键值声明 |

