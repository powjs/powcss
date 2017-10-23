const toString = Object.prototype.toString;

/**
 * 辅助方法集合
 */
let util = {
  /**
   * 返回包含位置信息的字符串, 常用于出错信息
   * @param  {string}  message 自定义信息
   * @param  {object}  loc     含有 line, column 的位置信息
   * @param  {?string} at      缺省为 <anonymous>
   * @return {string}
   */
  info: function(message, loc, at) {
    return `${message} at: ${at || '<anonymous>'}:${loc.line}:${loc.column}`;
  },
  /**
   * isObject
   * @param  {*} x
   * @return {Boolean}
   */
  isObject: function(x) {
    return toString.call(x) === '[object Object]';
  },
  /**
   * isNumber
   * @param  {*} x
   * @return {Boolean}
   */
  isNumber: function(x) {
    return toString.call(x) === '[object Number]';
  },
  /**
   * isArray
   * @param  {*} x
   * @return {Boolean}
   */
  isArray: function(x) {
    return Array.isArray(x);
  },
  /**
   * isString
   * @param  {*} x
   * @return {Boolean}
   */
  isString: function(x) {
    return typeof x === 'string';
  },
  /**
   * isFunction
   * @param  {*} x
   * @return {Boolean}
   */
  isFunction: function(x) {
    return typeof x === 'function';
  }
};

module.exports = util;
