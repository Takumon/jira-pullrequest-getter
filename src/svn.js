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

const SERCH_STATUS = {
  NOT_FOUND: '候補なし',
  NARROW_DOWN: '候補確定',
  NOT_NARROW_DOWN: '候補複数'
};



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

/**
 * 指定したGitHubのファイルパスに該当するSVNのファイルURLを検索する
 * 検索結果は配列で返す(不確定な検索なので複数件返ってくることもある)
 *
 * @param {string} masterFileUrl GitHubのファイルパス
 * @param {string} svnAllFiles SVNのファイルパス一覧
 * @return {object} 検索結果（ステータス、ファイルパスの配列）
 */
const findSvnInfo = async (masterFileUrl, svnAllFiles) => {
  const simpleNameOfGitHubFile = getSimpleName(masterFileUrl);
  const filePaths = svnAllFiles.filter(svnFile => getSimpleName(svnFile) == simpleNameOfGitHubFile);
  const status =
    filePaths.length === 0
      ? SERCH_STATUS.NOT_FOUND
      : filePaths.length === 1
        ? SERCH_STATUS.NARROW_DOWN
        : SERCH_STATUS.NOT_NARROW_DOWN;

  const files = await Promise.all(
    filePaths.map(async filePath => {
      const content = await getFileContent(filePath);
      return {
        url: filePath,
        content
      };
    })
  );

  return {
    status,
    files
  };
};

const getFileContent = async svnUrl => {
  const content = await new Promise((resolve, reject) => {
    client.cmd(['cat', svnUrl], (err, data) => {
      err ? reject(err) : resolve(data);
    });
  });

  return content;
};

/**
 * 指定したファイルパスから単純ファイル名を取得する
 *
 * @param {string} filePath ファイルパス
 * @return {string} 単純ファイル名
 */
const getSimpleName = filePath => filePath.substring(filePath.lastIndexOf('/') + 1);

module.exports = {
  getSvnFileNameList,
  getFileContent,
  findAllFiles,
  findFiles,
  findSvnInfo
};
