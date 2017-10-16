/**
 * scripts 提供 let, if, each 块语句支持, 工作期:
 *   compile
 *   export
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
    return !n.type &&
      (
        this.ify(n, ctx, i, ns) ||
        this.each(n, ctx, i, ns) ||
        this.lets(n, ctx, i, ns)
      ) || false;
  }

  ify(n, ctx, i, ns) {
    if(!n.source.startsWith('if ')) return false;
    n.type = 'powcss-if';
    //n.render = ;
    return true;
  }

  each(n, ctx, i, ns) {
  }

  lets(n, ctx, i, ns) {
  }

}


module.exports = function(option) {
  return new scripts(option);
};
