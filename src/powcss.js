const lineify = require('./lineify'),
  scripts = require('./scripts'),
  toString = Object.prototype.toString,
  CONTINUATION = '&,+-/*|=([',
  msg = function(msg, tok) {
    return `${msg} at: <anonymous>:${tok.line}:${tok.column}`;
  };

/**
 * 插件接口定义, 理论上接口的行为是自由的, 事实上需要规范化才能正常工作.
 * 这里描述 PowCSS 规范行为.
 * @interface
 */
class Plugin {
  /**
   * 预处理
   * @see PowCSS.parse
   */
  parse(source) {}

  /**
   * 编译节点树中的一个 pending 节点(不包括子节点), 生成参数数据.
   * 解析后, 所有非 comment, decl 节点都是 pending 节点.
   * 插件处理自己认识的节点, 附加参数数据并标记 type 为 'block'.
   * 一旦节点类型被标记, 不再尝试其它插件.
   *
   * 参数数据是为了生成可执行渲染函数, 因此参数数据包括
   *
   *   1. 上层传递实参的表达式
   *   2. 本节点渲染函数的形参
   *   3. 约定上下文参数 ctx 总是被添加, 并且不需要显示声明
   *
   * 所以最终需要编译插件确定两个参数数据
   *
   *  1. args   string 实参表达式
   *  2. params string 行参, ctx 总是自动添加到第一个
   *
   * 即编译解决的核心问题是:
   *
   *   (function(...params){
   *   })(...args)
   *
   * 提示: rule, decl 节点由 PowCSS 负责处理, 它们的格式是约定的:
   *
   *  1. rule 允许 key 使用嵌套符号 '&' 和模板表达式 '${expr}'
   *  2. decl 允许 key, val 使用模板表达式 '${expr}'
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

    this.plugins.some((chip)=> {
      this.result = chip.parse && chip.parse(source);
      return !!this.result;
    });

    this.result = this.result || this.parse(source);

    if (!this.result)
      this.result = source;
    else if (context)
      this.compile(context);

    return this;
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
    if (typeof source !== 'string') return;

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
          throw new Error(msg(`Unpaired brackets from ${last.line}:${last.column}` , tok));
        last.source = last.source.slice(0, -1).trimRight();
        i++;
        continue;
      }

      if (tok.column > algin) {
        algin = tok.column;
        tok.nodes = tok.nodes || [];
        stack.push(parent);
        if (!parent.nodes.length)
          throw new Error(msg('PowCSS broken', tok));
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
          throw new Error(msg('Unclosed comments', tok));
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
       * 续行符包括 `,+-/*|=([`
       */
      tail = CONTINUATION.indexOf(tok.source.charAt(tok.source.length - 1));

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
        case '':
          fmt += n.source;
          break;
        case 'decl':
          fmt += n.key + ': ' + n.val;
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
   * 预处理阶段 compile 入口, 使用 this.walk 遍历 this.result 执行 compile 处理.
   * 插件返回 true 表示 compile 完成, 否则尝试其它插件进行编译.
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
      return plugins.some((plugin) => {
        if (!item.type && typeof plugin.compile === 'function') {
          plugin.compile(item, context, index, nodes);
          return !!item.type;
        }

        item.type = item.type || 'rule';
        if (item.type !== 'block' && item.type !== 'rule')
          throw new Error(`illegal type ${itm.type}`, item);
        return false;
      }) || true;
    });
  }

  /**
   * 使用 nodes.every 深度遍历节点树并调用 callback(item, context, index, nodes).
   * 如果 callback 返回非真值, item.nodes 将不参与遍历.
   * @param  {array} nodes
   * @param  {Object} context 上下文
   * @param  {function(object,object,number,array):bool} callback 回调函数
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
