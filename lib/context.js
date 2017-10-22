/**
 * @typedef {object} Rule   抽象规则
 * @property {string} name  规则名, 也可能是个定义值, 比如 @charset
 * @property {?object<string, string|Rule>} decls 键值声明
 */

/**
 * PowCSS 缺省的 Context 实现.
 * 该实现不分析 CSS 规则的合法性, 只提供结构上的操作和一些辅助方法.
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
   * 当前规则入栈, 并开启一个新具名规则并替换 name 中的占位符 '&'.
   * 该方法必须与 close 成对使用. 嵌套使用 open 会产生嵌套规则.
   * @param  {string} name
   * @return {this}
   */
  open(name) {
    if (this.rule) {
      if (name.indexOf('&') !== -1)
        name = name.replace(/&/g, this.name());
      this.stack.push(this.rule);
    }
    this.rule = {name};
    this.rules.push(this.rule);
    return this;
  }

  /**
   * 关闭当前的规则, 并弹出规则栈. 该方法必须与 .open 成对使用.
   * @return {this}
   */
  close() {
    let rule = this.stack.pop();
    this.rule = rule;
    return this;
  }

  /**
   * 返回 this.rule.name
   * @return {string}
   */
  name() {
    return this.rule.name;
  }

  /**
   * 返回或设置当前规则的 key 声明
   * @param  {string}  key
   * @param  {?string|object} val
   * @return {string|object}
   */
  decl(key, val) {
    if (val) {
      if (!this.rule.decls)
        this.rule.decls = {};
      this.rule.decls[key] = val;
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
        for (let key in rule.decls) {
          if (typeof rule.decls[key] === 'string')
            css += key + ': ' + rule.decls[key] + ';\n';
          else if (Array.isArray(rule.decls[key])) {
            css += rule.decls[key].reduce(toCSS, '') + '\n';
          }else {
            throw new Error('decls must be a string or array: ' + rule.name + '{' + key + '}');
          }
        }
        css += '}\n';
      }else if (rule.name[0] === '/') // comment
        css += rule.name + '\n';
      else
        css += rule.name + ';\n';
      return css;
    };

    return this.rules.reduce(toCSS, '');
  }
}

module.exports = function(...extend) {
  return new Context(...extend);
};
