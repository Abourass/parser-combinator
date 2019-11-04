const updateParserState = (state, index, result) => ({ ...state, index, result });

const updateParserResult = (state, result) => ({...state, result});

const updateParserError = (state, errorMsg) => ({ ...state, isError: true, error: errorMsg });

class Parser {
  constructor(parserStateTransformerFn){
    this.parserStateTransformerFn = parserStateTransformerFn;
  }

  run(targetString){
    const initialState = {
      targetString,
      index: 0,
      result: null,
      isError: null,
      error: null
    };
    return this.parserStateTransformerFn(initialState)
  }

  map(fn){
    return new Parser(parserState => {
      const nextState = this.parserStateTransformerFn(parserState);
      if (nextState.isError){return nextState}
      return updateParserResult(nextState, fn(nextState.result))
    })
  }

  chain(fn){
    return new Parser(parserState => {
      const nextState = this.parserStateTransformerFn(parserState);
      if (nextState.isError){return nextState}
      const nextParser = fn(nextState.result);
      return nextParser.parserStateTransformerFn(nextState)
    })
  }

  errorMap(fn){
    return new Parser(parserState => {
      const nextState = this.parserStateTransformerFn(parserState);
      if (!nextState.isError){return nextState}
      return updateParserError(nextState, fn(nextState.error, nextState.index))
    })
  }
}

const lettersRegex = /^[A-Za-z]+/, digitsRegex = /^[0-9]+/, lettersAndDigitsRegex = /^[A-Za-z0-9]+/;

const str = stringToMatch => new Parser(parserState => {
  const {targetString, index, isError} = parserState;
  if (isError){return parserState}
  const slicedTarget = targetString.slice(index);

  if (slicedTarget.length === 0){return updateParserError(parserState, `str: Tried to match ${stringToMatch} but got an unexpected end of input`)}

  if (slicedTarget.startsWith(stringToMatch)) {
    return updateParserState(parserState, index + stringToMatch.length, stringToMatch)
  }
  return updateParserError(parserState, `str: Tried to match ${stringToMatch} but got ${targetString.slice(index, index + 14)}`)
});

const letters = new Parser(parserState => {
  const {targetString, index, isError} = parserState;
  if (isError){return parserState}
  const slicedTarget = targetString.slice(index);

  if (slicedTarget.length === 0){return updateParserError(parserState, `letters: Got an unexpected end of input`)}

  const regexMatch = slicedTarget.match(lettersRegex);

  if (regexMatch) {
    return updateParserState(parserState, index + regexMatch[0].length, regexMatch[0])
  }
  return updateParserError(parserState, `letters: Couldn't match any letters at index ${index}`)
});

const digits = new Parser(parserState => {
  const {targetString, index, isError} = parserState;
  if (isError){return parserState}
  const slicedTarget = targetString.slice(index);

  if (slicedTarget.length === 0){return updateParserError(parserState, `digits: Got an unexpected end of input`)}

  const regexMatch = slicedTarget.match(digitsRegex);

  if (regexMatch) {
    return updateParserState(parserState, index + regexMatch[0].length, regexMatch[0])
  }
  return updateParserError(parserState, `digits: Couldn't match any digits at index ${index}`)
});

const lettersAndDigits = new Parser(parserState => {
  const {targetString, index, isError} = parserState;
  if (isError){return parserState}
  const slicedTarget = targetString.slice(index);

  if (slicedTarget.length === 0){return updateParserError(parserState, `lettersAndDigits: Got an unexpected end of input`)}

  const regexMatch = slicedTarget.match(lettersAndDigitsRegex);

  if (regexMatch) {
    return updateParserState(parserState, index + regexMatch[0].length, regexMatch[0])
  }
  return updateParserError(parserState, `lettersAndDigits: Couldn't match any letters or digits at index ${index}`)
});

const sequenceOf = parsers  => new Parser(parserState => {
  if (parserState.isError){return parserState}
  const results = [];
  let nextState = parserState;

  for (let parser of parsers){
    nextState = parser.parserStateTransformerFn(nextState);
    results.push(nextState.result)
  }

  return updateParserResult(nextState, results);
});

const choice = parsers  => new Parser(parserState => {
  if (parserState.isError){return parserState}

  for (let parser of parsers){
    const nextState = parser.parserStateTransformerFn(parserState);
    if (!nextState.isError){return nextState}
  }

  return updateParserError(parserState, `choice: Unable to match with any parser at ${parserState.index}`);
});

const many = parser  => new Parser(parserState => {
  if (parserState.isError){return parserState}

  let nextState = parserState, done = false;
  const results = [];

  while (!done){
    let testState = parser.parserStateTransformerFn(nextState);
    if (!testState.isError){
      results.push(testState.result);
      nextState = testState;
    } else { done = true; }
  }
  return updateParserResult(nextState, results);
});

const manyOrOne = parser  => new Parser(parserState => {
  if (parserState.isError){return parserState}

  let nextState = parserState;
  const results = [];
  let done = false;

  while (!done){
    nextState = parser.parserStateTransformerFn(nextState);
    if (!nextState.isError){
      results.push(nextState.result)
    } else {
      done = true;
    }
  }

  if (results.length === 0){return updateParserError(parserState, `manyOrOne: No parsers returned a match at index: ${parserState.index}`)}

  return updateParserResult(nextState, results);
});

const between = (leftParser, rightParser) => contentParser => sequenceOf([leftParser, contentParser, rightParser]).map(results => results[1]);

const separatedBy = separatorParser =>  valueParser => new Parser(parserState => {
  const results = [];
  let nextState = parserState;

  while (true){
    const thingWeWantState = valueParser.parserStateTransformerFn(nextState);
    if (thingWeWantState.isError){break}
    results.push(thingWeWantState.result);
    nextState = thingWeWantState;

    const separatorState = separatorParser.parserStateTransformerFn(nextState);
    if (separatorState.isError){break}
    nextState = separatorState;
  }

  return updateParserResult(nextState, results)
});

const separatedByOne = separatorParser =>  valueParser => new Parser(parserState => {
  const results = [];
  let nextState = parserState;

  while (true){
    const thingWeWantState = valueParser.parserStateTransformerFn(nextState);
    if (thingWeWantState.isError){break}
    results.push(thingWeWantState.result);
    nextState = thingWeWantState;

    const separatorState = separatorParser.parserStateTransformerFn(nextState);
    if (separatorState.isError){break}
    nextState = separatorState;
  }

  if (results.length === 0){return updateParserError(parserState, `separatedByOne: Unable to capture any results at index: ${parserState.index}`)}
  return updateParserResult(nextState, results)
});

const lazy = parserThunk => new Parser(parserState => {
  const parser = parserThunk();
  return parser.parserStateTransformerFn(parserState);
});

const betweenBrackets = between(str('('), str(')'));
const betweenSquareBrackets = between(str('['), str(']'));
const commaSeparated = separatedBy(str(','));

const value = lazy(() => choice([digits, arrayParser]));

const arrayParser = betweenSquareBrackets(commaSeparated(value));

const stringParser = letters.map(result => ({type: 'string', value: result}));
const numberParser = digits.map(result => ({type: 'number', value: Number(result)}));
const diceRollParser = sequenceOf([digits, str('d'), digits]).map(([numberOfDice, _, sides]) => ({type: 'diceRoll', value: [Number(numberOfDice), Number(sides)]}));

module.exports = {
  str,
  letters,
  digits,
  betweenBrackets,
  betweenSquareBrackets,
  sequenceOf,
  choice,
  many,
  manyOrOne,
  separatedBy,
  separatedByOne,
  between,
  lazy
}

