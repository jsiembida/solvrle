

class Counter extends Map {
  set() {
    throw 'Counter does not support set method.';
  }

  get(k) {
    const v = super.get(k);
    return (v == null) ? 0 : v;
  }

  add(k) {
    const v = super.get(k);
    if (v == null) {
      super.set(k, 1);
    } else {
      super.set(k, v + 1);
    }
  }

  delete(k) {
    const v = super.get(k);
    if (v != null) {
      if (v > 1) {
        super.set(k, v - 1);
      } else {
        super.delete(k);
      }
    }
  }
}


class Wordle {
  constructor(language, wordList) {
    this.initWords(language, wordList);
    this.initState();
  }

  randomElem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  initWords(language, wordList) {
    if (!wordList || !wordList.length) {
      throw 'No words found';
    }
    let wordLength;
    const wordChars = new Map();
    const wordCounters = new Map();
    const columnChars = [];
    const charFreqs = new Counter();
    wordList.forEach(word => {
      if (!word.length) {
        throw 'Empty words are not valid';
      }
      if (wordLength == null) {
        wordLength = word.length;
        for (let i = 0; i < wordLength; i++) {
          columnChars.push(new Set());
        }
      }
      if (word.length !== wordLength) {
        throw 'Inconsistent word length';
      }
      word = word.toLowerCase();
      if (wordChars.has(word)) {
        console.log(`${word} is duplicated, skipping`);
        return;
      }
      const chars = new Array(wordLength);
      const counter = new Counter();
      // Ror RTL languages the code points are in "reverse" order.
      for (let i = 0; i < wordLength; i++) {
        const char = chars[i] = word.codePointAt(i);
        counter.add(char);
        charFreqs.add(char);
        columnChars[i].add(char);
      }
      wordChars.set(word, chars);
      wordCounters.set(word, counter);
    });
    this.language = language;
    const textInfo = new Intl.Locale(language).textInfo;
    if (textInfo == null) {
      // Firefox doesn't support textInfo, so a clunky workaround instead;
      this.direction = ['ar', 'he', 'yi', 'ur', 'fa'].some(i => i === language) ? 'rtl' : 'ltr';
    } else {
      this.direction = textInfo.direction;
    }
    this.wordLength = wordLength;
    this.wordChars = wordChars;
    this.wordCounters = wordCounters;
    this.columnChars = columnChars;
    this.charFreqs = charFreqs;
    console.log(`Loaded wordle, language = ${language}, direction = ${this.direction}, word size = ${wordLength}, dictionary size = ${wordChars.size}, alphabet size = ${charFreqs.size}`);
  }

  initState() {
    this.possibleWords = Array.from(this.wordChars.keys());
    this.unusedWords = [];
    for (const [k, v] of this.wordCounters.entries()) {
      if (v.size === 5) {
        this.unusedWords.push(k);
      }
    }
    this.attemptCount = 0;
    this.guessWord = undefined;
    this.guessChars = [];
    this.guessResults = [];
    this.usedWords = new Set();
    this.usedChars = new Set();
    this.possibleChars = [];
    this.minChars = new Map();
    this.maxChars = new Map();
    for (let i = 0; i < this.wordLength; i++) {
      this.guessChars.push(0);
      this.guessResults.push(0);
      this.possibleChars.push(new Set(this.columnChars[i]));
    }
  }

  makeGuess() {
    const {
      guessChars,
      possibleWords,
      unusedWords,
      usedChars,
      usedWords,
      wordChars,
    } = this;
    this.attemptCount += 1;
    const interestingWords = (possibleWords.length > wordChars.size / 100 && this.attemptCount <= 3 && unusedWords.length)
      ? this.rankUnusedWords(0.99)
      : this.rankPossibleWords(0.99);
    if (interestingWords.length) {
      this.guessWord = this.randomElem(interestingWords);
      [...this.guessWord].forEach((c, i) => {
        const char = c.codePointAt(0);
        guessChars[i] = char;
        usedChars.add(char);
      });
      usedWords.add(this.guessWord);
      return this.guessWord;
    } else {
      this.guessWord = undefined;
      this.guessChars = [];
    }
  }

