const toString = Object.prototype.toString;

/**
 * 辅助函数集合, ctx 总是(扩展)继承 util 的所有方法.
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
  },

  /**
   * 遍历 x 回调 callback(val, key)
   * @param  {object|array}   x
   * @param  {Function} callback
   */
  each: function(x, callback) {
    if (Array.isArray(x)) {
      x.forEach(callback);
    }else
      Object.keys(x).forEach(function(key) {
        callback(x[key], key);
      });
  }
};

module.exports = util;
