'use strict';

const ERROR = 2;

module.exports = {
  parserOptions: {
    ecmaVersion: 2017
  },
  rules: {
    quotes: [ERROR, 'single'],
    'max-len': [1, 100, 2]
  }
};
