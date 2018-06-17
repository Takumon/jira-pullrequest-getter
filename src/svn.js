require('dotenv').config();

const userName = process.env.SVN_USERNAME;
const passowrd = process.env.SVN_PASSWORD;

const Client = require('svn-spawn');
const client = new Client({
  username,
  password,
  noAuthCache: true
});

function findFilePath(svnUrl, simpleFileName, filter = filename => true) {
  return new Promise((resolve, reject) => {
    client.cmd(['list', '--recursive', svnUrl], (err, data) => {
      if (err) {
        reject(err);
      } else {
        // TODO 指定したフィルタリング関数を使う
        // TODO ファイル名でフィルタリング
        resolve(data);
      }
    });
  });
}

module.exports = {
  findFilePath
};
