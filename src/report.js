const mkdirp = require('mkdirp');
const path = require('path');
const marked = require('marked');
const Handlebars = require('Handlebars');
Handlebars.registerHelper('ifCond', function(v1, v2, options) {
  if (v1 === v2) {
    return options.fn(this);
  }
  return options.inverse(this);
});

Handlebars.registerHelper('simpleName', function(url) {
  return path.basename(url);
});

const FileUtil = require('./file-util.js');
const createDirAndWrite = FileUtil.createDirAndWrite;
const DiffUtil = require('./diff-util.js');

/**
 * 調査結果を出力する
 *
 * @param {string} destDirPath 出力先ディレクトリのファイルパス
 * @param {string} issues JIRAのイシューごとに情報をまとめたもの
 */
const createReport = async (destDirPath, issues) => {
  // markdownで出力
  const markdownTempateSrc = await FileUtil.read(
    path.join(__dirname, 'template-markdown.handlebars')
  );
  const markdownTempate = Handlebars.compile(markdownTempateSrc);
  const markdownContext = markdownTempate({ issues });
  const markdownDestPath = path.join(destDirPath, 'index.md');
  await FileUtil.write(markdownDestPath, markdownContext);

  // CSVで出力
  const csvTempateSrc = await FileUtil.read(
    path.join(__dirname, 'template-csv.handlebars')
  );
  const csvTempate = Handlebars.compile(csvTempateSrc);
  const csvContext = csvTempate({
    csvLines: createCsvLines(issues)
  });
  const csvDestPath = path.join(destDirPath, 'index.csv');
  await FileUtil.write(csvDestPath, csvContext);


  // HTMLで出力
  const htmlTempateSrc = await FileUtil.read(path.join(__dirname, 'template-html.handlebars'));
  const htmlTempate = Handlebars.compile(htmlTempateSrc);
  const htmlContext = htmlTempate({ html_markdown: marked(markdownContext) });
  const htmlDestPath = path.join(destDirPath, 'index.html');
  await FileUtil.write(htmlDestPath, htmlContext);
};

// CSV用に正規化したオブジェクトを返す
const createCsvLines = (issues) => {
  const result = [];
  issues.forEach(issue => {
    issue.modifiedPullRequestDetails.forEach(githubDetail => {
      githubDetail.files.forEach(githubFile => {
        githubFile.pullRequests.forEach((pullRequest, index) => {

          // プルリクエスト情報は最初のみ表示する
          if (index == 0) {
            if (pullRequest.svnInfo.status === '候補なし') {
              result.push({
                jiraKey: issue.key,
                jiraUrl: issue.url,
                jiraSummary: issue.summary,
                jiraDescription: issue.description,
                githubRepository: githubDetail.repository,
                githubPullRequestUrl: `http://github.com/${githubDetail.owner}/${githubDetail.repository}`,
                githubFileName: githubFile.filename,
                githubSimpleFileName: path.basename(githubFile.filename),
                pullRequestNumber: pullRequest.pullRequestNumber,
                pullRequestStatus: pullRequest.status,
                pullRequestDiff: `${issue.key}/${githubDetail.repository}/${githubDetail.filename}.${pullRequest.pullRequestNumber}.${pullRequest.status}.patch.html`,
                svnStatus: pullRequest.svnInfo.status,
                svnUrl: '-',
                svnDiff: '-'
              });

            } else {
              pullRequest.svnInfo.files.forEach((svnFile, index) => {
                result.push({
                  jiraKey: issue.key,
                  jiraUrl: issue.url,
                  jiraSummary: issue.summary,
                  jiraDescription: issue.description,
                  githubRepository: githubDetail.repository,
                  githubPullRequestUrl: `http://github.com/${githubDetail.owner}/${githubDetail.repository}`,
                  githubFileName: githubFile.filename,
                  githubSimpleFileName: path.basename(githubFile.filename),
                  pullRequestNumber: pullRequest.pullRequestNumber,
                  pullRequestStatus: pullRequest.status,
                  pullRequestDiff: `${issue.key}/${githubDetail.repository}/${githubDetail.filename}.${pullRequest.pullRequestNumber}.${pullRequest.status}.patch.html`,
                  svnStatus: pullRequest.svnInfo.status,
                  svnUrl: svnFile.url,
                  svnDiff: `${issue.key}/${githubDetail.repository}/${githubDetail.filename}.${pullRequest.pullRequestNumber}.${pullRequest.status}.patch.svn_${index}.html`
                });
              });
            }
          } else {
            result.push({
              jiraKey: issue.key,
              jiraUrl: issue.url,
              jiraSummary: issue.summary,
              jiraDescription: issue.description,
              githubRepository: githubDetail.repository,
              githubPullRequestUrl: `http://github.com/${githubDetail.owner}/${githubDetail.repository}`,
              githubFileName: githubFile.filename,
              githubSimpleFileName: path.basename(githubFile.filename),
              pullRequestNumber: pullRequest.pullRequestNumber,
              pullRequestStatus: pullRequest.status,
              pullRequestDiff: `${issue.key}/${githubDetail.repository}/${githubDetail.filename}.${pullRequest.pullRequestNumber}.${pullRequest.status}.patch.html`,
              svnStatus: '-',
              svnUrl: '-',
              svnDiff: '-'
            });
          }
        });
      });
    });
  });

  return result;
};

