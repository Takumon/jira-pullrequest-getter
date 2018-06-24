require('dotenv').config();
const mkdirp = require('mkdirp');
const path = require('path');

const JIRA = require('./jira.js');
const GITHUB = require('./github.js');
const Report = require('./report.js');

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

  // レポート出力
  const destDirPath = path.join(__dirname, '..', 'dest');
  mkdirp.sync(destDirPath);
  await Report.createReport(destDirPath, issues);
  Report.createPullRequestDiff(destDirPath, issues);
}

main();
