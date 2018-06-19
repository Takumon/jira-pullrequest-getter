require('dotenv').config();

const username = process.env.SVN_USERNAME;
const password = process.env.SVN_PASSWORD;

const Client = require('svn-spawn');
const client = new Client({
  username,
  password,
  noAuthCache: true
});

let result;

const findAllFiles = async svnUrls => {
  const result = await Promise.all(
    svnUrls.map(async svnUrl => {
      const files = await findFiles(svnUrl);
      return files;
    })
  );
  return Array.prototype.concat.apply([], result);
};

const findFiles = async svnUrl => {
  const result = await new Promise((resolve, reject) => {
    client.cmd(['list', '--recursive', svnUrl], (err, data) => {
      if (err) {
        reject(err);
      } else {
        const files = data
          .replace(/ /g, '')
          .split('\r\n')
          .map(f => svnUrl + f);
        resolve(files);
      }
    });
  });

  return result;
};

module.exports = {
  findAllFiles,
  findFiles
};
