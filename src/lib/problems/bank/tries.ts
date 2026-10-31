import type { Problem } from "../types";

// Deterministic lowercase words over a small alphabet, so many share prefixes.
// A small linear congruential generator seeded by i picks each letter.
function wordAt(i: number, len: number, letters = "abcde"): string {
  let seed = (Math.imul(i + 1, 2654435761) + 12345) >>> 0;
  let w = "";
  for (let j = 0; j < len; j++) {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    w += letters[(seed >>> 16) % letters.length];
  }
  return w;
}

function bruteCommonPrefix(strs: string[]): string {
  let p = strs[0];
  for (const s of strs) while (!s.startsWith(p)) p = p.slice(0, -1);
  return p;
}

function bruteBuildableWord(words: string[]): string {
  const set = new Set(words);
  let best = "";
  for (const w of words) {
    let ok = true;
    for (let k = 1; k < w.length && ok; k++) if (!set.has(w.slice(0, k))) ok = false;
    if (ok && (w.length > best.length || (w.length === best.length && w < best))) best = w;
  }
  return best;
}

function bruteReplaceWords(dictionary: string[], sentence: string): string {
  return sentence
    .split(" ")
    .map((w) => {
      let best = w;
      for (const r of dictionary) if (w.startsWith(r) && r.length < best.length) best = r;
      return best;
    })
    .join(" ");
}

function bruteSuggestions(products: string[], searchWord: string): string[][] {
  const sorted = [...products].sort();
  return Array.from({ length: searchWord.length }, (_, i) =>
    sorted.filter((p) => p.startsWith(searchWord.slice(0, i + 1))).slice(0, 3),
  );
}

function bruteMaxXor(nums: number[]): number {
  let best = 0;
  for (let i = 0; i < nums.length; i++) for (let j = i; j < nums.length; j++) best = Math.max(best, (nums[i] ^ nums[j]) >>> 0);
  return best;
}

const sharedStem = Array.from({ length: 300 }, (_, i) => "interstellar" + wordAt(i, 1 + (i % 6)));
// Every prefix chain "a", "ab", ... is present only for some words, so the answer is not trivial.
const ladderWords = (() => {
  const out = new Set<string>();
  for (let i = 0; i < 400; i++) {
    const w = wordAt(i, 1 + (i % 9), "abc");
    out.add(w);
    if (i % 3 !== 0) for (let k = 1; k < w.length; k++) out.add(w.slice(0, k));
  }
  return [...out];
})();
const rootList = Array.from({ length: 120 }, (_, i) => wordAt(i * 3 + 1, 2 + (i % 4) + (i % 4 === 0 ? 1 : 0)));
const longSentence = Array.from({ length: 1500 }, (_, i) => wordAt(i, 3 + (i % 7))).join(" ");
const catalog = [...new Set(Array.from({ length: 1000 }, (_, i) => wordAt(i, 3 + (i % 8), "abcdm")))];
const bigXorNums = Array.from({ length: 1500 }, (_, i) => (i * 2654435761) % 2147483647);

