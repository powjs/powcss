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
   * 编译 n.mode === 'comment' 的节点
   * 返回值是 ' ', 这意味着注释被丢弃
   */
  comment(n) {
    if (n.mode !== 'comment') return;
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
