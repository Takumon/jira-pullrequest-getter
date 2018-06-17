const axios = require('axios');

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

module.exports = {
  auth,
  getIssue,
  getPullRequestsOf
};
