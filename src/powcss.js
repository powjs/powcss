const lineify = require('./lineify'),
  scripts = require('./scripts'),
  toString = Object.prototype.toString,
  CONTINUATION = '&,+-/*|=([',
  msg = function(msg, tok) {
    return `${msg} at: <anonymous>:${tok.line}:${tok.column}`;
  };

/**
 * PowCSS 分一些步骤对 CSS 进行处理.
 *
 * process 预处理, 把输入源转换为节点树结构
 *
 *    处理器 Object<string, function> 负责转换输入源, 键值表示工作期
 *    处理器返回 undefined 表示未完成任务, 继续尝试其它同类型处理器.
 *    如果一个工作期结束仍完成任务, 则直接返回当前的输入源
 *
 * compile    编译, 在节点上生成一个 render 函数
 * render     渲染, 生成 CSSOM
 * stringify  在 CSSOM 的基础上生成 CSS 源码
 *
 * @inner
 */
class PowCSS {
  /**
   * @param  {Array<object<string, function>>} plugins 处理器数组缺省为 [scripts()]
   */
  constructor(plugins) {
    this.plugins = plugins || [scripts()];
  }

  /**
   * 添加一个插件
   * @param  {Object<string, function>} plugin
   * @return {this}
   */
  use(plugin) {
    if (plugin)
      this.plugins.push(plugin);
    return this;
  }

  /**
   * 预处理阶段入口, 转换 source 为节点树结构, 工作期:
   *   1. tokenizes(source)   -> array, 缺省为 this.tokenizes
   *   1. root(array)    -> root, 缺省为 this.root
   *   1. identify(root) -> root
   * @param  {string}
   * @return {this}
   */
  process(source) {
    this.result = source;
    if (!source) return this;
    this.plugins.some((chip)=> {
      this.result = chip.tokenizes && chip.tokenizes(source);
      return !!this.result;
    });

    this.result = this.result || this.tokenizes(source);

    if (!this.result) {
      this.result = source;
      return this;
    }

    source = this.result;
    this.plugins.some((chip)=> {
      this.result = chip.root && chip.root(source);
      return !!this.result;
    });

    this.result = this.result || this.root(source);

    if (!this.result) {
      this.result = source;
      return this;
    }

    source = this.result;
    this.plugins.some((chip)=> {
      this.result = chip.identify && chip.identify(source);
      return !!this.result;
    });

    this.result = this.result || this.identify(source);
    return this;
  }

  /**
   * 预处理阶段缺省 tokenizes, 接受字符串类型.
   * @param  {*} source
   * @return {array} tokens
   */
  tokenizes(source) {
    if (typeof source !== 'string') return;
    let toks = [],
        lines = lineify(source),
        tok = lines.scan();
    while (tok) {
      toks.push(tok);
      tok = lines.scan();
    }
    return toks;
  }

  /**
   * 预处理阶段缺省 root, 对 tokens 进行类型识别, 并转换为节点树.
   * 节点类型:
   *   1. root    {type:'root', nodes}
   *   1. comment {type:'comment', text}
   *   1. rule    {type:'rule', selector, nodes}
   *   1. decl    {type:'decl', prop, value}
   * @param  {root}
   */
  root(tokens) {
    if (!Array.isArray(tokens) || !tokens.length ||
      toString.call(tokens[0]) !== '[object Object]' ||
      typeof tokens[0].source !== 'string' ||
      typeof tokens[0].offset !== 'number' ||
      typeof tokens[0].line !== 'number' ||
      typeof tokens[0].column !== 'number')
       return;

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
      tok = tokens[0],
      algin = tok && tok.column || 1;

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
        'decl' || 'rule';

      tok.nodes = [];

      /**
       * 续行符包括 `,+-/*|=([`
       */
      tail = CONTINUATION.indexOf(tok.source.charAt(tok.source.length - 1));

      if (tail > 0 && tok.type === 'rule' ||
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
        if (tail === -1 || tail === 0 && tok.type === 'rule')
          break;
      }

      if (tok.type === 'decl') {
        tok.value = tok.source.substring(pos).trimLeft();
        tok.source = tok.source.substring(0, pos - 1).trimRight();
      }
    }

    return root;
  }

  /**
   * 预处理阶段缺省 identify 入口, 使用 this.walk 遍历节点树, 执行 identify 处理.
   * 鉴定操作是对每个节点进行修改, 以及重新标记的过程.
   * 提示:
   *
   *   如果节点不在插件的处理范围, 也应该返回 true, 否则会中断子节点的遍历
   *
   * @param  {Object} context 上下文
   * @return {this}
   */
  identify(context) {
    let root = this.result, plugins = this.plugins;
    if (!root || root.type != 'root')
      return;

    return this.walk(root.nodes, context, function(item, context, index, nodes) {
      return !plugins.some((plugin) => {
        if (typeof plugin.identify === 'function')
          return !plugin.identify(item, context, index, nodes);
        return false;
      });
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
    if (!nodes || typeof nodes.every !== 'function') return;
    nodes.every((item,index) => {
      if (!callback(item, context, index, nodes))
        return false;
      this.walk(item.nodes, context, callback);
      return true;
    }, this);

    return this;
  }

  /**
   * 编译阶段缺省 compile 入口, 使用 this.walk 遍历节点树, 执行 compile 处理.
   * 提示:
   *
   *   如果节点不在插件的处理范围, 也应该返回 true, 否则会中断子节点的遍历
   *
   * @param  {Object} context 上下文
   * @return {this}
   */
  compile(context) {
    let root = this.result, plugins = this.plugins;
    if (!root || root.type != 'root')
      return;

    return this.walk(root.nodes, context, function(item, context, index, nodes) {
      return !plugins.some((plugin) => {
        if (typeof plugin.compile === 'function')
          return !plugin.compile(item, context, index, nodes);
        return false;
      });
    });
  }
}

module.exports = function(plugins) {
  return new PowCSS(plugins);
};
