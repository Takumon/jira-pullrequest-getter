require('dotenv').config();

const username = process.env.SVN_USERNAME;
const password = process.env.SVN_PASSWORD;

const Client = require('svn-spawn');
const client = new Client({
  username,
  password,
  noAuthCache: true
});

const getSvnFileNameList = async () => {
  const svnUrls = process.env.SVN_ROPOSITORY_URLS.split(',');

  const cacheFile = `${__dirname}\\..\\svn-file-list.txt`;
  let svnAllFiles;
  if (FileUtil.isExist(cacheFile)) {
    const temp = await FileUtil.read(cacheFile);
    svnAllFiles = temp.split('\r\n');
  } else {
    svnAllFiles = await SVN.findAllFiles(svnUrls);
    await FileUtil.write(cacheFile, svnAllFiles.join('\r\n'));
  }

  return svnAllFiles;
};

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
