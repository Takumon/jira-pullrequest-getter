require('dotenv').config();
const os = require('os');
const Client = require('svn-spawn');
const path = require('path');
const FileUtil = require('./file-util.js');

const username = process.env.SVN_USERNAME;
const password = process.env.SVN_PASSWORD;

const client = new Client({
  username,
  password,
  noAuthCache: true
});

/**
 * 環境変数SVN_ROPOSITORY_URLSに指定したSVNのURL配下のディレクトリとファイルのURL一覧を取得
 *
 * @return {string[]} SVNのディレクトリとファイルのURL一覧
 */
const getSvnFileNameList = async () => {
  const svnUrls = process.env.SVN_ROPOSITORY_URLS.split(',');

  const cacheFile = path.join(__dirname, '..', 'svn-file-list.txt');

  // ファイルキャッシュがある場合は
  if (FileUtil.isExist(cacheFile)) {
    // ファイルから読み込み
    return (await FileUtil.read(cacheFile)).split(os.EOL);
  }

  // ファイルキャッシュがない場合はSVNコマンドにてファイル一覧を作成
  const svnAllFiles = await findAllFiles(svnUrls);
  await FileUtil.write(cacheFile, svnAllFiles.join(os.EOL));
  return svnAllFiles;
};

/**
 * 指定したSVNのURLリスト配下のディレクトリとファイルのURL一覧を取得する
 *
 * @param {string[]} svnUrls SVNのURLリスト
 * @return {string[]} 指定したSVNのURLリスト配下のディレクトリとファイルのURL一覧
 */
const findAllFiles = async svnUrls => {
  const result = await Promise.all(svnUrls.map(async url => await findFiles(url)));
  return Array.prototype.concat.apply([], result);
};

/**
 * 指定したSVNのURL配下のディレクトリとファイルのURL一覧を取得する
 *
 * @param {string} svnUrl SVNのURL
 * @return {string[]} 指定したSVNのURL配下のディレクトリとファイルのURL一覧
 */
const findFiles = async svnUrl => {
  const result = await new Promise((resolve, reject) => {
    client.cmd(['list', '--recursive', svnUrl], (err, data) => {
      if (err) {
        reject(err);
      } else {
        const files = data
          .replace(/ /g, '')
          .split(os.EOL)
          .map(file => svnUrl + file);
        resolve(files);
      }
    });
  });

  return result;
};

module.exports = {
  getSvnFileNameList,
  findAllFiles,
  findFiles
};
