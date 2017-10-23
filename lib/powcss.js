const lineify = require('./lineify'),
  compiler = require('./compiler'),
  context = require('./context'),
  util =  require('./util'),
  CONTINUATION = '&\\,+-/*|=([',
  CONTINUE =
    /\bcontinue\( *((?:\.|[$a-zA-Z_]+[$\w]*)(?: *, *[$a-zA-Z_.]+[$\w]*)*)* *\)/;

/**
 * PowCSS 负责解析 source 为节点树, 并拼接编译器的编译结果.
 * 在 PowCSS 中的插件就是 compiler, compiler 负责与 context 配合.
 */
class PowCSS {
  /**
   * @param  {?Compiler[]} plugins 编译器数组, 缺省为 [compiler()]
   */
  constructor(plugins) {
    this.plugins = plugins && plugins.length || [compiler()];
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
