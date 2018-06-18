const rp = require('request-promise');

const getPullRequestFiles = (owner, repository, pullRequestNumber) => {
  const uri = `https://api.github.com/repos/${owner}/${repository}/pulls/${pullRequestNumber}/files`;
  const options = {
    uri,
    method: 'GET',
    json: true,
    headers: {
      'User-Agent': 'request'
    }
  };

  return rp(options).then(response => {
    return response.map(info => {
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
};

module.exports = {
  getPullRequestFiles
};