  compareGuess(word) {
    const {
      guessChars,
      wordChars,
      wordLength,
    } = this;
    const chars = wordChars.get(word);
    const matches = [];
    const unmatched = new Counter();
    for (let i = 0; i < wordLength; i++) {
      const c = chars[i];
      if (guessChars[i] === c) {
        matches.push(1);
      } else {
        matches.push(0);
        unmatched.add(c);
      }
    }

    for (let i = 0; i < wordLength; i++) {
      if (!matches[i]) {
        if (unmatched.has(guessChars[i])) {
          matches[i] = 0;
          unmatched.delete(guessChars[i]);
        } else {
          matches[i] = -1;
        }
      }
    }

    return matches;
  }

  scoreGuess(results) {
    const {
      guessChars,
      guessResults,
      maxChars,
      minChars,
      possibleChars,
      wordLength,
    } = this;

    const matchesCounter = new Counter();
    for (let i = 0; i < wordLength; i++) {
      const char = guessChars[i];
      const result = guessResults[i] = results[i];
      if (result > 0) {
        // Green
        possibleChars[i].clear();
        possibleChars[i].add(char);
        matchesCounter.add(char);
      } else if (result === 0) {
        // Yellow
        possibleChars[i].delete(char);
        matchesCounter.add(char);
      }
    }

    for (const [k, v] of matchesCounter.entries()) {
      minChars.set(k, Math.max(minChars.get(k) || v, v));
    }

    for (let i = 0; i < wordLength; i++) {
      const char = guessChars[i];
      const result = results[i];
      if (result < 0) {
        // Gray
        const v = matchesCounter.get(char);
        if (v === 0) {
          possibleChars.forEach(i => i.delete(char));
          minChars.set(char, 0);
          maxChars.set(char, 0);
        } else {
          maxChars.set(char, Math.min(maxChars.get(char) || v, v));
        }
      }
    }
  }

  findBestWords(rankedWords, cutoffPoint) {
    rankedWords.sort((a, b) => b[0] - a[0]);
    const bestRank = rankedWords[0][0];
    const bestWords = [];
    for (let i = 0, length = rankedWords.length; i < length; i++) {
      const [rank, word] = rankedWords[i];
      if (rank / bestRank < cutoffPoint) {
        break;
      }
      bestWords.push(word);
    }
    return bestWords;
  }

  trimPossibleWords() {
    const {
      maxChars,
      minChars,
      possibleChars,
      possibleWords,
      usedWords,
      wordChars,
      wordCounters,
      wordLength,
    } = this;

    const matchingWords = [];
    for (const word of possibleWords) {
      if (usedWords.has(word)) {
        continue;
      }
      let isMatching = true;
      const chars = wordChars.get(word);
      for (let i = 0; i < wordLength; i++) {
        const char = chars[i];
        if (!possibleChars[i].has(char)) {
          isMatching = false;
          break;
        }
      }

      if (!isMatching) {
        continue;
      }

      const counts = wordCounters.get(word);

      for (const [char, min] of minChars.entries()) {
        if (counts.get(char) < min) {
          isMatching = false;
          break;
        }
      }

      if (!isMatching) {
        continue;
      }

      for (const [char, max] of maxChars.entries()) {
        if (counts.get(char) > max) {
          isMatching = false;
          break;
        }
      }

      if (isMatching) {
        matchingWords.push(word);
      }
    }

    this.possibleWords = matchingWords;
  }

  rankPossibleWords(cutoffPoint) {
    const {
      charFreqs,
      guessResults,
      possibleWords,
      wordChars,
      wordCounters,
      wordLength,
    } = this;
    if (!possibleWords.length) {
      return [];
    }

    const rankedWords = [];
    for (const word of possibleWords) {
      const chars = wordChars.get(word);
      const charsCounter = wordCounters.get(word);
      let rank = 0;
      for (let i = 0; i < wordLength; i++) {
        if (guessResults[i] <= 0) {
          const char = chars[i];
          rank += charFreqs.get(char) / charsCounter.get(char);
        }
      }
      rankedWords.push([rank, word]);
    }
    return this.findBestWords(rankedWords, cutoffPoint);
  }

  trimUnusedWords() {
    const {
      unusedWords,
      usedChars,
      wordChars,
      wordLength,
    } = this;

    const matchingWords = [];
    for (const word of unusedWords) {
      let isMatching = true;
      const chars = wordChars.get(word);
      for (let i = 0; i < wordLength; i++) {
        const char = chars[i];
        if (usedChars.has(char)) {
          isMatching = false;
          break;
        }
      }

      if (isMatching) {
        matchingWords.push(word);
      }
    }

    this.unusedWords = matchingWords;
  }