// TODO GitHubのPatchは改行コードを無視したい
/**
 * プルリクエスト前後のソースコードとパッチファイルを出力する
 * フォルダ構成は JIRAのイシュー名/モジュール名　でその配下に実際のリポジトリと同様のフォルダを作成
 * ファイル名はステータス(追加、変更、削除、名前変更)によって異なる
 * <dl>
 *   <dt>変更後ファイル</dt>
 *     <dd>「単純ファイル名.プルリクエスト番号.ステータス.after」　※削除の時は存在しない</dd>
 *   <dt>変更前ファイル</dt>
 *     <dd>「単純ファイル名.プルリクエスト番号.ステータス.before」 ※追加の時は存在しない　名前変更の時は変更後の名前も情報として追加する</dd>
 *   <dt>変更差分</dt>
 *     <dd>「単純ファイル名.プルリクエスト番号.ステータス.patch」</dd>
 *   <dt>変更差分HTML(修正前ファイルと修正後ファイル)<dt>
 *     <dd>「単純ファイル名.プルリクエスト番号.ステータス.patch.html」</dd>
 *   <dt>SVNファイル</dt>
 *     <dd>「単純ファイル名.プルリクエスト番号.ステータス.svn」　※複数候補がある場合は、「svn_1」のように候補番号をつける</dd>
 *   <dt>差分比較HTML(SVNファイルと修正前ファイル)</dt>
 *     <dd>「単純ファイル名.プルリクエスト番号.ステータス.patch.svn.html」　※複数候補がある場合は、「svn_1」のように候補番号をつける</dd>
 * </dl>
 * @param {string} destDirPath 出力先ディレクトリのファイルパス
 * @param {string} issues JIRAのイシューごとに情報をまとめたもの
 */
