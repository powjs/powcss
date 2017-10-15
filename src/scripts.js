/**
 * scripts 提供 let, if, each  语句支持, 工作期:
 *   identify
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
   * identify 入口
   */
  identify(context, node, parent, root) {

  }

  /**
   * compile 入口
   */
  compile(context, node, parent, root) {

  }

  ify() {
  }

  each() {
  }

  lets() {
  }

}

/**
 * comment 负责识别单行注释和块注释
 */
function comment(lines, som, stack) {
  while (1) {
    let loc = {},
      line = this.lines.next(loc);

    if (!line) return;

    som = cssom(line, loc);

    if (col === loc.column) {
      stack.push(som);
    } else if (col > loc.column) {
      som.children = [];
      compiler(lines, stack, loc.column);
    }
  }
}

module.exports = function() {
  return new directives();
};
