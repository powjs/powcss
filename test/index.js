let test = require('tape'),
  lineify = require('../src/lineify'),
  powcss = require('../src/powcss'),
  prettier = require('prettier');

function format(code, ret) {
  if (typeof code != 'string')
   code = '!' + JSON.stringify(code);
  code = prettier.format(code, {semi: true});
  if (ret) return code;
  console.log(code);
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
        actual += `:${i} ${n.type} ${n.key || n.source}` +
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
    js: ':0 s  let s=1;'
  },{
    src: 'let [a,b]=[1,2];\n ${s}\n  color: red',
    js: ':0 a,b  let [a,b]=[1,2];'
  },{
    src: 'if (a)\n  color: red',
    js: ':0   if (a)this.render(ctx,....);else return;'
  },{
    src: 'if(a)\n  color: red',
    js: ':0   if(a)this.render(ctx,....);else return;'
  },{
    src: 'if(a) this.render(ctx)\n  color: red',
    js: ':0   if(a) this.render(ctx);else return;'
  },{
    src: 'ctx.each(expr,(v,k))\n color: red',
    js: ':0 v,k  ctx.each(expr,(v,k)=>{this.render(ctx,v,k,....)})'
  },{
    src: 'ctx.each(expr,(v,k)=>{})\n color: red',
    js: ':0 v,k  ctx.each(expr,(v,k)=>{this.render(ctx,v,k,....)})'
  },{
    src: 'ctx.each(expr,(v,k)=>{x+1})\n color: red',
    js: ':0 v,k  ctx.each(expr,(v,k)=>{x+1;this.render(ctx,v,k,....)})'
  }
];

test('compile', function(assert) {
  for (var i = 0; i < (0 || scripts.length); i++) {
    let js = scripts[i],
      actual = '',
      pow = powcss([]),
      ns = pow.process(js.src, {}).result.nodes;

    pow.walk(ns, null,
      function(n, c, i) { // jshint ignore:line
        n = n.scripts;
        if (n)
          actual += `:${i} ${n.args} ${n.param} ${n.body}`;
        return true;
      });

    assert.equal(actual, js.js);
  }
  assert.end();
});
