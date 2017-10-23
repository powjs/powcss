let test = require('tape'),
  lineify = require('../lib/lineify'),
  powcss = require('../lib/powcss'),
  context = require('../lib/context'),
  prettier = require('prettier');

function format(code, log) {
  if (typeof code != 'string')
   code = '!' + JSON.stringify(code);
  code = prettier.format(code, {semi: true});
  if (log)
    console.log(code);
  return code;
}

let lines = [
  {
    src: '',
    out: []
  }, {
    src: ' a',
    out: ['a,1,1,2']
  }, {
    src: ' \na',
    out: ['a,2,2,1']
  }, {
    src: ' \na\n',
    out: ['a,2,2,1']
  }, {
    src: ' a ',
    out: ['a,1,1,2']
  }, {
    src: ' \na ',
    out: ['a,2,2,1']
  }, {
    src:
      `
      2
      3
      `,
    out: ['2,7,2,7','3,15,3,7']
  }, {
    src:
      `
      2

      4
      `,
    out: ['2,7,2,7','4,16,4,7']
  }
];

test('lineify', function(assert) {
  for (var i = 0; i < (0 || lines.length); i++) {
    let t = lines[i],
      tokens = [],
      scanner = lineify(t.src),
      tok = scanner.scan(),
      j = 0;

    while (tok) {
      tokens.push(tok);
      tok = scanner.scan();
    }

    assert.equal(tokens.length, t.out.length, `broken: ${j}/${i}`);

    while (j < t.out.length) {
      let tok = tokens[j];

      if (!tok || !tok.source) {
        assert.fail(`empty: ${j}/${i}`);
        break;
      }

      let c = [tok.source, tok.offset,tok.line,tok.column].join(',');
      assert.equal(c, t.out[j++], `scan line: ${tok.line}  , ${j}/${i}`);
    }
  }
  assert.end();
});

let roots = [
  {
    src: 'div',
    css: `:0  div`,
    fmt: 'div'
  },{
    src: 'div\n color: red',
    css: `:0  div:0 decl color: red`,
    fmt: 'div\n  color: red'
  },{
    src: 'div{\n color: red\n}',
    css: `:0  div:0 decl color: red`,
    fmt: 'div\n  color: red'
  },{
    src: 'div\n each v,k of ctx.keys\n  color:   red  \n\n',
    css: `:0  div:0  each v,k of ctx.keys:0 decl color: red`,
    fmt: 'div\n  each v,k of ctx.keys\n    color: red'
  },{
    src: 'div{\n color: red\n width:  10px\n}',
    css: `:0  div:0 decl color: red:1 decl width: 10px`,
    fmt: 'div\n  color: red\n  width: 10px'
  },{
    src: 'let s=1;\\\nfor(let i=1;i<1;i++) {\\\ns=1;\\\n}',
    css: `:0  let s=1;for(let i=1;i<1;i++) {s=1;}`,
    fmt: 'let s=1;for(let i=1;i<1;i++) {s=1;}'
  },{
    src: 'let s=1;\n ${s}\n  color: red',
    css: ':0  let s=1;:0  ${s}:0 decl color: red',
    fmt: 'let s=1;\n  ${s}\n    color: red'
  }
];

test('root & format', function(assert) {
  for (var i = 0; i < (0 || roots.length); i++) {
    let css = roots[i],
      actual = '',
      pow = powcss([]),
      root = pow.parse(css.src),
      v = JSON.stringify(root.nodes);

    pow.walk(root.nodes, null,
      function(n, c, i) { // jshint ignore:line
        actual += `:${i} ${n.mode} ${n.key || n.source}` +
          (n.key ? `: ${n.val}` : '');
        return true;
      });

    if (actual === css.css) {
      assert.ok(true, `root: ${i}`);
    }else {
      assert.equal(actual, css.css, `root: ${i}:${v}`);
    }

    actual = pow.format(root);
    if (actual === css.fmt) {
      assert.ok(true, `fmt: ${i}`);
    }else {
      assert.equal(actual, css.fmt, `fmt: ${i}:${v}`);
    }
  }
  assert.end();
});

let scripts = [
  {
    src: 'let s=1;\n ${s}\n  color: red',
    js: 'let s = 1;\nctx.open(`${s}`);\nctx.decl("color", "red");\nctx.close();\n',
    rules: [{name: '1',decls: {color: 'red'}}],
    css:'1 {\ncolor: red;\n}\n'
  },{
    src: 'let [a,b]=[1,2];\n ${b}\n  color: red',
    js: 'let [a, b] = [1, 2];\nctx.open(`${b}`);\nctx.decl("color", "red");\nctx.close();\n',
    rules: [{name: '2',decls: {color: 'red'}}],
    css:'2 {\ncolor: red;\n}\n'
  },{
    src: 'if (b){...}\n ${b}\n  color: red',
    js: 'if (b) {\n  ctx.open(`${b}`);\n  ctx.decl("color", "red");\n  ctx.close();\n}\n',
    params: 'ctx,b',
    args: [context(), '.class'],
    rules: [{name: '.class',decls: {color: 'red'}}],
    css:'.class {\ncolor: red;\n}\n'
  }
];

test('compile && run', function(assert) {
  for (var i = 0; i < (0 || scripts.length); i++) {
    let js = scripts[i],
      actual = format(powcss([]).process(js.src).compile());

    assert.equal(actual, js.js);

    let ctx = powcss().run(js.src, js.params, js.args);

    assert.deepEqual(ctx.rules, js.rules, actual);
    assert.equal(ctx.toCSS(), js.css, actual);
  }
  assert.end();
});

let nested = [
  {
    src:'@charset "utf-8"',
    css:'@charset "utf-8";'
  },{
    src:'@media (max-width:599px)\n div\n  w: 1\n  c: 2',
    css:'@media (max-width:599px) {\ndiv {\nw: 1;\nc: 2;\n}\n}'
  },{
    src:'a\n &.b\n  w: 1',
    css:'a.b {\nw: 1;\n}'
  },{
    src:'a\n &.b\n  w: 1\n &.c\n  h: 2',
    css:'a.b {\nw: 1;\n}\na.c {\nh: 2;\n}'
  },{
    src:'@media (max-width:599px)\n a\n  &.b\n   w: 1\n  &.c\n   h: 2',
    css:'@media (max-width:599px) {\na.b {\nw: 1;\n}\na.c {\nh: 2;\n}\n}'
  },{
    src:'@media (max-width:599px)\n @page\n  a\n   &.b\n    w: 1\n   &.c\n    h: 2',
    css:'@media (max-width:599px) {\n@page {\na.b {\nw: 1;\n}\na.c {\nh: 2;\n}\n}\n}'
  },{
    src:'@media (max-width:599px)\n @page\n  a\n   &.b\n    w: 1\n   &.c\n    h: 2\n    &.d\n     h: 3',
    css:'@media (max-width:599px) {\n@page {\na.b {\nw: 1;\n}\na.c {\nh: 2;\n}\na.c.d {\nh: 3;\n}\n}\n}'
  }
];

test('nested', function(assert) {
  for (var i = 0; i < (0 || nested.length); i++) {
    let js = nested[i],
      ctx = powcss().run(js.src);

    assert.equal(ctx.toCSS().trimRight(), js.css, JSON.stringify(ctx.rules));
  }
  assert.end();
});
