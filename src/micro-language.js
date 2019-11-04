const {digits, str, choice, sequenceOf, between, betweenBrackets, lazy} = require('./index.js');

const numberParser = digits.map(x => ({type: 'number', value: Number(x)}));

const operatorParser = choice([
  str('+'),
  str('-'),
  str('*'),
  str('/')
]);

const expression = lazy(() => choice([numberParser, operationParser]));

const operationParser = betweenBrackets(sequenceOf([
  operatorParser,
  str(' '),
  expression,
  str(' '),
  expression
])).map(results => ({
  type: 'operation',
  value: {
    op: results[0],
    a: results[2],
    b: results[4]
  }
}));

const evaluate = node => {
  if (node.type === 'number'){ return node.value }
  if (node.type ==='operation'){
    if (node.value.op === '+'){return evaluate(node.value.a) + evaluate(node.value.b)}
    if (node.value.op === '-'){return evaluate(node.value.a) - evaluate(node.value.b)}
    if (node.value.op === '*'){return evaluate(node.value.a) * evaluate(node.value.b)}
    if (node.value.op === '/'){return evaluate(node.value.a) / evaluate(node.value.b)}
  }
};

const interpreter = program => {
  const parseResult = expression.run(program);
  if (parseResult.isError){throw new Error(`expression: Failed at ${parseResult.index}`)}
  return evaluate((parseResult.result))
};

const program = '(+ (* 50 5) (* (/ 50 (- 50 970)) 6))';

console.log(
  interpreter(program)
);
