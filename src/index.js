require('dotenv').config();
const os = require('os');
const mkdirp = require('mkdirp');
const path = require('path');
const fs = require('fs');
const Handlebars = require('Handlebars');
const JIRA = require('./jira.js');
const GITHUB = require('./github.js');
const SVN = require('./svn.js');
const FileUtil = require('./file-util.js');

const getDirName = path.dirname;

const createDirAndWrite = (path, contents) => {
  mkdirp.sync(getDirName(path));
  fs.writeFileSync(path, contents);
};

/**
 * 調査結果を出力する
 *
 * @param {string} distDirPath 出力先ディレクトリのファイルパス
 * @param {string} issues JIRAのイシューごとに情報をまとめたもの
 */
const createReport = async (distDirPath, issues) => {
  const markdownTempateSrc = await FileUtil.read(
    path.join(__dirname, 'markdown-result-template.handlebars')
  );
  const markdownTempate = Handlebars.compile(markdownTempateSrc);
  const context = markdownTempate({ issues });
  const distPath = path.join(distDirPath, 'result.md');
  await FileUtil.write(distPath, context);
};

// TODO SVNの情報も加える
// TODO GitHubのPatchは改行コードを無視したい
/**
 * プルリクエスト前後のソースコードとパッチファイルを出力する
 * フォルダ構成は JIRAのイシュー名/モジュール名　でその配下に実際のリポジトリと同様のフォルダを作成
 * ファイル名はステータス(追加、変更、削除、名前変更)によって異なる
 *  変更後ファイル： 「単純ファイル名.プルリクエスト番号.ステータス.after」　※削除の時は存在しない
 *  変更前ファイル： 「単純ファイル名.プルリクエスト番号.ステータス.before」 ※追加の時は存在しない　名前変更の時は変更後の名前も情報として追加する
 *  変更差分：      「単純ファイル名.プルリクエスト番号.ステータス.patch」
 *  SVNファイル：   「単純ファイル名.プルリクエスト番号.ステータス.svn」　※複数候補がある場合は、「svn_1」のように候補番号をつける
 *
 * @param {string} distDirPath 出力先ディレクトリのファイルパス
 * @param {string} issues JIRAのイシューごとに情報をまとめたもの
 */
const createPullRequestDiff = (distDirPath, issues) => {
  issues.forEach(issue => {
    const issueDirPath = path.join(distDirPath, issue.issueKey);
    mkdirp.sync(issueDirPath);

    issue.pullRequestDetails.forEach(pullRequestDetail => {
      const pullRequestDirPath = path.join(issueDirPath, pullRequestDetail.repository);
      mkdirp.sync(pullRequestDirPath);

      pullRequestDetail.files.forEach(file => {
        const paths = file.filename.split('/');
        const simpleName = paths.pop(); // pathsから単純ファイル名を削除
        const createPath = suffix => {
          // pushは破壊的なのでconcatを使う
          const pathArray = [pullRequestDirPath]
            .concat(paths)
            .concat([`${simpleName}.${pullRequestDetail.number}.${file.status}.${suffix}`]);
          return path.join.apply(null, pathArray);
        };

        if (file.status === 'modified') {
          createDirAndWrite(createPath('after'), file.content_after);
          createDirAndWrite(createPath('before'), file.content_before);
          createDirAndWrite(createPath('patch'), file.patch);
        } else if (file.status === 'added') {
          createDirAndWrite(createPath('after'), file.content_after);
          createDirAndWrite(createPath('patch'), file.patch);
        } else if (file.status === 'deleted') {
          createDirAndWrite(createPath('before'), file.content_before);
          createDirAndWrite(createPath('patch'), file.patch);
        } else if (file.status === 'renamed') {
          createDirAndWrite(createPath('after'), file.content_after);
          // リネームの場合は修正前の単純ファイル名をファイル名に反映する
          const previousSimpleFileName = file.previous_filename.split('/').pop();
          createDirAndWrite(createPath(`${previousSimpleFileName}.before`), file.content_before);
          createDirAndWrite(createPath('patch'), file.patch);
        }

        // SVNのバージョンごとに処理したい
        const svnFiles = file.svnInfo.files;
        if (svnFiles.length === 0) {
          createDirAndWrite(createPath('svn.not_found'), 'not_found');
        } else if (svnFiles.length === 1) {
          createDirAndWrite(createPath('svn'), svnFiles[0].content);
        } else {
          // 二つ以上検索結果がある時
          // TODO 数値で区別した時に、どれがどれかわかるようにしたい（レポートに記載？）
          svnFiles.forEach((svnFile, index) => {
            createDirAndWrite(createPath(`svn_${index}`), svnFile.content);
          });
        }

      });
    });
  });
};

/**
 * 実処理
 */
async function main() {
  const jireBaseUrl = process.env.JIRA_BASE_URL;
  const jiraUserName = process.env.JIRA_USERNAME;
  const jiraPassowrd = process.env.JIRA_PASSWORD;
  const jiraProject = process.env.JIRA_PROJECT;
  const jiraIssues = process.env.JIRA_ISSUES.split(',');
  const githubToken = process.env.GITHUB_TOKEN;


  const session = await JIRA.auth(jireBaseUrl, jiraUserName, jiraPassowrd).catch(error =>
    console.log(error)
  );

  const issues = await Promise.all(
    jiraIssues.map(async issueKey => {
      const issue = await JIRA.getIssue(jireBaseUrl, jiraProject, session, issueKey).catch(error =>
        console.log(error)
      );

      const issueId = issue.id;
      const issueUrl = issue.url;
      const description = issue.fields.description;

      // プルリクエスト情報取得
      const pullRequests = await JIRA.getPullRequestsOf(jireBaseUrl, session, issueId);

      // モジュール群取得
      const modules = pullRequests.filter(
        (self, index, array) =>
          index === array.findIndex(other => self.repository === other.repository)
      );

      // プリリクエストに紐づくGitHubファイル情報を追加したプリクリエスト情報を取得
      // SVN情報も合わせて取得
      const pullRequestDetails = await Promise.all(
        pullRequests.map(
          async pull =>
            await GITHUB.getPullRequestFiles(
              githubToken,
              pull.owner,
              pull.repository,
              pull.pullRequestNumber
            )
        )
      );

      // プリリクエスト詳細情報からファイル情報だけ抽出
      const githubFiles = Array.prototype.concat.apply(
        [],
        pullRequestDetails.map(detail => detail.files)
      );


      // TODO 項目ごとの必要可否検討
      return {
        issueKey,
        issueUrl,
        description,
        pullRequests,
        pullRequestDetails,
        modules,
        githubFiles
      };
    })
  );

  const distDirPath = path.join(__dirname, '..', 'dist');
  mkdirp.sync(distDirPath);

  await createReport(distDirPath, issues);
  createPullRequestDiff(distDirPath, issues);
}

main();