export const tries: Problem[] = [
  {
    slug: "build-a-prefix-tree",
    title: "Build a Prefix Tree",
    pattern: "tries",
    difficulty: "easy",
    rating: 1140,
    statement: `Design a class \`Trie\` (a prefix tree) that stores lowercase words and answers lookups quickly.

- \`Trie()\` creates an empty tree.
- \`insert(word)\` stores \`word\`. Inserting the same word again has no extra effect.
- \`search(word)\` returns \`true\` if \`word\` was inserted earlier, and \`false\` otherwise. A word that is only the beginning of a stored word does not count.
- \`startsWith(prefix)\` returns \`true\` if some stored word begins with \`prefix\` (a stored word counts as a prefix of itself).`,
    constraints: [
      "1 <= word.length, prefix.length <= 2000",
      "word and prefix contain only lowercase English letters",
      "At most 3 * 10^4 calls in total",
    ],
    hints: [
      "Words that share a beginning can share the nodes for that beginning.",
      "Each node maps a letter to a child node and has a flag marking whether a word ends there. insert walks and creates nodes; search and startsWith walk and differ only in whether the end flag must be set.",
      "def insert(w):\n    node = root\n    for ch in w: node = node.children.setdefault(ch, Node())\n    node.end = True\ndef walk(s): follow children, return node or None\nsearch = walk(w) and walk(w).end; startsWith = walk(p) is not None",
    ],
    complexity: { time: "O(L)", space: "O(total letters)" },
    signature: {
      kind: "design",
      className: "Trie",
      constructorParams: [],
      methods: [
        { name: "insert", params: [{ name: "word", type: "string" }], returns: "void" },
        { name: "search", params: [{ name: "word", type: "string" }], returns: "bool" },
        { name: "startsWith", params: [{ name: "prefix", type: "string" }], returns: "bool" },
      ],
    },
    tests: [
      {
        input: [
          ["Trie", "insert", "search", "search", "startsWith", "insert", "search"],
          [[], ["apple"], ["apple"], ["app"], ["app"], ["app"], ["app"]],
        ],
        expected: [null, null, true, false, true, null, true],
        sample: true,
      },
      {
        input: [
          ["Trie", "insert", "insert", "startsWith", "startsWith", "search"],
          [[], ["car"], ["cat"], ["ca"], ["co"], ["ca"]],
        ],
        expected: [null, null, null, true, false, false],
        sample: true,
      },
      {
        input: [["Trie", "search", "startsWith"], [[], ["a"], ["a"]]],
        expected: [null, false, false],
        label: "empty trie",
      },
      {
        input: [
          ["Trie", "insert", "search", "startsWith", "search"],
          [[], ["a"], ["a"], ["a"], ["ab"]],
        ],
        expected: [null, null, true, true, false],
        label: "single letter",
      },
      {
        input: [
          ["Trie", "insert", "insert", "search", "startsWith"],
          [[], ["dog"], ["dog"], ["dog"], ["dogs"]],
        ],
        expected: [null, null, null, true, false],
        label: "duplicate insert",
      },
      {
        input: [
          ["Trie", "insert", "search", "startsWith", "startsWith"],
          [[], ["banana"], ["bananas"], ["banana"], ["bananaa"]],
        ],
        expected: [null, null, false, true, false],
        label: "query longer than word",
      },
      {
        input: [
          ["Trie", "insert", "insert", "insert", "search", "search", "search", "startsWith"],
          [[], ["in"], ["inn"], ["int"], ["i"], ["inn"], ["int"], ["inx"]],
        ],
        expected: [null, null, null, null, false, true, true, false],
        label: "branching words",
      },
    ],
    companies: ["Google", "Amazon", "Microsoft", "Meta", "Uber"],
    source: {
      name: "LeetCode 208. Implement Trie (Prefix Tree)",
      url: "https://leetcode.com/problems/implement-trie-prefix-tree/",
    },
    reference: `class Trie {
  constructor() { this.root = { kids: new Map(), end: false }; }
  insert(word) {
    let node = this.root;
    for (const ch of word) {
      if (!node.kids.has(ch)) node.kids.set(ch, { kids: new Map(), end: false });
      node = node.kids.get(ch);
    }
    node.end = true;
  }
  walk(s) {
    let node = this.root;
    for (const ch of s) {
      node = node.kids.get(ch);
      if (!node) return null;
    }
    return node;
  }
  search(word) {
    const node = this.walk(word);
    return !!node && node.end;
  }
  startsWith(prefix) {
    return this.walk(prefix) !== null;
  }
}`,
  },
  {
    slug: "wildcard-word-store",
    title: "Wildcard Word Store",
    pattern: "tries",
    difficulty: "medium",
    rating: 1420,
    statement: `Design a class \`WordDictionary\` that stores lowercase words and supports searching with a wildcard.

- \`WordDictionary()\` creates an empty store.
- \`addWord(word)\` stores \`word\`.
- \`search(pattern)\` returns \`true\` if some stored word matches \`pattern\`. The pattern consists of lowercase letters and \`'.'\`, where each \`'.'\` matches exactly one letter of any kind. A match must have the same length as the pattern.`,
    constraints: [
      "1 <= word.length, pattern.length <= 25",
      "word has only lowercase letters; pattern has lowercase letters and '.'",
      "A pattern contains at most 2 dots",
      "At most 10^4 calls in total",
    ],
    hints: [
      "Without the dot this is a plain trie lookup. What does a dot mean at a single trie node?",
      "Store words in a trie. Search recursively with (node, index): a letter follows that one child; a dot tries every child. Succeed at the end of the pattern only if the node marks a word end.",
      "def dfs(node, i):\n    if i == len(p): return node.end\n    if p[i] == '.':\n        return any(dfs(child, i + 1) for child in node.children.values())\n    child = node.children.get(p[i])\n    return child is not None and dfs(child, i + 1)",
    ],
    complexity: { time: "O(L) add, O(26^d * L) search", space: "O(total letters)" },
    signature: {
      kind: "design",
      className: "WordDictionary",
      constructorParams: [],
      methods: [
        { name: "addWord", params: [{ name: "word", type: "string" }], returns: "void" },
        { name: "search", params: [{ name: "pattern", type: "string" }], returns: "bool" },
      ],
    },
    tests: [
      {
        input: [
          ["WordDictionary", "addWord", "addWord", "addWord", "search", "search", "search", "search"],
          [[], ["bad"], ["dad"], ["mad"], ["pad"], ["bad"], [".ad"], ["b.."]],
        ],
        expected: [null, null, null, null, false, true, true, true],
        sample: true,
      },
      {
        input: [
          ["WordDictionary", "addWord", "search", "search", "search"],
          [[], ["tree"], ["tre"], ["tr.e"], ["tree."]],
        ],
        expected: [null, null, false, true, false],
        sample: true,
      },
      {
        input: [["WordDictionary", "search", "search"], [[], ["a"], ["."]]],
        expected: [null, false, false],
        label: "empty store",
      },
      {
        input: [
          ["WordDictionary", "addWord", "search", "search", "search"],
          [[], ["x"], ["."], [".."], ["x"]],
        ],
        expected: [null, null, true, false, true],
        label: "single letter",
      },
      {
        input: [
          ["WordDictionary", "addWord", "addWord", "search", "search"],
          [[], ["ab"], ["abc"], ["ab."], ["a.c"]],
        ],
        expected: [null, null, null, true, true],
        label: "prefix words",
      },
      {
        input: [
          ["WordDictionary", "addWord", "addWord", "search", "search", "search"],
          [[], ["cat"], ["cut"], ["c.t"], [".a."], ["..x"]],
        ],
        expected: [null, null, null, true, true, false],
        label: "dot must backtrack",
      },
      {
        input: [
          ["WordDictionary", "addWord", "addWord", "search", "search"],
          [[], ["abcd"], ["abce"], ["ab.f"], ["..ce"]],
        ],
        expected: [null, null, null, false, true],
        label: "two dots",
      },
    ],
    companies: ["Meta", "Amazon", "Google", "Apple"],
    source: {
      name: "LeetCode 211. Design Add and Search Words Data Structure",
      url: "https://leetcode.com/problems/design-add-and-search-words-data-structure/",
    },
    reference: `class WordDictionary {
  constructor() { this.root = { kids: new Map(), end: false }; }
  addWord(word) {
    let node = this.root;
    for (const ch of word) {
      if (!node.kids.has(ch)) node.kids.set(ch, { kids: new Map(), end: false });
      node = node.kids.get(ch);
    }
    node.end = true;
  }
  search(pattern) {
    const dfs = (node, i) => {
      if (i === pattern.length) return node.end;
      const ch = pattern[i];
      if (ch === ".") {
        for (const child of node.kids.values()) if (dfs(child, i + 1)) return true;
        return false;
      }
      const child = node.kids.get(ch);
      return !!child && dfs(child, i + 1);
    };
    return dfs(this.root, 0);
  }
}`,
  },
  {
    slug: "letter-grid-word-hunt",
    title: "Letter Grid Word Hunt",
    pattern: "tries",
    difficulty: "hard",
    rating: 1790,
    statement: `You are given a grid \`board\` of lowercase letters (each cell is a one-letter string) and a list of distinct words \`words\`.

A word is *found* if you can spell it by starting at some cell and repeatedly stepping to a horizontally or vertically adjacent cell, never using the same cell twice within that word.

Return every word from \`words\` that can be found in the grid, in any order.`,
    constraints: [
      "1 <= rows, cols <= 12",
      "1 <= words.length <= 3 * 10^4",
      "1 <= words[i].length <= 10",
      "board and words contain only lowercase English letters; words are distinct",
    ],
    hints: [
      "Searching for each word separately repeats the same grid walks for words with a shared beginning.",
      "Put all words in a trie. DFS from every cell while walking down the trie in step; stop as soon as the current path is not a trie prefix. When you reach a node that ends a word, record it and clear the mark so it is reported once.",
      "def dfs(r, c, node):\n    ch = board[r][c]\n    if ch not in node.kids: return\n    node = node.kids[ch]\n    if node.word: found.append(node.word); node.word = None\n    board[r][c] = '#'\n    for nr, nc in neighbors(r, c): dfs(nr, nc, node)\n    board[r][c] = ch",
    ],
    complexity: { time: "O(m * n * 3^L)", space: "O(total letters)" },
    signature: {
      kind: "function",
      name: "findWords",
      params: [
        { name: "board", type: "string[][]" },
        { name: "words", type: "string[]" },
      ],
      returns: "string[]",
      compare: "unordered",
    },
    tests: [
      {
        input: [
          [
            ["o", "a", "a", "n"],
            ["e", "t", "a", "e"],
            ["i", "h", "k", "r"],
            ["i", "f", "l", "v"],
          ],
          ["oath", "pea", "eat", "rain"],
        ],
        expected: ["eat", "oath"],
        sample: true,
      },
      {
        input: [
          [
            ["a", "b"],
            ["c", "d"],
          ],
          ["abcb"],
        ],
        expected: [],
        sample: true,
      },
      { input: [[["a"]], ["a", "b"]], expected: ["a"], label: "single cell" },
      { input: [[["a", "a"]], ["aaa"]], expected: [], label: "no cell reuse" },
      { input: [[["a", "a"]], ["aa", "a"]], expected: ["aa", "a"], label: "word found many ways" },
      {
        input: [
          [
            ["a", "b"],
            ["c", "d"],
          ],
          ["ab", "abd", "acd", "abdc", "ad", "bdca"],
        ],
        expected: ["ab", "abd", "acd", "abdc", "bdca"],
        label: "shared prefixes, no diagonals",
      },
      {
        input: [
          [
            ["o", "a", "b", "n"],
            ["o", "t", "a", "e"],
            ["a", "h", "k", "r"],
            ["a", "f", "l", "v"],
          ],
          ["oa", "oaa"],
        ],
        expected: ["oa", "oaa"],
        label: "word is prefix of another",
      },
      {
        input: [
          [
            ["x", "y"],
            ["z", "w"],
          ],
          ["cat", "dog"],
        ],
        expected: [],
        label: "no matches",
      },
    ],
    companies: ["Amazon", "Microsoft", "Uber", "Airbnb", "Google"],
    source: { name: "LeetCode 212. Word Search II", url: "https://leetcode.com/problems/word-search-ii/" },
    reference: `function findWords(board, words) {
  const root = { kids: new Map(), word: null };
  for (const w of words) {
    let node = root;
    for (const ch of w) {
      if (!node.kids.has(ch)) node.kids.set(ch, { kids: new Map(), word: null });
      node = node.kids.get(ch);
    }
    node.word = w;
  }
  const rows = board.length, cols = board[0].length, found = [];
  function dfs(r, c, parent) {
    const ch = board[r][c];
    const node = parent.kids.get(ch);
    if (!node) return;
    if (node.word !== null) { found.push(node.word); node.word = null; }
    board[r][c] = "#";
    if (r > 0) dfs(r - 1, c, node);
    if (r + 1 < rows) dfs(r + 1, c, node);
    if (c > 0) dfs(r, c - 1, node);
    if (c + 1 < cols) dfs(r, c + 1, node);
    board[r][c] = ch;
    if (node.kids.size === 0 && node.word === null) parent.kids.delete(ch);
  }
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) dfs(r, c, root);
  return found;
}`,
  },
  {
    slug: "shared-opening-letters",
    title: "Shared Opening Letters",
    pattern: "tries",
    difficulty: "easy",
    rating: 950,
    statement: `Given an array of strings \`strs\`, return the longest string that is a prefix of every one of them. If they share no common prefix, return the empty string \`""\`.`,
    constraints: ["1 <= strs.length <= 200 (more in the big test)", "0 <= strs[i].length <= 200", "strs[i] consists of lowercase English letters."],
    hints: [
      "The answer can never be longer than the shortest string.",
      "Compare column by column: take each character of the first string and check that every other string has the same character at that position; stop at the first mismatch. (Inserting all words into a trie and walking down while a node has a single child also works.)",
      "for i, c in enumerate(strs[0]):\n    for s in strs[1:]:\n        if i == len(s) or s[i] != c:\n            return strs[0][:i]\nreturn strs[0]",
    ],
    complexity: { time: "O(n·m)", space: "O(1)" },
    signature: {
      kind: "function",
      name: "longestCommonPrefix",
      params: [{ name: "strs", type: "string[]" }],
      returns: "string",
    },
    tests: [
      { input: [["flower", "flow", "flight"]], expected: "fl", sample: true },
      { input: [["dog", "racecar", "car"]], expected: "", sample: true },
      { input: [["alone"]], expected: "alone", label: "single string" },
      { input: [["", "abc"]], expected: "", label: "empty string" },
      { input: [["same", "same", "same"]], expected: "same", label: "identical strings" },
      { input: [["ab", "a"]], expected: "a", label: "one string is the prefix" },
      { input: [["abc", "abd", "ab"]], expected: "ab", label: "shortest string limits" },
      { input: [["cir", "car"]], expected: "c", label: "single shared letter" },
      { input: [sharedStem], expected: bruteCommonPrefix(sharedStem), label: "large input" },
    ],
    companies: ["Amazon", "Google", "Apple", "Microsoft", "Meta"],
    source: { name: "LeetCode 14. Longest Common Prefix", url: "https://leetcode.com/problems/longest-common-prefix/" },
    reference: `function longestCommonPrefix(strs) {
  const first = strs[0];
  for (let i = 0; i < first.length; i++) {
    for (let k = 1; k < strs.length; k++) {
      if (i === strs[k].length || strs[k][i] !== first[i]) return first.slice(0, i);
    }
  }
  return first;
}`,
  },
  {
    slug: "letter-by-letter-ladder",
    title: "Letter-by-Letter Ladder",
    pattern: "tries",
    difficulty: "medium",
    rating: 1250,
    statement: `You are given a list of lowercase \`words\`. A word can be *built* if it can be formed one letter at a time, adding letters at the end, where every intermediate prefix is also in the list. For example, \`"word"\` can be built if \`"w"\`, \`"wo"\` and \`"wor"\` are all in the list.

Return the longest word that can be built. If several have the same length, return the alphabetically smallest. If none can be built, return \`""\`.`,
    constraints: ["1 <= words.length <= 1000 (more in the big test)", "1 <= words[i].length <= 30", "words[i] consists of lowercase English letters."],
    hints: [
      "A word is buildable exactly when its prefix one letter shorter is buildable and it is in the list itself.",
      "Insert every word into a trie and mark word ends. Then DFS from the root, only stepping into children that end a word. The deepest node reached is the answer; visit children in alphabetical order so ties go to the smallest word.",
      "build trie with end markers\nbest = ''\ndef dfs(node, path):\n    global best\n    if len(path) > len(best): best = path\n    for c in sorted(node.children):\n        child = node.children[c]\n        if child.end: dfs(child, path + c)\ndfs(root, '')\nreturn best",
    ],
    complexity: { time: "O(n·m)", space: "O(n·m)" },
    signature: {
      kind: "function",
      name: "longestWord",
      params: [{ name: "words", type: "string[]" }],
      returns: "string",
    },
    tests: [
      { input: [["w", "wo", "wor", "worl", "world"]], expected: "world", sample: true },
      { input: [["a", "banana", "app", "appl", "ap", "apply", "apple"]], expected: "apple", sample: true },
      { input: [["abc", "bc"]], expected: "", label: "nothing buildable" },
      { input: [["z"]], expected: "z", label: "single letter" },
      { input: [["b", "a"]], expected: "a", label: "tie goes to the smaller word" },
      { input: [["a", "ab", "abc", "abd", "abde"]], expected: "abde", label: "branching" },
      { input: [["m", "mo", "moc", "moch", "mocha", "l", "la", "lat", "latt", "latte", "c", "ca", "cat"]], expected: "latte", label: "several chains" },
      { input: [["ab", "abc", "abcd"]], expected: "", label: "missing first letter" },
      { input: [ladderWords], expected: bruteBuildableWord(ladderWords), label: "large input" },
    ],
    companies: ["Google", "Amazon", "Uber"],
    source: { name: "LeetCode 720. Longest Word in Dictionary", url: "https://leetcode.com/problems/longest-word-in-dictionary/" },
    reference: `function longestWord(words) {
  const root = { kids: {}, end: false };
  for (const w of words) {
    let node = root;
    for (const c of w) node = node.kids[c] || (node.kids[c] = { kids: {}, end: false });
    node.end = true;
  }
  let best = "";
  const dfs = (node, path) => {
    if (path.length > best.length) best = path;
    for (const c of Object.keys(node.kids).sort()) {
      if (node.kids[c].end) dfs(node.kids[c], path + c);
    }
  };
  dfs(root, "");
  return best;
}`,
  },
  {
    slug: "shorten-to-roots",
    title: "Shorten to Roots",
    pattern: "tries",
    difficulty: "medium",
    rating: 1300,
    statement: `You are given a \`dictionary\` of word roots and a \`sentence\` of lowercase words separated by single spaces. Replace every word in the sentence that starts with some root by that root. If several roots fit, use the **shortest** one. Words with no matching root stay as they are.

Return the resulting sentence.`,
    constraints: [
      "1 <= dictionary.length <= 1000",
      "1 <= dictionary[i].length <= 100",
      "1 <= sentence.length <= 10^6",
      "Only lowercase letters and single spaces; no leading or trailing spaces.",
    ],
    hints: [
      "For each word you want the shortest root that is a prefix of it. Checking every root against every word is slow.",
      "Insert the roots into a trie. For each word, walk the trie letter by letter and stop at the first node that ends a root; if you fall off the trie first, keep the word.",
      "for each root: insert into trie, mark end\ndef shorten(w):\n    node = root\n    for i, c in enumerate(w):\n        if c not in node.children: return w\n        node = node.children[c]\n        if node.end: return w[:i + 1]\n    return w\nreturn ' '.join(shorten(w) for w in sentence.split())",
    ],
    complexity: { time: "O(n)", space: "O(n)" },
    signature: {
      kind: "function",
      name: "replaceWords",
      params: [
        { name: "dictionary", type: "string[]" },
        { name: "sentence", type: "string" },
      ],
      returns: "string",
    },
    tests: [
      { input: [["cat", "bat", "rat"], "the cattle was rattled by the battery"], expected: "the cat was rat by the bat", sample: true },
      { input: [["a", "b", "c"], "aadsfasf absbs bbab cadsfafs"], expected: "a a b c", sample: true },
      { input: [["xyz"], "hello world"], expected: "hello world", label: "no roots match" },
      { input: [["a", "aa", "aaa"], "aaaa aa a"], expected: "a a a", label: "shortest root wins" },
      { input: [["catt", "cat"], "cattle"], expected: "cat", label: "shorter root listed later" },
      { input: [["word"], "word"], expected: "word", label: "word equals root" },
      { input: [["longer"], "long"], expected: "long", label: "root longer than word" },
      { input: [["re", "un"], "redo undo do"], expected: "re un do", label: "mixed" },
      { input: [rootList, longSentence], expected: bruteReplaceWords(rootList, longSentence), label: "large input" },
    ],
    companies: ["Uber", "Amazon", "Google"],
    source: { name: "LeetCode 648. Replace Words", url: "https://leetcode.com/problems/replace-words/" },
    reference: `function replaceWords(dictionary, sentence) {
  const root = { kids: {}, end: false };
  for (const w of dictionary) {
    let node = root;
    for (const c of w) node = node.kids[c] || (node.kids[c] = { kids: {}, end: false });
    node.end = true;
  }
  const shorten = (w) => {
    let node = root;
    for (let i = 0; i < w.length; i++) {
      node = node.kids[w[i]];
      if (!node) return w;
      if (node.end) return w.slice(0, i + 1);
    }
    return w;
  };
  return sentence.split(" ").map(shorten).join(" ");
}`,
  },
  {
    slug: "type-ahead-suggestions",
    title: "Type-Ahead Suggestions",
    pattern: "tries",
    difficulty: "medium",
    rating: 1400,
    statement: `A shop's search box suggests product names as you type. You are given the list of \`products\` and the \`searchWord\` the user types one letter at a time.

After each letter, suggest up to three products that start with the letters typed so far. If more than three match, pick the three that come first alphabetically. Return a list with one list of suggestions per typed letter (possibly empty).`,
    constraints: [
      "1 <= products.length <= 1000",
      "1 <= products[i].length <= 3000",
      "All products are distinct lowercase strings.",
      "1 <= searchWord.length <= 1000",
    ],
    hints: [
      "Alphabetical order and prefix matching go well together: in a sorted list, all products with a given prefix sit next to each other.",
      "Either build a trie where every node stores the (up to three) smallest words passing through it, inserting products in sorted order; or sort the products and binary search the first position not smaller than the current prefix, then check the next three.",
      "products.sort(); res = []; prefix = ''\nfor c in searchWord:\n    prefix += c\n    i = bisect_left(products, prefix)\n    res.append([p for p in products[i:i + 3] if p.startswith(prefix)])\nreturn res",
    ],
    complexity: { time: "O(n log n)", space: "O(n)" },
    signature: {
      kind: "function",
      name: "suggestedProducts",
      params: [
        { name: "products", type: "string[]" },
        { name: "searchWord", type: "string" },
      ],
      returns: "string[][]",
    },
    tests: [
      {
        input: [["mobile", "mouse", "moneypot", "monitor", "mousepad"], "mouse"],
        expected: [
          ["mobile", "moneypot", "monitor"],
          ["mobile", "moneypot", "monitor"],
          ["mouse", "mousepad"],
          ["mouse", "mousepad"],
          ["mouse", "mousepad"],
        ],
        sample: true,
      },
      { input: [["havana"], "tatiana"], expected: [[], [], [], [], [], [], []], sample: true },
      { input: [["havana"], "havana"], expected: [["havana"], ["havana"], ["havana"], ["havana"], ["havana"], ["havana"]], label: "single product" },
      { input: [["a", "b", "c"], "a"], expected: [["a"]], label: "single letter" },
      {
        input: [["bags", "baggage", "banner", "box", "cloths"], "bags"],
        expected: [["baggage", "bags", "banner"], ["baggage", "bags", "banner"], ["baggage", "bags"], ["bags"]],
        label: "narrowing down",
      },
      { input: [["abc", "abd"], "abx"], expected: [["abc", "abd"], ["abc", "abd"], []], label: "matches run out" },
      { input: [["dd", "dc", "db", "da"], "d"], expected: [["da", "db", "dc"]], label: "more than three match" },
      { input: [["code", "codes", "coder"], "codex"], expected: [["code", "coder", "codes"], ["code", "coder", "codes"], ["code", "coder", "codes"], ["code", "coder", "codes"], []], label: "prefix is a product" },
      { input: [catalog, "bacdma"], expected: bruteSuggestions(catalog, "bacdma"), label: "large input" },
    ],
    companies: ["Amazon", "Google", "Microsoft"],
    source: { name: "LeetCode 1268. Search Suggestions System", url: "https://leetcode.com/problems/search-suggestions-system/" },
    reference: `function suggestedProducts(products, searchWord) {
  const sorted = [...products].sort();
  const res = [];
  let prefix = "";
  for (const c of searchWord) {
    prefix += c;
    let lo = 0, hi = sorted.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sorted[mid] < prefix) lo = mid + 1;
      else hi = mid;
    }
    res.push(sorted.slice(lo, lo + 3).filter((p) => p.startsWith(prefix)));
  }
  return res;
}`,
  },
  {
    slug: "strongest-xor-pair",
    title: "Strongest XOR Pair",
    pattern: "tries",
    difficulty: "hard",
    rating: 1600,
    statement: `Given an array of non-negative integers \`nums\`, return the largest value of \`nums[i] XOR nums[j]\` over all pairs \`0 <= i <= j < n\`.

Checking every pair is O(n^2); aim for O(n · 31).`,
    constraints: ["1 <= nums.length <= 2 * 10^5", "0 <= nums[i] <= 2^31 - 1"],
    hints: [
      "XOR is largest when the highest bits differ. Can you greedily decide the answer bit by bit, from the top?",
      "Insert every number into a binary trie keyed by its 31 bits, highest first. For each number, walk the trie preferring the child with the opposite bit at each level; the path gives the best partner for that number.",
      "for x in nums: insert bits 30..0 of x into the trie\nbest = 0\nfor x in nums:\n    node, cur = root, 0\n    for b in range(30, -1, -1):\n        bit = (x >> b) & 1\n        if node.child[1 - bit]:\n            cur |= 1 << b; node = node.child[1 - bit]\n        else: node = node.child[bit]\n    best = max(best, cur)\nreturn best",
    ],
    complexity: { time: "O(n)", space: "O(n)" },
    signature: {
      kind: "function",
      name: "findMaximumXOR",
      params: [{ name: "nums", type: "int[]" }],
      returns: "int",
    },
    tests: [
      { input: [[3, 10, 5, 25, 2, 8]], expected: 28, sample: true },
      { input: [[14, 70, 53, 83, 49, 91, 36, 80, 92, 51, 66, 70]], expected: 127, sample: true },
      { input: [[0]], expected: 0, label: "single zero" },
      { input: [[7]], expected: 0, label: "single number pairs with itself" },
      { input: [[5, 5, 5]], expected: 0, label: "all same" },
      { input: [[1, 2]], expected: 3, label: "two numbers" },
      { input: [[0, 2147483647]], expected: 2147483647, label: "extreme values" },
      { input: [[8, 10, 2]], expected: 10, label: "small values" },
      { input: [[1073741824, 1, 1073741825]], expected: 1073741825, label: "high bit decides" },
      { input: [bigXorNums], expected: bruteMaxXor(bigXorNums), label: "large input" },
    ],
    companies: ["Google", "Amazon", "Microsoft"],
    source: {
      name: "LeetCode 421. Maximum XOR of Two Numbers in an Array",
      url: "https://leetcode.com/problems/maximum-xor-of-two-numbers-in-an-array/",
    },
    reference: `function findMaximumXOR(nums) {
  const root = [null, null];
  for (const x of nums) {
    let node = root;
    for (let b = 30; b >= 0; b--) {
      const bit = (x >> b) & 1;
      if (!node[bit]) node[bit] = [null, null];
      node = node[bit];
    }
  }
  let best = 0;
  for (const x of nums) {
    let node = root, cur = 0;
    for (let b = 30; b >= 0; b--) {
      const bit = (x >> b) & 1;
      if (node[1 - bit]) {
        cur |= 1 << b;
        node = node[1 - bit];
      } else node = node[bit];
    }
    best = Math.max(best, cur);
  }
  return best;
}`,
  },
];
