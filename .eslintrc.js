'use strict';

const ERROR = 2;

module.exports = {
  parserOptions: {
    ecmaVersion: 2017
  },
  rules: {
    "semi": ["error", "always"],
    "semi-spacing": ["error", { "after": true, "before": false }],
    "semi-style": ["error", "last"],
    "no-extra-semi": "error",
    "no-unexpected-multiline": "error",
    "no-unreachable": "error",
    "quotes": [ERROR, 'single'],
    'max-len': [1, 100, 2]
  }
};
