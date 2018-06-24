const mkdirp = require('mkdirp');
const path = require('path');
const marked = require('marked');
const Handlebars = require('Handlebars');
Handlebars.registerHelper('ifCond', function(v1, v2, options) {
  if(v1 === v2) {
    return options.fn(this);
  }
  return options.inverse(this);
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

  // HTMLで出力
  const htmlTempateSrc = await FileUtil.read(path.join(__dirname, 'template-html.handlebars'));
  const htmlTempate = Handlebars.compile(htmlTempateSrc);
  const htmlContext = htmlTempate({ html_markdown: marked(markdownContext) });
  const htmlDestPath = path.join(destDirPath, 'index.html');
  await FileUtil.write(htmlDestPath, htmlContext);
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
    const issueDirPath = path.join(destDirPath, issue.issueKey);
    mkdirp.sync(issueDirPath);

    issue.pullRequestDetails.forEach(pullRequestDetail => {
      const pullRequestDirPath = path.join(issueDirPath, pullRequestDetail.repository);
      mkdirp.sync(pullRequestDirPath);

      pullRequestDetail.files.forEach(file => {
        const paths = file.filename.split('/');
        const simpleName = paths.pop(); // pathsから単純ファイル名を削除
        const dirName = paths.join('/');
        const createPath = suffix => {
          // pushは破壊的なのでconcatを使う
          const pathArray = [pullRequestDirPath]
            .concat(paths)
            .concat([`${simpleName}.${pullRequestDetail.number}.${file.status}.${suffix}`]);
          return path.join.apply(null, pathArray);
        };

        if (file.status === 'modified') {
          createDirAndWrite(createPath('after'), file.content_after);
          createDirAndWrite(createPath('before'), file.content_before);
          createDirAndWrite(createPath('patch'), file.patch);

          const patchPath = createPath('patch.html');
          DiffUtil.createPatch(
            path.dirname(patchPath),
            path.basename(patchPath),
            dirName,
            file.content_before,
            file.content_after,
            file.filename,
            file.filename
          );
        } else if (file.status === 'added') {
          createDirAndWrite(createPath('after'), file.content_after);
          createDirAndWrite(createPath('patch'), file.patch);
          const patchPath = createPath('patch.html');
          DiffUtil.createPatch(
            path.dirname(patchPath),
            path.basename(patchPath),
            dirName,
            '',
            file.content_after,
            file.filename,
            file.filename
          );
        } else if (file.status === 'deleted') {
          reateDirAndWrite(createPath('before'), file.content_before);
          createDirAndWrite(createPath('patch'), file.patch);
          const patchPath = createPath('patch.html');
          DiffUtil.createPatch(
            path.dirname(patchPath),
            path.basename(patchPath),
            dirName,
            file.content_before,
            '',
            file.filename,
            file.filename
          );
        } else if (file.status === 'renamed') {
          createDirAndWrite(createPath('after'), file.content_after);
          // リネームの場合は修正前の単純ファイル名をファイル名に反映する
          const previousSimpleFileName = file.previous_filename.split('/').pop();
          createDirAndWrite(createPath(`${previousSimpleFileName}.before`), file.content_before);
          createDirAndWrite(createPath('patch'), file.patch);
          const patchPath = createPath('patch.html');
          DiffUtil.createPatch(
            path.dirname(patchPath),
            path.basename(patchPath),
            dirName,
            file.content_before,
            file.content_after,
            file.previous_filename,
            file.filename
          );
        }

        // SVNのバージョンごとに処理したい
        const svnFiles = file.svnInfo.files;
        if (svnFiles.length === 0) {
          createDirAndWrite(createPath('svn.not_found'), 'not_found');
        } else if (svnFiles.length === 1) {
          createDirAndWrite(createPath('svn'), svnFiles[0].content);
          const patchPath = createPath('patch.svn.html');

          DiffUtil.createPatch(
            path.dirname(patchPath),
            path.basename(patchPath),
            dirName,
            svnFiles[0].content,
            file.content_before,
            svnFiles[0].url, // TODO URLでいいのか？検討
            file.filename
          );
        } else {
          // 二つ以上検索結果がある時
          // TODO 数値で区別した時に、どれがどれかわかるようにしたい（レポートに記載？）
          svnFiles.forEach((svnFile, index) => {
            createDirAndWrite(createPath(`svn_${index}`), svnFile.content);
            const patchPath = createPath(`patch.svn_${index}.html`);

            DiffUtil.createPatch(
              path.dirname(patchPath),
              path.basename(patchPath),
              dirName,
              svnFile.content,
              file.content_before,
              svnFile.url, // TODO URLでいいのか？検討
              file.filename
            );
          });
        }
      });
    });
  });
};

module.exports = {
  createReport,
  createPullRequestDiff
};
