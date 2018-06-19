require('dotenv').config();
const JIRA = require('./jira.js');
const GITHUB = require('./github.js');
const SVN = require('./svn.js');

async function main() {
  const jireBaseUrl = process.env.JIRA_BASE_URL;
  const jiraUserName = process.env.JIRA_USERNAME;
  const jiraPassowrd = process.env.JIRA_PASSWORD;
  const jiraIssues = process.env.JIRA_ISSUES.split(',');
  const githubToken = process.env.GITHUB_TOKEN;
  const svnUrls = process.env.SVN_ROPOSITORY_URLS.split(',');

  const svnAllFiles = await SVN.findAllFiles(svnUrls);
  console.log(svnAllFiles);

  const session = await JIRA.auth(jireBaseUrl, jiraUserName, jiraPassowrd).catch(error =>
    console.log(error)
  );

  jiraIssues.forEach(async issueKey => {
    const issue = await JIRA.getIssue(jireBaseUrl, session, issueKey).catch(error =>
      console.log(error)
    );

    const issueId = issue.id;
    const description = issue.fields.description;

    const pullRequests = await JIRA.getPullRequestsOf(jireBaseUrl, session, issueId);

    pullRequests.forEach(async pull => {
      const files = await GITHUB.getPullRequestFiles(
        githubToken,
        pull.owner,
        pull.repository,
        pull.pullRequestNumber
      );

      files.forEach(async info => {
        console.log('ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ');
        console.log(issueKey);
        console.log(description);
        console.log(info.filename);
        console.log(info.status);
        // console.log(info.patch);

        // TODO 単純ファイル名でSVN検索
        // const simpleFileName = info.filename.substring(info.filename.lastIndexOf('/') + 1);
        // const filtered = svnAllFiles.filters(f => f.endsWith(simpleFileName));
        // console.log(filtered);
      });
    });
  });
}

main();
