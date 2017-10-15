/**
 * lineify 是个非空白行扫描器, 扫描并返回非空白行信息.
 * @param {string} source 待扫描的字符串
 */
class lineify{
  constructor(source) {
    this.crlf = source.indexOf('\r\n') != -1 && '\r\n' ||
      source.indexOf('\r') != -1 && '\r' || '\n';
    this.crlfLength = this.crlf.length;

    this.bol = 0;
    this.eol = 0;
    this.column = 1;
    this.line = 1;
    this.source = source;
    this.scan(null);
  }

  /**
   * 返回扫描到的非空白行字符串和位置信息, 并前进. 结构:
   *   {source, offset, line, column}
   * @return {Object|null} token 返回 null 表示 EOF
   */
  scan() {
    let tok = {
      source: this.source.substring(this.bol, this.eol).trimRight(),
      offset: this.bol,
      line: this.line,
      column: this.column
    };

    if (this.eol === this.source.length) {
      this.bol = this.eol;
      return tok.source && tok || null;
    }

    if (this.eol) {
      this.bol = this.eol + this.crlfLength;
      this.line++;
      this.column = 1;
    }

    this.eol = this.source.indexOf(this.crlf, this.bol);

    if (this.eol === -1)
      this.eol = this.source.length;

    while (1) {
      let c = this.source.charCodeAt(this.bol);
      if (c === 32 || c === 9) {
        this.bol++;
        this.column++;
        continue;
      }

      if (this.eol !== this.bol) break;
      if (this.eol === this.source.length) break;

      this.line++;
      this.column = 1;

      this.bol = this.eol + this.crlfLength;
      this.eol = this.source.indexOf(this.crlf, this.bol);

      if (this.eol === -1)
        this.eol = this.source.length;
    }

    return tok;
  }
}

module.exports = function(source) {
  return new lineify(source);
};
