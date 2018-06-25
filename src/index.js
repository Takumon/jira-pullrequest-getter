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
  try {
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
        const issue = await JIRA.getIssue(jireBaseUrl, jiraProject, session, issueKey).catch(
          error => console.log(error)
        );

        const issueId = issue.id;

        // プルリクエスト情報取得
        const _pullRequests = await JIRA.getPullRequestsOf(jireBaseUrl, session, issueId);

        // モジュール群取得
        const modules = [];
        _pullRequests.forEach(pullRequest => {
          if (modules.find(f => f.repository === pullRequest.repository)) {
            const module = modules.find(f => f.repository === pullRequest.repository);
            module.pullRequests.push(pullRequest);
          } else {
            modules.push({
              repository: pullRequest.repository,
              owner: pullRequest.owner,
              pullRequests: [pullRequest]
            });
          }
        });

        // プリリクエストに紐づくGitHubファイル情報を追加したプリクリエスト情報を取得
        // SVN情報も合わせて取得
        const pullRequestDetails = await Promise.all(
          _pullRequests.map(
            async pull =>
              await GITHUB.getPullRequestFiles(
                githubToken,
                pull.owner,
                pull.repository,
                pull.pullRequestNumber
              )
          )
        );

        // モジュールごとにファイルを整理
        const githubFiles = [];
        pullRequestDetails.forEach(detail => {
          if (githubFiles.find(f => f.repository === detail.repository)) {
            const repositoryInfo = githubFiles.find(f => f.repository === detail.repository);

            repositoryInfo.files = repositoryInfo.files.concat(
              detail.files.map(f => {
                f.pullRequestNumber = detail.number;
                return f;
              })
            );
          } else {
            const repositoryInfo = {
              owner: detail.owner,
              repository: detail.repository,
              files: detail.files.map(f => {
                f.pullRequestNumber = detail.number;
                return f;
              })
            };

            githubFiles.push(repositoryInfo);
          }
        });

        return {
          key: issueKey,
          url: issue.url,
          description: issue.fields.description,
          summary: issue.fields.summary,
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
  } catch (e) {
    console.log(e);
  }
}

main();
