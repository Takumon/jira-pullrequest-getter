require('dotenv').config();
const axios = require('axios');

/**
 * 今回対象のIssueのキー名のリストを取得する
 */
function getIssues() {
  // TODO 実装
  return ['NAB-192', 'NAB-193'];
}

/**
 * 指定したJIRAのURLでログインしセッションを取得する
 *
 * @param {String} baes_url JIRAのベースURL(末尾スラッシュなし)
 */
function auth(baes_url, username, password) {
  const options = {
    url: `${baes_url}/rest/auth/1/session`,
    headers: {
      'Content-Type': 'application/json'
    },
    data: {
      username,
      password
    },
    method: 'POST',
    responseType: 'json'
  };

  return axios(options).then(response => {
    return response.data.session;
  });
}

function getIssue(baseUrl, session, issueKey) {
  const options = {
    url: `${baseUrl}/rest/api/2/issue/${issueKey}`,
    headers: {
      'Content-Type': 'application/json',
      cookie: `${session.name}=${session.value}`
    },
    method: 'GET',
    responseType: 'json'
  };

  return axios(options).then(response => {
    return response.data;
  });
}

function getPullRequestsOf(baseUrl, session, issueId) {
  const options = {
    url: `${baseUrl}/rest/dev-status/1.0/issue/detail`,
    headers: {
      'Content-Type': 'application/json',
      cookie: `${session.name}=${session.value}`
    },
    params: {
      issueId: issueId,
      applicationType: 'github',
      dataType: 'pullrequest'
    },
    method: 'GET',
    responseType: 'json'
  };

  return axios(options).then(response => {
    return response.data.detail[0].pullRequests.map(info => {
      const [temp, owner, repository, pullRequestNumber] = info.url.match(
        /https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/
      );

      info.owner = owner;
      info.repository = repository;
      info.pullRequestNumber = pullRequestNumber;
      return info;
    });
  });
}

function getPullRequestFiles(owner, repository, pullRequestNumber) {
  const url = `https://api.github.com/repos/${owner}/${repository}/pulls/${pullRequestNumber}/files`;
  const options = {
    url,
    method: 'GET',
    responseType: 'json'
  };

  return axios(options).then(response => {
    return response.data.map(info => {
      return {
        filename: info.filename,
        status: info.status,
        additions: info.additions,
        deletions: info.deletions,
        changes: info.changes,
        patch: info.patch
      };
    });
  });
}

async function main() {
  const jireBaseUrl = process.env.JIRA_BASE_URL;
  const jiraUserName = process.env.JIRA_USERNAME;
  const jiraPassowrd = process.env.JIRA_PASSWORD;

  const session = await auth(jireBaseUrl, jiraUserName, jiraPassowrd).catch(error =>
    console.log(error)
  );

  getIssues().forEach(async issueKey => {
    const issue = await getIssue(jireBaseUrl, session, issueKey).catch(error => console.log(error));

    const issueId = issue.id;
    const description = issue.fields.description;

    const pullRequests = await getPullRequestsOf(jireBaseUrl, session, issueId);

    pullRequests.forEach(async pull => {
      const files = await getPullRequestFiles(pull.owner, pull.repository, pull.pullRequestNumber);

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
