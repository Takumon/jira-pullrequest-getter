require('dotenv').config();
const os = require('os');
const path = require('path');
const Handlebars = require('Handlebars');
const JIRA = require('./jira.js');
const GITHUB = require('./github.js');
const SVN = require('./svn.js');
const FileUtil = require('./file-util.js');

const SERCH_STATUS = {
  NOT_FOUND: '候補なし',
  NARROW_DOWN: '候補確定',
  NOT_NARROW_DOWN: '候補複数'
};

/**
 * 指定したファイルパスから単純ファイル名を取得する
 *
 * @param {string} filePath ファイルパス
 * @return {string} 単純ファイル名
 */
const getSimpleName = filePath => filePath.substring(filePath.lastIndexOf('/') + 1);

/**
 * 指定したGitHubのファイルパスに該当するSVNのファイルURLを検索する
 * 検索結果は配列で返す(不確定な検索なので複数件返ってくることもある)
 *
 * @param {string} masterFileUrl GitHubのファイルパス
 * @param {string} svnAllFiles SVNのファイルパス一覧
 * @return {object} 検索結果（ステータス、ファイルパスの配列）
 */
const findSvnInfo = (masterFileUrl, svnAllFiles) => {
  const simpleNameOfGitHubFile = getSimpleName(masterFileUrl);
  const files = svnAllFiles.filter(svnFile => getSimpleName(svnFile) == simpleNameOfGitHubFile);
  const status =
    files.length === 0
      ? SERCH_STATUS.NOT_FOUND
      : files.length === 1
        ? SERCH_STATUS.NARROW_DOWN
        : SERCH_STATUS.NOT_NARROW_DOWN;

  return {
    status,
    files
  };
};

async function main() {
  const jireBaseUrl = process.env.JIRA_BASE_URL;
  const jiraUserName = process.env.JIRA_USERNAME;
  const jiraPassowrd = process.env.JIRA_PASSWORD;
  const jiraProject = process.env.JIRA_PROJECT;
  const jiraIssues = process.env.JIRA_ISSUES.split(',');
  const githubToken = process.env.GITHUB_TOKEN;

  const svnAllFiles = await SVN.getSvnFileNameList();

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

      // プルリクに紐づくGitHubファイル情報を取得
      const _githubFiles = await Promise.all(
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
      const githubFiles = Array.prototype.concat.apply([], _githubFiles);

      // GitHubファイル情報にプロパティとしてSVNファイル情報を追加
      githubFiles.forEach(f => {
        f.svnInfo = findSvnInfo(f.masterFileUrl, svnAllFiles);
        return f;
      });

      return {
        issueKey,
        issueUrl,
        description,
        pullRequests,
        modules,
        githubFiles
      };
    })
  );

  const markdownTempateSrc = [
    '{{#issues}}',

    '## {{issueKey}}',
    '{{ issue.url }}',

    '### 概要',
    '{{ issue.description }}',

    '### プルリクエスト',
    '{{#pullRequests}}',
    '* [{{name}}]({{url}})',
    '{{/pullRequests}}',

    '### モジュール',
    '{{#modules}}',
    '* [{{repository}}](http://github.com/{{owner}}/{{repository}})',
    '{{/modules}}',

    '### 修正ファイル',
    '{{#githubFiles}}',
    '* ({{status}}){{masterFileUrl}} !{{svnInfo.status}}!',
    // '  * {{svnInfo.files}}',
    '{{#if svnInfo.files}}',
    '{{#each svnInfo.files}}',
    '  * {{this}}',
    '{{#each}}',
    '{{/if}}',
    '{{/githubFiles}}',

    '{{/issues}}'
  ].join(os.EOL);

  const markdownTempate = Handlebars.compile(markdownTempateSrc);
  const context = markdownTempate({ issues });
  const distPath = path.join(__dirname, '..', 'result.md');
  await FileUtil.write(distPath, context);
}

main();
