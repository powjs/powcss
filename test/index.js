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

test('tokenizes', function(assert) {
  for (var i = 0; i < (0 || lines.length); i++) {
    let t = lines[i],
      tokens = powcss([]).tokenizes(t.src),
      j = 0;

    assert.equal(tokens.length, t.out.length, `broken: ${j}/${i}`);

    while (j<t.out.length) {
      let tok = tokens[j];

      if (!tok||!tok.source) {
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
    css: `:0 rule div`
  },{
    src: 'div\n color: red',
    css: `:0 rule div:0 decl color: red`
  },{
    src: 'div{\n color: red\n}',
    css: `:0 rule div:0 decl color: red`
  }
];

test('root', function(assert) {
  for (var i = 0; i < (0 || roots.length); i++) {
    let css = roots[i],
      actual = '',
      pow = powcss([]),
      toks = pow.tokenizes(css.src),
      root = pow.root(toks),
      v = JSON.stringify(root.nodes);
    // 瘦身
    pow.walk(root.nodes, null,
      function(n, c, i) { // jshint ignore:line
        actual += `:${i} ${n.type} ${n.source}` +
          (n.value ? `: ${n.value}` : '');
        return true;
      });
    if (actual === css.css) {
      assert.ok(true, `root: ${i}`);
    }else {
      assert.equal(actual, css.css, `root: ${i}:${v}`);
    }
  }
  assert.end();
});
