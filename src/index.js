require('dotenv').config();
const axios = require('axios');
const JIRA = require('./jira.js');
const GITHUB = require('./github.js');

/**
 * 今回対象のIssueのキー名のリストを取得する
 */
function issues() {
  // TODO 実装
  return ['NAB-192', 'NAB-193'];
}

async function main() {
  const jireBaseUrl = process.env.JIRA_BASE_URL;
  const jiraUserName = process.env.JIRA_USERNAME;
  const jiraPassowrd = process.env.JIRA_PASSWORD;

  const session = await JIRA.auth(jireBaseUrl, jiraUserName, jiraPassowrd).catch(error =>
    console.log(error)
  );

  issues().forEach(async issueKey => {
    const issue = await JIRA.getIssue(jireBaseUrl, session, issueKey).catch(error =>
      console.log(error)
    );

    const issueId = issue.id;
    const description = issue.fields.description;

    const pullRequests = await JIRA.getPullRequestsOf(jireBaseUrl, session, issueId);

    pullRequests.forEach(async pull => {
      const files = await GITHUB.getPullRequestFiles(
        pull.owner,
        pull.repository,
        pull.pullRequestNumber
      );

      files.forEach(info => {
        console.log('ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ');
        console.log(issueKey);
        console.log(description);
        console.log(info.filename);
        console.log(info.status);
        // console.log(info.patch);
      });
    });
  });
}

main();