const createPullRequestDiff = (destDirPath, issues) => {
  issues.forEach(issue => {
    const issueDirPath = path.join(destDirPath, issue.key);
    mkdirp.sync(issueDirPath);

    issue.modifiedPullRequestDetails.forEach(pullRequestDetail => {
      const repositoryDirPath = path.join(issueDirPath, pullRequestDetail.repository);
      mkdirp.sync(repositoryDirPath);

      pullRequestDetail.files.forEach(githubFile => {
        const [dirName, simpleName, dirPaths] = splitDirAndFile(githubFile.filename);

        // GitHubのプルリクの差分などを出力
        githubFile.pullRequests.forEach(pullRequest => {
          const createPath = suffix => {
            // pushは破壊的なのでconcatを使う
            const pathArray = [repositoryDirPath]
              .concat(dirPaths)
              .concat([
                `${simpleName}.${pullRequest.pullRequestNumber}.${pullRequest.status}.${suffix}`
              ]);
            return path.join.apply(null, pathArray);
          };

          if (pullRequest.status === 'modified') {
            createDirAndWrite(createPath('after'), pullRequest.content_after);
            createDirAndWrite(createPath('before'), pullRequest.content_before);
            createDirAndWrite(createPath('patch'), pullRequest.patch);

            const patchPath = createPath('patch.html');
            DiffUtil.createPatch(
              path.dirname(patchPath),
              path.basename(patchPath),
              dirName,
              pullRequest.content_before,
              pullRequest.content_after,
              pullRequest.filename,
              pullRequest.filename
            );
          } else if (pullRequest.status === 'added') {
            createDirAndWrite(createPath('after'), pullRequest.content_after);
            createDirAndWrite(createPath('patch'), pullRequest.patch);
            const patchPath = createPath('patch.html');
            DiffUtil.createPatch(
              path.dirname(patchPath),
              path.basename(patchPath),
              dirName,
              '',
              pullRequest.content_after,
              pullRequest.filename,
              pullRequest.filename
            );
          } else if (pullRequest.status === 'deleted') {
            reateDirAndWrite(createPath('before'), pullRequest.content_before);
            createDirAndWrite(createPath('patch'), pullRequest.patch);
            const patchPath = createPath('patch.html');
            DiffUtil.createPatch(
              path.dirname(patchPath),
              path.basename(patchPath),
              dirName,
              pullRequest.content_before,
              '',
              pullRequest.filename,
              pullRequest.filename
            );
          } else if (pullRequest.status === 'renamed') {
            createDirAndWrite(createPath('after'), pullRequest.content_after);
            // リネームの場合は修正前の単純ファイル名をファイル名に反映する
            const previousSimpleFileName = pullRequest.previous_filename.split('/').pop();
            createDirAndWrite(
              createPath(`${previousSimpleFileName}.before`),
              pullRequest.content_before
            );
            createDirAndWrite(createPath('patch'), pullRequest.patch);
            const patchPath = createPath('patch.html');
            DiffUtil.createPatch(
              path.dirname(patchPath),
              path.basename(patchPath),
              dirName,
              pullRequest.content_before,
              pullRequest.content_after,
              pullRequest.previous_filename,
              pullRequest.filename
            );
          }
        });

        // GitHub１つのファイルに対して複数のプルリクエストがある場合は
        // 一番古いプルリクエストのプルリクエスト前と
        // 一番新しいプルリクエストのプルリクエスト後の差分を出力する
        if (githubFile.pullRequests.length >= 2) {
          const oldest = githubFile.pullRequests[0];
          const latest = githubFile.pullRequests[githubFile.pullRequests.length - 1];
          // pushは破壊的なのでconcatを使う
          const pathArray = [repositoryDirPath]
            .concat(dirPaths)
            .concat([
              `${simpleName}.${oldest.pullRequestNumber}_${latest.pullRequestNumber}.patch.html`
            ]);
          const patchPath = path.join.apply(null, pathArray);

          DiffUtil.createPatch(
            path.dirname(patchPath),
            path.basename(patchPath),
            dirName,
            oldest.content_before || '',
            latest.content_after || '',
            oldest.previous_filename || oldest.filename || '',
            latest.filename
          );

          const relativeUrl = [issue.key, pullRequestDetail.repository]
            .concat(dirPaths)
            .concat([
              `${simpleName}.${oldest.pullRequestNumber}_${latest.pullRequestNumber}.patch.html`
            ]);
          // pathでjoinしてしまうとWindowsではバックスラッシュつなぎになってしまいURLとして成り立たないため
          // 単純にスラッシュでjoinする
          githubFile.allPullRequestDiff = relativeUrl.join('/');
        }

        // SVNとGitHubの差分などを出力
        const oldestPullRequest = githubFile.pullRequests[0];
        const svnFiles = oldestPullRequest.svnInfo.files;
        const createPath = suffix => {
          // pushは破壊的なのでconcatを使う
          const pathArray = [repositoryDirPath]
            .concat(dirPaths)
            .concat([
              `${simpleName}.${oldestPullRequest.pullRequestNumber}.${
                oldestPullRequest.status
              }.${suffix}`
            ]);
          return path.join.apply(null, pathArray);
        };

        const createUrl = suffix => {
          // pushは破壊的なのでconcatを使う
          const pathArray = [issue.key, pullRequestDetail.repository]
            .concat(dirPaths)
            .concat([
              `${simpleName}.${oldestPullRequest.pullRequestNumber}.${
                oldestPullRequest.status
              }.${suffix}`
            ]);
          return pathArray.join('/');
        };

        // 追加の場合はSVNにもないという想定で比較しない
        if (oldestPullRequest.status === 'added') {
          createDirAndWrite(createPath('svn.not_found_for_added'), 'not_found');
          githubFile.svnPatchFiles = [createPath('svn.not_found_for_added')];
        } else {
          svnFiles.forEach((svnFile, index) => {
            createDirAndWrite(createPath(`svn_${index}`), svnFile.content);
            const patchPath = createPath(`patch.svn_${index}.html`);

            DiffUtil.createPatch(
              path.dirname(patchPath),
              path.basename(patchPath),
              dirName,
              svnFile.content,
              oldestPullRequest.content_before,
              svnFile.url, // TODO URLでいいのか？検討
              oldestPullRequest.filename
            );
          });
        }
      });
    });
  });
};

const splitDirAndFile = path => {
  const paths = path.split('/');
  const file = paths.pop(); // pathsから単純ファイル名を削除
  const dir = paths.join('/');
  return [dir, file, paths];
};

module.exports = {
  createReport,
  createPullRequestDiff
};
