/*
  Turn code-ish narration into something a voice can say.

  Text-to-speech reads "==" as "equals equals" and "!=" as "exclamation
  equals". Narration and questions often quote code, so every spoken string
  goes through this first. Longer operators are replaced before shorter ones.
*/

/* words text-to-speech mispronounces */
const WORDS: Array<[RegExp, string]> = [
  [/\bdeques\b/gi, "decks"],
  [/\bdeque\b/gi, "deck"],
  [/\bheapq\b/gi, "heap Q"],
  [/\bappendleft\b/gi, "append left"],
  [/\bpopleft\b/gi, "pop left"],
  [/\bpush_back\b/gi, "push back"],
  [/\bpush_front\b/gi, "push front"],
  [/\bpop_back\b/gi, "pop back"],
  [/\bpop_front\b/gi, "pop front"],
  [/\bLIFO\b/g, "last in, first out"],
  [/\bFIFO\b/g, "first in, first out"],
];

/*
  Equality / assignment family. Spoken by CONTEXT so that
  assignment and comparison never sound the same:
    x = 0        → "x is set to 0"         (assignment)
    a == b       → "a is equal to b"       (comparison)
    "use == not =" → "use double equals not single equals"
  An operator counts as part of an expression only when it
  sits between two operands (not English words, not quotes
  or parentheses around the bare symbol).
*/
const EQUALITY_OPERATORS = /(===|!==|==|!=|<=|>=|\+=|-=|\*=|\/=|=)/g;

const ENGLISH_WORDS = new Set([
  "use", "uses", "using", "used", "instead", "of", "the", "a", "an", "with", "to", "from",
  "not", "vs", "versus", "and", "or", "replace", "replaced", "change", "changed", "swap",
  "should", "be", "is", "are", "was", "means", "mean", "like", "than", "operator", "sign",
  "symbol", "between", "here", "this", "that", "it", "in", "on", "for", "by", "write", "wrote",
  "typed", "type", "missing", "extra", "single", "double", "but", "then", "so", "because",
]);

const SPOKEN: Record<string, { expression: string; bare: string }> = {
  "===": { expression: "is strictly equal to", bare: "triple equals" },
  "!==": { expression: "is not strictly equal to", bare: "not double equals" },
  "==": { expression: "is equal to", bare: "double equals" },
  "!=": { expression: "is not equal to", bare: "not equals" },
  "<=": { expression: "is less than or equal to", bare: "less than or equal" },
  ">=": { expression: "is greater than or equal to", bare: "greater than or equal" },
  "+=": { expression: "plus equals", bare: "plus equals" },
  "-=": { expression: "minus equals", bare: "minus equals" },
  "*=": { expression: "times equals", bare: "times equals" },
  "/=": { expression: "divide equals", bare: "divide equals" },
  "=": { expression: "is set to", bare: "single equals" },
};

function isOperand(token: string | undefined) {
  if (!token) return false;
  /* code in backticks/quotes is still code: strip the wrapping characters */
  const clean = token.replace(/^[([{`'"]+|[)\]},.;:!?`'"]+$/g, "");
  if (!clean) return false;
  if (ENGLISH_WORDS.has(clean.toLowerCase())) return false;
  return /[\w\])]/.test(clean);
}

function speakEqualityOperators(text: string) {
  return text.replace(EQUALITY_OPERATORS, (operator, _match, offset: number, whole: string) => {
    const before = whole.slice(0, offset).trimEnd().split(/\s+/).pop();
    const after = whole.slice(offset + operator.length).trimStart().split(/\s+/)[0];
    const words = SPOKEN[operator];

    /* "single =" / "double ==" already name the operator */
    if (before && /^(single|double|triple)$/i.test(before)) {
      return " equals ";
    }

    const expression = isOperand(before) && isOperand(after);
    return ` ${expression ? words.expression : words.bare} `;
  });
}

const OPERATORS: Array<[RegExp, string]> = [
  [/\s*(?:->|=>|→)\s*/g, " to "],
  [/\s*&&\s*/g, " and "],
  [/\s*\|\|\s*/g, " or "],
  [/\s*\/\/\s*(?=\d|\w)/g, " floor divided by "],
  [/(\w)\+\+/g, "$1 plus plus"],
  [/(\w)--/g, "$1 minus minus"],
  [/\s<\s/g, " is less than "],
  [/\s>\s/g, " is greater than "],
  [/\bO\(\s*1\s*\)/g, "O of one"],
  [/\bO\(\s*n\s*\)/g, "O of n"],
  [/\bO\(\s*log\s*n\s*\)/g, "O of log n"],
  [/\bO\(\s*n\s*log\s*n\s*\)/g, "O of n log n"],
  [/\bO\(\s*n\s*(?:\^\s*2|²)\s*\)/g, "O of n squared"],
  [/\bO\(\s*([^)]+)\)/g, "O of $1"],
];

export function toSpeakable(text: string) {
  /* arrows first so "=>" / "->" aren't read as assignment */
  let spoken = text.replace(/\s*(?:->|=>|→)\s*/g, " to ");

  for (const [pattern, replacement] of WORDS) {
    spoken = spoken.replace(pattern, replacement);
  }

  spoken = speakEqualityOperators(spoken)
    /* drop quotes/parens left around a bare spoken operator: "(single equals)" */
    .replace(/[`'"(]\s*((?:single|double|triple|not) equals|not double equals)\s*[`'")]/g, "$1");

  for (const [pattern, replacement] of OPERATORS) {
    spoken = spoken.replace(pattern, replacement);
  }

  return spoken.replace(/\s{2,}/g, " ").trim();
}