  rankUnusedWords(cutoffPoint) {
    const {
      charFreqs,
      unusedWords,
      wordChars,
      wordLength,
    } = this;
    if (!unusedWords.length) {
      return [];
    }

    const rankedWords = [];
    for (const word of unusedWords) {
      const chars = wordChars.get(word);
      let rank = 0;
      for (let i = 0; i < wordLength; i++) {
        rank += charFreqs.get(chars[i]);
      }
      rankedWords.push([rank, word]);
    }
    return this.findBestWords(rankedWords, cutoffPoint);
  }
}


class Test {
  constructor(wordle, word) {
    if (word != null && !wordle.wordChars.has(word)) {
      throw `${word} is not in the dictionary`;
    }
    this.wordle = wordle;
    this.run(word);
  }

  run(word) {
    const { wordle } = this;
    const solutions = new Map();
    const words = word ? [word] : wordle.wordChars.keys();
    const oneWord = words.length === 1;
    for (const word of words) {
      wordle.initState();

      while (wordle.attemptCount < 100) {
        const guessWord = wordle.makeGuess();
        if (guessWord == null) {
          throw 'This should not happen';
        }

        if (oneWord) {
          console.log(`trying ${guessWord}`);
        }

        const matches = wordle.compareGuess(word);
        if (matches.every(i => i > 0)) {
          console.log(`guessed ${guessWord} at try ${wordle.attemptCount}`);
          break;
        }

        wordle.scoreGuess(matches);
        wordle.trimUnusedWords();
        wordle.trimPossibleWords();
      }

      const bucket = solutions.get(wordle.attemptCount) || [];
      bucket.push(word);
      solutions.set(wordle.attemptCount, bucket);
    }

    if (!oneWord) {
      this.logDistribution(solutions);
    }
  }

  toNumber(v) {
    if (v == null) {
      return v;
    } else if (typeof v === 'number' || isFinite(v)) {
      return v;
    } else if (v.length !== undefined) {
      return v.length;
    } else if (v.size !== undefined) {
      return v.size;
    }
  }

  logDistribution(data) {
    const keys = [];
    let total = 0;
    for (const [k, v] of data.entries()) {
      keys.push(k);
      total += this.toNumber(v);
    }
    keys.sort((a, b) => a - b);
    let current = 0;
    console.log();
    for (const k of keys) {
      const v = data.get(k);
      const n = this.toNumber(v);
      const extra = (100 * current / total >= 99) ? v : '';
      current += this.toNumber(v);
      const percentage = 100 * current / total;
      console.log(`${k}: ${n}   ${percentage.toFixed(1)}%   ${extra}`);
    }
    console.log();
  }
}


class Game {
  constructor(wordle, word) {
    if (word != null && !wordle.wordChars.has(word)) {
      throw `${word} is not in the dictionary`;
    }
    this.wordle = wordle;
    this.rows = document.querySelector('.rows');
    this.info = document.querySelector('.info');
    if (word == null) {
      this.openRow();
    } else {
      this.solveWord(word);
    }
  }

  solveWord(word) {
    const { wordle } = this;
    while (true) {
      const guessWord = wordle.makeGuess();
      const matches = wordle.compareGuess(word);
      this.rows.append(this.buildRow(wordle.guessChars, matches));
      this.updateInfo();
      if (matches.every(i => i > 0)) {
        console.log(`guessed ${guessWord} at try ${wordle.attemptCount}`);
        break;
      }
      wordle.scoreGuess(matches);
      wordle.trimUnusedWords();
      wordle.trimPossibleWords();
    }
  }

  openRow() {
    const { wordle } = this;
    const guessWord = wordle.makeGuess();
    if (guessWord != null) {
      console.log(`trying ${guessWord}`);
      this.rows.append(this.buildRow(wordle.guessChars));
    }
    this.updateInfo();
  }

  updateInfo() {
    const { wordle, info } = this;
    info.querySelector('.language').innerText = wordle.language;
    info.querySelector('.dictionary.size').innerText = '' + wordle.wordChars.size;
    info.querySelector('.solution.size').innerText = '' + wordle.possibleWords.length;
    info.classList.remove('hidden');
  }

  closeRow(matches) {
    const { wordle } = this;
    wordle.scoreGuess(matches);
    wordle.trimUnusedWords();
    wordle.trimPossibleWords();
    if (matches.every(i => i > 0)) {
      console.log(`guessed at attempt ${this.attempt}`);
    } else {
      this.openRow();
    }
  }

