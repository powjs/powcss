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
    extend.forEach((ext) => {
      if (typeof ext === 'function')
        this[ext.name] = ext;
      else if (Object.prototype.toString.call(ext) === '[object Object]') {
        for (let key in ext) {
          this[key] = ext[key];
        }
      }
    });
    this.reset();
  }

  /**
   * 重置 .rule, .rules, .stack 为初始状态
   * @return {this}
   */
  reset() {
    this.rule = null;
    this.rules = [];
    this.stack = [];
    return this;
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
