const IFX = /if[ ]+([_$a-zA-Z]+)[ ]*=/,
  util =  require('./util');

/**
 * scripts 所有方法采用原生 js 语法, 自动补全 this.render, 工作期:
 *   compile
 */
class scripts{

  /**
   * 预留一个选项, 方便扩展
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
    if (!n.source.startsWith('if(') &&
      !n.source.startsWith('if (')
      ) return false;

    n.type = 'block';
    let body = n.source;
    if (body.indexOf('this.render(') === -1)
      body += 'this.render(ctx,....);';

    if (!body.endsWith(';')) body += ';';

    if (!body.endsWith('else return') &&
      !body.endsWith('else return;'))
      body += 'else return;';

    if (!body.endsWith(';')) body += ';';
    n.scripts = {args: '',body: body};
    return true;
  }

  /**
   * each 规则以函数方式实现. 语法: 注意尾部两个括号必须连续
   *
   *   ctx.each(expr, (val, key))               // 自动补全为
   *   ctx.each(expr, (val, key)=>{this.render(ctx,val, key,....)})
   *   ctx.each(expr, (val, key)=>{code})       // 必须包含 this.render
   *
   */
  each(n, ctx, i, ns) {
    if (!n.source.startsWith('ctx.each(')) return false;
    let body = n.source, args = '';

    if (!body.endsWith('})') && !body.endsWith('))'))
      throw new Error(util.info(`illegal ctx.each`, n));

    let x = body.lastIndexOf(
      ')=>'),
      s = body.lastIndexOf('(', x);

    if (body.indexOf('this.render(') === -1) {
      if (body.endsWith('))')) {
        x = body.lastIndexOf('(', body.length - 3);
        if (x === -1)
          throw new Error(util.info(`illegal ctx.each`, n));
        args = body.slice(x + 1, -2);
        body = body.slice(0, -1) + '=>{this.render(ctx,' +
          body.slice(x + 1, -2) + ',....)})';
      }else {
        if (x === -1 || s === -1)
          throw new Error(util.info(`illegal ctx.each`, n));
        args = body.slice(s + 1, x);
        body = body.slice(0, -2).trim();
        if (!body.endsWith(';') && !body.endsWith('{')) body += ';';
        body += 'this.render(ctx,' + args + ',....)})';
      }
    }else {
      if (x === -1 || s === -1)
        throw new Error(util.info(`illegal ctx.each`, n));
      args = body.slice(s + 1, x);
    }
    n.type = 'block';
    n.scripts = {args, body};
    return true;
  }

  /**
   * let 嵌入 js 代码并向下传递参数. 语法:
   *
   *   let v1 = expr; code;
   *   let [v1,v2] = [expr,expr]; code; // ES6 解构赋值
   */
  lets(n, ctx, i, ns) {
    if (!n.source.startsWith('let ')) return false;
    let  x = n.source.indexOf('=');
    if (x == -1)
      throw new Error(util.info(`illegal let`, n));

    let args = n.source.slice(4, x).trim();

    if (args[0] === '[')
      args = args.slice(1, -1);

    n.type = 'block';
    n.scripts = {args, body: ''};
  }

}

module.exports = function(option) {
  return new scripts(option);
};
