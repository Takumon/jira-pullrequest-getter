const rp = require('request-promise');

/**
 * 指定したJIRAのURLでログインしセッションを取得する
 *
 * @param {String} baes_url JIRAのベースURL(末尾スラッシュなし)
 */
const auth = async (baes_url, username, password) => {
  const options = {
    uri: `${baes_url}/rest/auth/1/session`,
    headers: {
      'Content-Type': 'application/json'
    },
    body: {
      username,
      password
    },
    method: 'POST',
    json: true
  };

  const res = await rp(options);
  return res.session;
};

const getIssue = async (baseUrl, project, session, issueKey) => {
  const options = {
    uri: `${baseUrl}/rest/api/2/issue/${issueKey}`,
    headers: {
      'Content-Type': 'application/json',
      cookie: `${session.name}=${session.value}`
    },
    method: 'GET',
    json: true
  };

  const res = await rp(options);
  res.url = `${baseUrl}/projects/${project}/issues/${issueKey}`;
  return res;
};

const getPullRequestsOf = async (baseUrl, session, issueId) => {
  const options = {
    uri: `${baseUrl}/rest/dev-status/1.0/issue/detail`,
    headers: {
      'Content-Type': 'application/json',
      cookie: `${session.name}=${session.value}`
    },
    qs: {
      issueId: issueId,
      applicationType: 'github',
      dataType: 'pullrequest'
    },
    method: 'GET',
    json: true
  };

  const res = await rp(options);

  // マージされたもののみ対象とする
  return res.detail[0].pullRequests.filter(info => 'MERGED' == info.status).map(info => {
    const [temp, owner, repository, pullRequestNumber] = info.url.match(
      /https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/
    );

    info.owner = owner;
    info.repository = repository;
    info.pullRequestNumber = pullRequestNumber;
    return info;
  });
};

module.exports = {
  auth,
  getIssue,
  getPullRequestsOf
};
