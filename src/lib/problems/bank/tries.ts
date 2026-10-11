import type { Problem } from "../types";

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
];
