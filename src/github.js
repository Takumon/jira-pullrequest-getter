const axios = require('axios');

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

module.exports = {
  getPullRequestFiles
};
