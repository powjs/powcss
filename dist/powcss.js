(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (global){
global.powcss = require('./lib/powcss.js');
global.powcss.lineify = require('./lib/lineify');
global.powcss.compiler = require('./lib/compiler');
global.powcss.context = require('./lib/context');
global.powcss.util =  require('./lib/util');
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./lib/compiler":2,"./lib/context":3,"./lib/lineify":4,"./lib/powcss.js":5,"./lib/util":6}],2:[function(require,module,exports){
const IFX = /if[ ]+([_$a-zA-Z]+)[ ]*=/,
  util =  require('./util');

/**
 * PowCSS 缺省的 Compiler 实现.
 * 所有方法采用原生 js 语法, 要求源码自带嵌套占位符 '...'.
 */
class Compiler{

  /**
   * 构造, 参数用来对 this 进行扩展.
   * 缺省 this.ctx = 'ctx' 表示 context 的形参名
   */
  constructor(...extend) {
    extend.forEach((ext) => {
      if (typeof ext === 'function')
        this[ext.name] = ext;
      else if (Object.prototype.toString.call(ext) === '[object Object]') {
        for (let key in ext) {
          this[key] = ext[key];
        }
      }
    });
    this.ctx = this.ctx || 'ctx';
  }

  /**
   * compile 接口
   */
  compile(n, i, ns) {
    return this.decl(n) ||
      this.if(n) ||
      this.each(n) ||
      this.let(n) ||
      this.comment(n) ||
      this.rule(n);
  }

  /**
   * 编译 n.mode === 'comment' 的节点, '/*!' 开头的顶层注释被保留, 其它被抛弃.
   */
  comment(n) {
    if (n.mode !== 'comment') return;
    if (n.column === 1 && n.source[1] === '*' && n.source[2] === '!'){
      let c = JSON.stringify(n.source);
      return `${this.ctx}.open(${c}).close();`;
    }
    return ' ';
  }

  /**
   * 编译 !n.mode 的节点为规则节点
   */
  rule(n) {
    if (n.mode) return;
    let c = n.source.indexOf('${') === -1 && '\'' || '`';
    return n.nodes && n.nodes.length &&
    `${this.ctx}.open(${c}${n.source}${c});
...${this.ctx}.close();` ||
    `${this.ctx}.open(${c}${n.source}${c}).close();`;
  }

  /**
   * 编译 n.mode === 'decl' 的节点
   */
  decl(n) {
    if (n.mode !== 'decl') return;

    let c = n.key.indexOf('${') === -1 && '\'' || '`',
      v = n.val.endsWith(';') ?
        n.val.substring(0, n.val.length - 1) :
        n.val,
      d = v.indexOf('${') === -1 && '\'' || '`';

    return `${this.ctx}.decl(${c}${n.key}${c},${d}${v}${d});`;
  }

  /**
   * if 语句, 原生语法:
   *    if(expr) code;
   *    if (expr) code;
   */
  if(n) {
    if (n.source.startsWith('if(') || n.source.startsWith('if ('))
      return n.source;
  }

  /**
   * each 语句, 原生语法:
   *
   *   each(expr, (val, key)=>{code});
   *   ctx.each(expr, (val, key)=>{code});
   *
   */
  each(n) {
    if (n.source.startsWith(`${this.ctx}.each(`))
      return n.source;
    if (n.source.startsWith('each(')) return this.ctx + '.' + n.source;
  }

  /**
   * let 语句, 原生语法:
   *
   *   let v1 = expr;
   *   let [v1,v2] = [expr, expr]; // ES6 解构赋值
   *   let v1 = expr; code;
   */
  let(n) {
    if (n.source.startsWith('let ')) return n.source;
  }

}

module.exports = function(...extend) {
  return new Compiler(...extend);
};

},{"./util":6}],3:[function(require,module,exports){
/**
 * @typedef {object} Rule   抽象规则
 * @property {string} name  规则名, 也可能是个定义值, 比如 @charset
 * @property {?object<string, string|Rule>} decls 键值声明
 */

/**
 * PowCSS 缺省的 Context 实现.
 * 该实现不分析 CSS 规则的合法性, 只提供结构上的操作和一些辅助方法.
 * 如果要对结果进行再次处理, 推荐使用 walk 方法.
 *
 * @property {Rule}   rule  当前维护的规则, 初始 null
 * @property {Rule[]} rules 最终的规则数组
 * @property {Rule[]} stack 当前规则的 parent 栈
 */
class Context {
  /**
   * 构造, 参数用来对 this 进行扩展.
   */
  constructor(...extend) {
    this.rule = null;
    this.rules = [];
    this.stack = [];
    extend.forEach((ext) => {
      if (typeof ext === 'function')
        this[ext.name] = ext;
      else if (Object.prototype.toString.call(ext) === '[object Object]') {
        for (let key in ext) {
          this[key] = ext[key];
        }
      }
    });
  }

  /**
   * 遍历 x 回调 callback(val, key)
   * @param  {object|array}   x
   * @param  {Function( *, string)} callback 参数顺序 (val, key)
   * @return {this}
   */
  each(x, callback) {
    if (Array.isArray(x)) {
      x.forEach(callback);
    }else
      Object.keys(x).forEach(function(key) {
        callback(x[key], key);
      });
    return this;
  }

  /**
   * 开启一个具名规则并替换 name 中的占位符 '&', 该方法必须与 close 成对使用.
   * 嵌套使用时 this.stack 会增长.
   * @param  {string} name
   * @return {this}
   */
  open(name) {
    if (this.rule) {
      this.stack.push(this.rule);
      if (name.indexOf('&') !== -1)
        name = name.replace(/&/g, this.rule.name);

      if (!this.rule.decls) {
        if (this.rule.name[0] === '@') {
          this.rule.decls = [];
          this.stack.push(this.rules);
          this.rules = this.rule.decls;
        }else if (
          this.rule.name[0] !== '/' &&
          this.rule === this.rules[this.rules.length - 1]
         ) {
          this.rules.pop();
        }
      }
    }
    this.rule = {name};
    this.rules.push(this.rule);
    return this;
  }

  /**
   * 关闭当前的规则, this.stack 会减少, 该方法必须与 .open 成对使用.
   * @return {this}
   */
  close() {
    this.rule = this.stack.pop();
    if (Array.isArray(this.rule)) {
      this.rules = this.rule;
      return this.close();
    }
    return this;
  }

  /**
   * 返回 this.rule.name
   * @return {string}
   */
  name() {
    return this.rule && this.rule.name || '';
  }

  /**
   * 返回或设置当前规则的 key 声明
   * @param  {string}  key
   * @param  {?string} val
   * @return {string}
   */
  decl(key, val) {
    if (val) {
      if (!this.rule.decls)
        this.rule.decls = {};
      this.rule.decls[key] = val;
      return val;
    }
    return this.rule.decls[key] || '';
  }

  /**
   * 输出 this.rules 为 CSS 源码
   * @return {string} css
   */
  toCSS() {
    let toCSS = (css, rule)=> {
      if (rule.decls) {
        css += rule.name + ' {\n';
        if (Array.isArray(rule.decls)) {
          css += rule.decls.reduce(toCSS, '');
        }else for (let key in rule.decls) {
          if (typeof rule.decls[key] === 'string')
            css += key + ': ' + rule.decls[key] + ';\n';
          else
            throw new Error('decls must be a string or array: ' + rule.name + '{' + key + '}');
        }
        css += '}\n';
      }else if (rule.name[0] === '/') // comment
        css += rule.name + '\n';
      else if (rule.name[0] === '@') // 有些规则只是为了嵌套 '&', 没有 decls
        css += rule.name + ';\n';
      else
        throw new Error('Unexpected bare rule: ' + rule.name);
      return css;
    };

    return this.rules.reduce(toCSS, '');
  }

  /**
   * 遍历 this.rules 调用 context 的 open, close, decl 方法.
   * context 的 open, close 返回的对象会用于后续的迭代.
   * 任何一个方法返回非真值会终止遍历.
   * @param  {object}  context  实现 open, close, decl 方法的对象
   * @return {boolean} finished 是否完全遍历
   */
  walk(context) {
    let walk = function(rule) {
      let self = this;
      if (rule.decls) {
        self = self.open(rule.name);
        if (Array.isArray(rule.decls)) {
          if (!rule.decls.every(walk, self))
            return false;
        }else for (let key in rule.decls) {
          if (typeof rule.decls[key] === 'string') {
            if (!self.decl(key, rule.decls[key])) return false;
          }else {
            throw new Error('decls must be a string or array: ' + rule.name + '{' + key + '}');
          }
        }
      }else if (rule.name[0] === '/' || rule.name[0] === '@') {
        self = self.open(rule.name);
      }else {
        throw new Error('Unexpected bare rule: ' + rule.name);
      }
      if (self) self = self.close();
      return !!self;
    };
    return this.rules.every(walk, context);
  }
}

module.exports = function(...extend) {
  return new Context(...extend);
};

},{}],4:[function(require,module,exports){
/**
 * lineify 是个非空白行扫描器, 扫描并返回非空白行信息.
 * @param {string} source 待扫描的字符串
 */
class lineify{
  constructor(source) {
    this.crlf = source.indexOf('\r\n') != -1 && '\r\n' ||
      source.indexOf('\r') != -1 && '\r' || '\n';
    this.crlfLength = this.crlf.length;

    this.bol = 0;
    this.eol = 0;
    this.column = 1;
    this.line = 1;
    this.source = source;
    this.scan(null);
  }

  /**
   * 返回扫描到的非空白行字符串和位置信息, 并前进. 结构:
   *   {source, offset, line, column}
   * @return {Object|null} token 返回 null 表示 EOF
   */
  scan() {
    let tok = {
      source: this.source.substring(this.bol, this.eol).trimRight(),
      offset: this.bol,
      line: this.line,
      column: this.column
    };

    if (this.eol === this.source.length) {
      this.bol = this.eol;
      return tok.source && tok || null;
    }

    if (this.eol) {
      this.bol = this.eol + this.crlfLength;
      this.line++;
      this.column = 1;
    }

    this.eol = this.source.indexOf(this.crlf, this.bol);

    if (this.eol === -1)
      this.eol = this.source.length;

    while (1) {
      let c = this.source.charCodeAt(this.bol);
      if (c === 32 || c === 9) {
        this.bol++;
        this.column++;
        continue;
      }

      if (this.eol !== this.bol) break;
      if (this.eol === this.source.length) break;

      this.line++;
      this.column = 1;

      this.bol = this.eol + this.crlfLength;
      this.eol = this.source.indexOf(this.crlf, this.bol);

      if (this.eol === -1)
        this.eol = this.source.length;
    }

    return tok;
  }
}

module.exports = function(source) {
  return new lineify(source);
};

},{}],5:[function(require,module,exports){
const lineify = require('./lineify'),
  compiler = require('./compiler'),
  context = require('./context'),
  util =  require('./util'),
  CONTINUATION = '&\\,+-/*|=([';

/**
 * PowCSS 负责解析 source 为节点树, 并拼接编译器的编译结果.
 * 在 PowCSS 中的插件就是 compiler, compiler 负责与 context 配合.
 */
class PowCSS {
  /**
   * @param  {?Compiler[]} plugins 编译器数组, 缺省为 [compiler()]
   */
  constructor(plugins) {
    this.plugins = plugins && plugins.length && plugins || [compiler()];
  }

  /**
   * 使用一个编译器插件
   * @param  {Compiler} plugin
   * @return {this}
   */
  use(plugin) {
    if (plugin)
      this.plugins.push(plugin);
    return this;
  }

  /**
   * 包装 this.result = this.parse(source) 并返回 this.
   * @param  {string}  source  源码
   * @return {this}
   */
  process(source) {
    this.result = source;
    if (!source) return this;
    this.result = this.parse(source);
    return this;
  }

  /**
   * 解析 source 为节点树.
   * 节点类型:
   *   1. root    {mode:'root', nodes}
   *   1. comment {mode:'comment', source} 只保留非行尾注释
   *   1. decl    {mode:'decl', source, key, val}
   *   1. pending {mode:'', source, nodes}
   *
   * 即所有 !mode 的节点需要通过编译插件进行确认
   * @param  {string} source 源码
   * @return {object} root 节点树
   */
  parse(source) {
    if (typeof source !== 'string') return source;

    let root = {
          offset: 0,
          line: 0,
          column: 0,
          mode: 'root',
          nodes: []
        },
        parent = root,
        stack = [],
        i = 0,
        tokens = [],
        lines = lineify(source),
        tok = lines.scan(),
        algin = tok && tok.column || 1;

    while (tok) {
      tokens.push(tok);
      tok = lines.scan();
    }

    while (i < tokens.length) {
      tok = tokens[i];

      while (tok.column <= parent.column) {
        parent = stack.pop();
        algin = parent.nodes[parent.nodes.length - 1].column;
      }

      // 传统花括号块格式
      if (tok.source[0] === '}') {
        let last = parent.nodes[parent.nodes.length - 1];
        if (!last.source.endsWith('{'))
          throw new Error(util.info(`Unpaired brackets from ${last.line}:${last.column}` , tok));
        last.source = last.source.slice(0, -1).trimRight();
        i++;
        continue;
      }

      if (tok.column > algin) {
        algin = tok.column;
        tok.nodes = tok.nodes || [];
        stack.push(parent);
        if (!parent.nodes.length)
          throw new Error(util.info('PowCSS broken', tok));
        parent = parent.nodes[parent.nodes.length - 1];
        continue;
      }
      i++;
      parent.nodes.push(tok);

      if (tok.source.startsWith('//')) {
        tok.mode = 'comment';
        continue;
      }

      if (tok.source.startsWith('/*')) {
        if (tok.source.endsWith('*/'))
          tok.mode = 'comment';
        else while (i < tokens.length) {
          tok.source += '\n' + tokens[i++].source;
          if (tok.source.endsWith('*/')) {
            tok.mode = 'comment';
            break;
          }
        }
        if (tok.mode !== 'comment')
          throw new Error(util.info('Unclosed comments', tok));
        continue;
      }

      let tail = tok.source.indexOf(' //');

      /**
       * 行尾注释必须以 ' //' 开头
       */
      if (tail !== -1)
        tok.source = tok.source.substring(0, tail).trim();

      /**
       * 属性名和值不能以 '@' 开头
       * 属性分隔符 ':' 之后必须是空格或者换行 `:[ \n]`
       */
      let pos = tok.source[0] === '@' && -1 || tok.source.indexOf(':') + 1;
      tok.mode = pos > 0 &&
        (pos === tok.source.length || tok.source[pos] === ' ') &&
        'decl' || '';

      tok.nodes = [];

      /**
       * 续行符包括 `\\,+-/*|=([`
       */
      tail = CONTINUATION.indexOf(tok.source.charAt(tok.source.length - 1));
      if (tail === 1)
        tok.source = tok.source.slice(0, -1).trim();
      if (tail > 0 && tok.mode === '' ||
        tail !== -1 && tok.mode === 'decl')

      while (i < tokens.length) {
        let t = tokens[i++];
        // 不检查缩进, 忽略注释
        if (t.source.startsWith('//')) continue;

        if (t.source.startsWith('/*')) {
          while (!t.source.endsWith('*/') &&
            i < tokens.length) {
            t = tokens[i++];
          }
          continue;
        }

        tail = t.source.indexOf(' //');
        tok.source += tail === -1 && t.source ||
          t.source.substring(0, tail).trimRight();

        tail = CONTINUATION.indexOf(tok.source.charAt(tok.source.length - 1));

        if (tail === 1)
          tok.source = tok.source.slice(0, -1).trim();

        if (tail === -1 || tail === 0 && tok.mode === '')
          break;
      }

      if (tok.mode === 'decl') {
        tok.key = tok.source.substring(0, pos - 1).trimRight();
        tok.val = tok.source.substring(pos).trimLeft();
      }
    }

    return root;
  }

  /**
   * 格式化输出 root.nodes
   * @param  {object} root 解析后的节点树
   * @return {string} CSS  无花括号两空格缩进格式
   */
  format(root) {
    let fmt = '',
        sp = '\n';
    this.walk(root.nodes, null, (n, c, i, ns) => {
      if (fmt) fmt += sp;
      switch (n.mode) {
        case 'comment':
          fmt += n.source.replace('\n', sp + ' ');
          break;
        case 'decl':
          fmt += n.key + ': ' + n.val;
          break;
        default: // block, rule
          fmt += n.source;
          break;
      }
      if (!i && n.nodes && n.nodes.length) {
        sp += '  ';
      }else if (i && i + 1 === ns.length) {
        sp = sp.slice(0, -2);
      }
      return true;
    });

    return fmt;
  }

  /**
   * 遍历 this.result 所有节点拼接编译插件的编译结果.
   * 未被编译的节点和其子节点被抛弃.
   * @return {string}  body 编译后的函数主体代码;
   */
  compile() {
    let root = this.result, plugins = this.plugins;
    if (!root || root.mode != 'root')
      return '';
    let ctx = {body: ''};
    let compile = (item, ctx, index, nodes) => {
      let body;
      plugins.some((plugin) => {
        if (typeof plugin.compile === 'function') {
          body = plugin.compile(item, index, nodes);
          return body != null;
        }});

      if (!body || body === ' ') return false;

      let pos = body.indexOf('...');

      if (pos !== -1) {
        if (body.indexOf('...', pos + 1) !== -1)
          throw new Error(util.info('Nested placeholders too much', item));

        if (!item.nodes || !item.nodes.length)
          throw new Error(util.info('Nested placeholders can not be used for empty nodes', item));
      }

      if (item.nodes && item.nodes.length) {
        let child = {body: ''};
        this.walk(item.nodes, child, compile);
        if (pos !== -1)
          body = body.substring(0, pos) + child.body + body.substring(pos + 3);
        else
          body += '\n' + child.body;
      }

      ctx.body += body + '\n';
      return false;
    };

    this.walk(root.nodes, ctx, compile);
    return ctx.body;
  }

  /**
   * 返回 Function(params, this.compile(this.result + ';return '+ params.split(',')[0]))
   *
   * @param  {?string} params 形参, 缺省为 'ctx'
   * @return {object}  ctx
   */
  build(params) {
    params = params || 'ctx';

    return Function( // jshint ignore:line
        params,
        this.compile() + ';return ' + params.split(',')[0]
    );
  }

  /**
   * 包装 process, build 并返回执行结果
   * @param  {string}  source CSS 源码
   * @param  {?string} params 形参, 缺省为 'ctx'
   * @param  {?array}  args   实参, 缺省为 [context()]
   * @return {object}
   */
  run(source, params, args) {
    return this.process(source).build(params)(...(args || [context()]));
  }

  /**
   * 使用 nodes.forEach 深度遍历节点树并调用 callback(item, context, index, nodes).
   * 如果 callback 返回非真值, item.nodes 将不参与遍历.
   * @param  {array} nodes
   * @param  {Object} context 上下文
   * @param  {function(object,object,number,array):Boolean} callback 回调函数
   * @return {this}
   */
  walk(nodes, context, callback) {
    if (nodes && typeof nodes.forEach === 'function')
    nodes.forEach((item, index) => {
      if (callback(item, context, index, nodes) && item.nodes)
        this.walk(item.nodes, context, callback);
    }, this);

    return this;
  }
}

module.exports = function(plugins) {
  return new PowCSS(plugins);
};

},{"./compiler":2,"./context":3,"./lineify":4,"./util":6}],6:[function(require,module,exports){
const toString = Object.prototype.toString;

/**
 * 辅助方法集合
 */
let util = {
  /**
   * 返回包含位置信息的字符串, 常用于出错信息
   * @param  {string}  message 自定义信息
   * @param  {object}  loc     含有 line, column 的位置信息
   * @param  {?string} at      缺省为 <anonymous>
   * @return {string}
   */
  info: function(message, loc, at) {
    return `${message} at: ${at || '<anonymous>'}:${loc.line}:${loc.column}`;
  },
  /**
   * isObject
   * @param  {*} x
   * @return {Boolean}
   */
  isObject: function(x) {
    return toString.call(x) === '[object Object]';
  },
  /**
   * isNumber
   * @param  {*} x
   * @return {Boolean}
   */
  isNumber: function(x) {
    return toString.call(x) === '[object Number]';
  },
  /**
   * isArray
   * @param  {*} x
   * @return {Boolean}
   */
  isArray: function(x) {
    return Array.isArray(x);
  },
  /**
   * isString
   * @param  {*} x
   * @return {Boolean}
   */
  isString: function(x) {
    return typeof x === 'string';
  },
  /**
   * isFunction
   * @param  {*} x
   * @return {Boolean}
   */
  isFunction: function(x) {
    return typeof x === 'function';
  }
};

module.exports = util;

},{}]},{},[1]);