  cellListener = (e) => {
    const classes = e.target.classList;
    if (classes.contains('wrong')) {
      classes.remove('wrong', 'correct');
      classes.add('misplaced');
    } else if (classes.contains('misplaced')) {
      classes.remove('misplaced', 'wrong');
      classes.add('correct');
    } else if (classes.contains('correct')) {
      classes.remove('correct', 'misplaced');
      classes.add('wrong');
    }
  };

  cellValue(cell) {
    const classes = cell.classList;
    if (classes.contains('correct')) {
      return 1;
    } else if (classes.contains('misplaced')) {
      return 0;
    } else if (classes.contains('wrong')) {
      return -1;
    }
  }

  buildCell(char, match) {
    const cell = document.createElement('div');
    cell.innerText = String.fromCodePoint(char);
    if (match == null) {
      cell.classList.add('cell', 'wrong', 'active');
      cell.addEventListener('click', this.cellListener);
    } else {
      if (match > 0) {
        cell.classList.add('cell', 'correct');
      } else if (match === 0) {
        cell.classList.add('cell', 'misplaced');
      } else if (match < 0) {
        cell.classList.add('cell', 'wrong');
      }
    }
    return cell;
  }

  buttonListener = (e) => {
    const button = e.target;
    button.removeEventListener('click', this.buttonListener);
    button.classList.remove('active');
    const matches = [];
    for (const cell of this.rows.querySelectorAll('.cell.active')) {
      cell.removeEventListener('click', this.cellListener);
      cell.classList.remove('active');
      matches.push(this.cellValue(cell));
    }
    this.closeRow(matches);
  };

  buildButton(matches) {
    const button = document.createElement('div');
    button.innerText = '➤';
    button.classList.add('button');
    if (!matches) {
      button.classList.add('active');
      button.addEventListener('click', this.buttonListener);
    }
    return button;
  }

  buildCount() {
    const count = document.createElement('div');
    const word = String.fromCodePoint(...this.wordle.guessChars);
    count.innerText = this.wordle.attemptCount + '.';
    count.classList.add('count');
    count.addEventListener('click', () => navigator.clipboard.writeText(word));
    return count;
  }

  buildLetters(chars, matches) {
    const letters = document.createElement('div');
    letters.classList.add('letters');
    letters.style.direction = this.wordle.direction;
    letters.append(...chars.map((char, i) => this.buildCell(char, matches[i])));
    return letters;
  }

  buildRow(chars, matches) {
    const row = document.createElement('div');
    row.classList.add('row');
    row.append(this.buildCount(), this.buildLetters(chars, matches || []), this.buildButton(matches));
    return row;
  }
}


function loadPlaintext(language) {
  return fetch(`lang/${language}.json`)
    .then(r => r.blob());
}


function loadGzipped(language) {
  return fetch(`lang/${language}.json.gz`)
    .then(r => r.blob())
    .then(r => new Response(r.stream().pipeThrough(new DecompressionStream('gzip'))).blob())
    .catch(() => loadPlaintext(language));
}


function loadWordle() {
  const language = navigator.language.match(/^\w+/)[0];
  const testWord = new URLSearchParams(document.location.search).get('test');
  loadGzipped(language)
    .then(r => r.text())
    .then(r => {
      const wordle = new Wordle(language, JSON.parse(r));
      return (testWord != null && testWord.length === 0) ? new Test(wordle) : new Game(wordle, testWord);
    });
}


if (typeof navigator !== 'undefined') {
  document.addEventListener('DOMContentLoaded', loadWordle);
} else if (typeof process !== 'undefined') {
  if (process.argv.length !== 3 && process.argv.length !== 4) {
    throw 'Dictionary path is required';
  }
  const dictionary = process.argv[2];
  if (!dictionary.endsWith('.json') && !dictionary.endsWith('.json.gz')) {
    throw 'Dictionary must be .json or .json.gz file';
  }
  let data = require('fs').readFileSync(dictionary);
  if (dictionary.endsWith('.gz')) {
    data = require('zlib').gunzipSync(data);
  }
  const language = Intl.DateTimeFormat().resolvedOptions().locale.match(/^\w+/)[0];
  /* eslint-disable no-new */
  new Test(new Wordle(language, JSON.parse(data.toString())), process.argv[3]);
}
