//ファイル操作モジュールの追加
const fs = require('fs');
const mkdirp = require('mkdirp');
const path = require('path');
const getDirName = path.dirname;

const read = path => {
  return new Promise((resolve, reject) => {
    fs.readFile(path, 'utf8', (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
};

const write = (path, content) => {
  return new Promise((resolve, reject) => {
    fs.writeFile(path, content, err => {
      if (err) {
        reject(err);
      } else {
        resolve(true);
      }
    });
  });
};

const createDirAndWrite = (path, contents) => {
  mkdirp.sync(getDirName(path));
  fs.writeFileSync(path, contents);
};

const isExist = path => fs.existsSync(path);

module.exports = {
  isExist,
  read,
  write,
  createDirAndWrite
};
