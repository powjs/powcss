const lineify = require('./lineify'),
  scripts = require('./scripts'),
  util =  require('./util'),
  CONTINUATION = '&\\,+-/*|=([';

/**
 * 插件接口定义, 理论上接口的行为是自由的, 事实上需要规范化才能正常工作.
 * 这里描述 PowCSS 规范行为.
 * @interface
 */
class Plugin {
  /**
   * 编译节点树中的一个 pending 节点生成渲染函数. 这里直接给出渲染函数的通用形式:
   *
   *   (function(ctx, param1, param2) {
   *     this.render(ctx, args1, args2) // 调用子节点渲染函数
   *   })(...args)
   *
   * 该形式包括
   *
   *   1. 上层传递实参的表达式 ...args
   *   2. 子节点渲染函数的形参 ctx, param1, param2
   *   3. 子节点渲染函数的实参 ctx, args1, args2
   *
   * 如果没有声明子节点形参, 继承当前节点的形参. 根本问题是如何描述这三个声明.
   *
   *  1. args   string 子节点渲染函数实参
   *  2. param  string 子节点渲染函数行参
   *  3. body   string 子节点渲染函数执行体
   *
   * 编译方法需要在节点上设置两个属性
   *
   *   1. .type string
   *     'block' 表示块规则, PowJS 自动识别是否包含子节点渲染代码 this.render
   *   2. .scripts object
   *     args  必选
   *     param 缺省合并 args 和继承形参, 除非显示定义
   *     body  缺省等于 source, 里面的 '....' 会被替换为继承形参列表

   * 其实最简单的方法是直接用 JavaScript 语法写, 比如:
   *
   *  let s='';\
   *  for(let x=1; x<=12; x++) {\
   *    s += `,.col-xs-${x},.col-md-${x},.col-lg-${x}`;\
   *  }
   *    ${s.slice(1)}
   *      position: relative
   *      min-height: 1px
   *      padding-right: ${ctx.colPaddingRight}px
   *      padding-left: ${ctx.colPaddingLeft}px
   *
   * 行尾 '\' 表示续行, 并行在解析中完成. 上例的 js 代码可合并为一行, 比如:
   *
   * let s=',';for(let x=1;x<=12;x++)s=`${s}.col-xs-${x},.col-md-${x},.col-lg-${x}`;
   *
   * PowCSS 预制几个 JS 规则
   *
   * @see scripts
   *
   * 提示:
   *
   * 任何时候都不应该更改 .source.
   *
   * 一个 block 规则必选包含子节点, 无论是 rule 或 decl
   *
   * 方便起见, PowCSS.compile 会对 args, render 进行 trim 处理.
   *
   * rule, decl 节点由 PowCSS 负责处理, 它们的格式是约定的:
   *
   *   1. rule 允许 key 使用嵌套符号 '&' 和模板表达式 '${expr}'
   *   2. decl 允许 key, val 使用模板表达式 '${expr}'
   *
   * @param  {object} node  node === nodes[index]
   * @param  {object} ctx   编译上下文选项
   * @param  {number} index
   * @param  {array}  nodes
   */
  compile(node, ctx, index, nodes) {}
}

/**
 * PowCSS 通过插件对 CSS 进行处理, 分多个工作期:
 *
 * process 预处理, 把输入源转换为节点树
 * render  渲染(后处理), 生成 CSSOM
 * cssify  输出渲染后的 CSS 源码
 */
class PowCSS {
  /**
   * @param  {?Plugin[]} plugins 处理器数组缺省为 [scripts()]
   */
  constructor(plugins) {
    this.plugins = plugins && plugins.length || [scripts()];
  }

  /**
   * 添加一个插件
   * @param  {Plugin} plugin
   * @return {this}
   */
  use(plugin) {
    if (plugin)
      this.plugins.push(plugin);
    return this;
  }

  /**
   * 预处理阶段入口, 转换 source 为节点树结构, 工作期:
   *   1. parse(source)  -> root, 缺省为 this.parse
   *   1. compile(root)  -> root, 调用 this.compile, 如果 context 可用
   * @param  {string}  source  源码
   * @param  {?Object} context 编译需要的上下文
   * @return {this}
   */
  process(source, context) {
    this.result = source;
    if (!source) return this;
    this.result = this.parse(source);
    return context && this.compile(context) || this;
  }

