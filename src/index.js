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

  const svnAllFiles = await SVN.getSvnFileNameList();

  const session = await JIRA.auth(jireBaseUrl, jiraUserName, jiraPassowrd).catch(error =>
    console.log(error)
  );

  jiraIssues.forEach(async issueKey => {
    const issue = await JIRA.getIssue(jireBaseUrl, session, issueKey).catch(error =>
      console.log(error)
    );

    const issueId = issue.id;
    const description = issue.fields.description;

    console.log('ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ');
    console.log('## ' + issueKey);
    console.log(description);

    const pullRequests = await JIRA.getPullRequestsOf(jireBaseUrl, session, issueId);

    const modules = pullRequests
      .map(p => p.repository)
      .filter((element, index, array) => array.indexOf(element) === index);
    console.log('### Modules');
    modules.forEach(m => {
      console.log('* ' + m);
    });

    pullRequests.forEach(async pull => {
      const files = await GITHUB.getPullRequestFiles(
        githubToken,
        pull.owner,
        pull.repository,
        pull.pullRequestNumber
      );

      files.forEach(async info => {
        console.log(info.filename);
        console.log(info.status);
        // console.log(info.patch);

        const simpleFileName = info.filename.substring(info.filename.lastIndexOf('/') + 1);
        const filtered = svnAllFiles.filter(f => f.endsWith(simpleFileName));
        console.log(filtered);
        return filtered;
      });
    });
  });
}

main();
