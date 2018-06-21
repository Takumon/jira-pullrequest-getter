require('dotenv').config();
const os = require('os');
const path = require('path');
const JIRA = require('./jira.js');
const GITHUB = require('./github.js');
const SVN = require('./svn.js');
const FileUtil = require('./file-util.js');

const getSimpleNameOf = filePath => filePath.substring(filePath.lastIndexOf('/'));

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

  const outputs = await Promise.all(
    jiraIssues.map(async issueKey => {
      const issue = await JIRA.getIssue(jireBaseUrl, jiraProject, session, issueKey).catch(error =>
        console.log(error)
      );

      const issueId = issue.id;
      const description = issue.fields.description;

      const output = [];
      output.push('## ' + issueKey);
      output.push(issue.url);
      output.push('### 概要');
      output.push(description);

      const pullRequests = await JIRA.getPullRequestsOf(jireBaseUrl, session, issueId);

      output.push('### プルリクエスト');
      const pullRequestUrls = pullRequests
        .map(p => p.url)
        .filter((element, index, array) => array.indexOf(element) === index);

      pullRequestUrls.forEach(url => {
        output.push('* ' + url);
      });

      output.push('### モジュール');
      const modules = pullRequests
        .map(p => `[${p.repository}](${p.url})`)
        .filter((element, index, array) => array.indexOf(element) === index);

      modules.forEach(m => {
        output.push('* ' + m);
      });

      output.push('### 修正ファイル');
      await Promise.all(
        pullRequests.map(async pull => {
          const files = await GITHUB.getPullRequestFiles(
            githubToken,
            pull.owner,
            pull.repository,
            pull.pullRequestNumber
          );

          await Promise.all(
            files.map(async info => {
              const simpleFileName = getSimpleNameOf(info.filename);
              const filtered = svnAllFiles.filter(f => getSimpleNameOf(f) == simpleFileName);
              if (filtered.length === 0) {
                output.push(`* (${info.status})${info.filename} ！候補なし！`);
                // console.log(info.patch);
              } else if (filtered.length === 1) {
                output.push(`* (${info.status})${info.filename}`);
                // console.log(info.patch);

                output.push(`  * ${filtered[0]}`);
              } else {
                output.push(`* (${info.status})${info.filename} ！候補複数あり！`);
                // console.log(info.patch);

                filtered.forEach(f => {
                  output.push(`  * ${f}`);
                });
              }
              return true;
            })
          );
        })
      );
      return output;
    })
  );

  const cacheFile = path.join(__dirname, '..', 'result.md');
  await FileUtil.write(cacheFile, Array.prototype.concat.apply([], outputs).join(os.EOL));
}

main();