  /**
   * 预处理阶段缺省 parse, 解析 source 为节点树.
   * 节点类型:
   *   1. root    {type:'root', nodes}
   *   1. comment {type:'comment', source}
   *   1. decl    {type:'decl', source, key, value}
   *   1. pending {type:'', source, nodes}
   *
   * 即所有未确定的需要通过编译认定 type;
   * @param  {string} source 源码
   * @return {object} root 节点树
   */
  parse(source) {
    if (typeof source !== 'string') return source;

    let root = {
          offset: 0,
          line: 0,
          column: 0,
          type: 'root',
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
      // DEBUG
      if (!parent.nodes) console.log(tok);
      parent.nodes.push(tok);

      if (tok.source.startsWith('//')) {
        tok.type = 'comment';
        continue;
      }

      if (tok.source.startsWith('/*')) {
        if (tok.source.endsWith('*/'))
          tok.type = 'comment';
        else while (i < tokens.length) {
          tok.source += '\n' + tokens[i++].source;
          if (tok.source.endsWith('*/')) {
            tok.type = 'comment';
            break;
          }
        }
        if (tok.type !== 'comment')
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
      tok.type = pos > 0 &&
        (pos === tok.source.length || tok.source[pos] === ' ') &&
        'decl' || '';

      tok.nodes = [];

      /**
       * 续行符包括 `\\,+-/*|=([`
       */
      tail = CONTINUATION.indexOf(tok.source.charAt(tok.source.length - 1));
      if (tail === 1)
        tok.source = tok.source.slice(0, -1).trim();
      if (tail > 0 && tok.type === '' ||
        tail !== -1 && tok.type === 'decl')

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

        if (tail === -1 || tail === 0 && tok.type === '')
          break;
      }

      if (tok.type === 'decl') {
        tok.key = tok.source.substring(0, pos - 1).trimRight();
        tok.val = tok.source.substring(pos).trimLeft();
      }
    }

    return root;
  }

  /**
   * 格式化输出 root 节点树
   * @param  {object} root 解析后的节点树
   * @return {string} CSS  无花括号两空格缩进格式
   */
  format(root) {
    let fmt = '',
        sp = '\n';
    this.walk(root.nodes, null, (n, c, i, ns) => {
      if (fmt) fmt += sp;
      switch (n.type) {
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
   * 预处理 compile 入口, 使用 this.walk 遍历 this.result 执行 compile 处理.
   * 插件设置 type 为 'block' 表示 compile 完成, 否则尝试其它插件进行编译.
   * @param  {?Object} context 上下文, 缺省为 {params:[]}, params 是形参
   * @return {this}
   */
  compile(context) {
    let root = this.result, plugins = this.plugins;
    if (!root || root.type != 'root')
      return this;

    context = context || {};
    context.params = context.params || [];

    return this.walk(root.nodes, context, function(item, context, index, nodes) {
        plugins.some((plugin) => {
          if (!item.type && typeof plugin.compile === 'function') {
            plugin.compile(item, context, index, nodes);
            return !!item.type;
          }});

        if (item.type && item.type !== 'block' ||
            item.type && (
              !Array.isArray(item.nodes) ||
              !item.nodes.length ||
              typeof item.scripts !== 'object' ||
              typeof item.scripts.args !== 'string'
          ))
            throw new Error(util.info(`illegal type ${itm.type}`, item));

        if (!item.type)
          item.type = 'rule';
        else {
          item.args = item.args.trim();
          item.render = [
            item.render[0].trim(),
            item.render[1].trim()
          ];

          // TODO: ?function
        }
        return true;
      });
  }

  /**
   * 使用 nodes.every 深度遍历节点树并调用 callback(item, context, index, nodes).
   * 如果 callback 返回非真值, item.nodes 将不参与遍历.
   * @param  {array} nodes
   * @param  {Object} context 上下文
   * @param  {function(object,object,number,array):Boolean} callback 回调函数
   * @return {this}
   */
  walk(nodes, context, callback) {
    if (nodes && typeof nodes.every === 'function')
    nodes.every((item,index) => {
      if (!callback(item, context, index, nodes))
        return false;
      this.walk(item.nodes, context, callback);
      return true;
    }, this);

    return this;
  }

}

module.exports = function(plugins) {
  return new PowCSS(plugins);
};
