const IFX = /if[ ]+([_$a-zA-Z]+)[ ]*=/,
  util =  require('./util');

/**
 * scripts 采用原生 js 语法提供 let, if, each 规则支持, 工作期:
 *   compile
 */
class scripts{

  /**
   * 接受一个选项参数, 细节参见相关方法
   * @param  {?Object} option
   */
  constructor(option) {
    this.option = option || {};
  }

  /**
   * compile 入口
   */
  compile(n, ctx, i, ns) {
    return !n.type && (
        this.ify(n, ctx, i, ns) ||
        this.each(n, ctx, i, ns) ||
        this.lets(n, ctx, i, ns)
      ) || false;
  }

  /**
   * if 块语句以函数方式实现, 当条件成立块被执行. 语法:
   *
   *    if (expr)  // 自动补全为
   *    if (expr) this.render(ctx,....);else return;
   *
   * 即: 先补全 this.render, 再补全 else return;
   */
  ify(n, ctx, i, ns) {
    if (!n.source.startsWith('if ')) return false;
    let m = n.source.match(IFX),
      ify = m && m[1] || '$';
    n.type = 'block';
    n.args = n.source.substring(m && m[0].length || 3);
    n.render = [ify, `if(!${ify}) return;....;`];
    return true;
  }

  /**
   * each 规则以函数方式实现. 语法: 注意尾部两个括号必须连续
   *
   *   ctx.each(expr, (val, key))               // 自动补全为
   *   ctx.each(expr, (val, key)=>{this.render(ctx,val, key,....)})
   *   ctx.each(expr, (val, key)=>{code})       // 必须包含 this.render
   *   ctx.each(expr, function(val, key){code}) // 必须包含 this.render
   *
   * 即: 如果尾部括号为 '})', 必须含有完整的 this.render
   */
  each(n, ctx, i, ns) {
    if (!n.source.startsWith('each ')) return false;
    let  x = n.source.indexOf(' of ');

    if (x == -1)
      throw new Error(util.info(`illegal each`, n));
    let vk = n.source.substring(5, x);
    n.type = 'block';
    n.args = n.source.substring(x + 1);
    n.render = [`$`, `ctx.each($, function(${vk}){....;})`];
    return true;
  }

  /**
   * let 规则采用原生 JS 语法, 表示嵌入 js 代码并向下传递参数. 语法:
   *
   *   let v1 = expr; code;
   *   let [v1,v2] = [expr,expr]; code; // ES6 解构赋值
   *
   * 变量名 vN... 会传递给子渲染函数, 形参的和实参的
   */
  lets(n, ctx, i, ns) {
    if (!n.source.startsWith('let ')) return false;
    let  x = n.source.indexOf('=');
    if (x == -1)
      throw new Error(util.info(`illegal let`, n));

    let args = n.source.slice(4, x).trim();

    if (args[0] === '[')
      args = args.slice(1, -1);

    n.scripts = {args};
  }

}

module.exports = function(option) {
  return new scripts(option);
};
