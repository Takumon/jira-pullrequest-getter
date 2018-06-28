require('dotenv').config();
const mkdirp = require('mkdirp');
const path = require('path');

const JIRA = require('./jira.js');
const GITHUB = require('./github.js');
const Report = require('./report.js');

/**
 * 実処理
 */
async function main() {
  try {
    const jireBaseUrl = process.env.JIRA_BASE_URL;
    const jiraUserName = process.env.JIRA_USERNAME;
    const jiraPassowrd = process.env.JIRA_PASSWORD;
    const jiraProject = process.env.JIRA_PROJECT;
    const jiraIssues = process.env.JIRA_ISSUES.split(',');
    const githubToken = process.env.GITHUB_TOKEN;

    const session = await JIRA.auth(jireBaseUrl, jiraUserName, jiraPassowrd).catch(error =>
      console.log(error)
    );

    const issues = await Promise.all(
      jiraIssues.map(async issueKey => {
        const issue = await JIRA.getIssue(jireBaseUrl, jiraProject, session, issueKey).catch(
          error => console.log(error)
        );

        const issueId = issue.id;

        // プルリクエスト情報取得
        const _pullRequests = await JIRA.getPullRequestsOf(jireBaseUrl, session, issueId);

        // モジュール群取得
        const modules = [];
        _pullRequests.forEach(pullRequest => {
          if (modules.find(f => f.repository === pullRequest.repository)) {
            const module = modules.find(f => f.repository === pullRequest.repository);
            module.pullRequests.push(pullRequest);
          } else {
            modules.push({
              repository: pullRequest.repository,
              owner: pullRequest.owner,
              pullRequests: [pullRequest]
            });
          }
        });

        // プリリクエストに紐づくGitHubファイル情報を追加したプリクリエスト情報を取得
        // SVN情報も合わせて取得
        const pullRequestDetails = await Promise.all(
          _pullRequests.map(
            async pull =>
              await GITHUB.getPullRequestFiles(
                githubToken,
                pull.owner,
                pull.repository,
                pull.pullRequestNumber
              )
          )
        );

        const modifiedPullRequestDetails = groupingByModuleAndFile(pullRequestDetails);

        return {
          key: issueKey,
          url: issue.url,
          description: issue.fields.description,
          summary: issue.fields.summary,
          pullRequestDetails,
          modules,
          modifiedPullRequestDetails
        };
      })
    );

    // レポート出力
    const destDirPath = path.join(__dirname, '..', 'dest');
    mkdirp.sync(destDirPath);
    await Report.createReport(destDirPath, issues);
    Report.createPullRequestDiff(destDirPath, issues);
  } catch (e) {
    console.log(e);
  }
}

/*
戻り値のスキーマ
[
  {
    owner: string, // プルリクエスト対象リポジトリの所属グループ
    repository: string, // プルリクエスト対象リポジトリ

    files: [ // プルリクエストに対する修正情報リスト（ファイル名ごと）
      {
        filename: string, // 修正ファイル名
        url_master: string, // リポジトリのマスターブランチにおけるファイルのURL

        pullRequests: [ // プルリクエスト情報のリスト
          {
            pullRequestNumber: number, // プルリクエストの番号

            filename: string, // リポジトリ配下からのファイルパス（先頭スラなし）
            previous_filename: string // (status = 'renamed'の場合)プルリクエスト前のファイル名
            status: 'added' | 'modified' | 'renamed' | 'deleted', // 変更ステータス(追加、変更、削除、リネームのいずれか)
            additions: number, // 追加行数
            deletions: number, // 削除行数
            changes: number, // 変更行数
            patch: string, // 今回変更分のパッチ

            url_master: string, // リポジトリのマスターブランチにおけるファイルのURL
            url_after: string, // プルリクエスト後の状態のファイルのURL
            content_after: string // プルリクエスト後の状態のファイル
            url_before: string, // (status != 'added'の場合)プルリクエスト前の状態のファイルのURL
            content_before: string // (status != 'added'の場合)プルリクエスト前の状態のファイル
            svnInfo: {
              status: '候補なし' |  '候補確定' | '候補複数',
              files: [
                url: string, // SVNのファイルURL
                content: string // SVNのファイル
              ]
            }
          }
        ]
      }
    ]
  }
]
*/

/**
 * プルリクエスト詳細リストをモジュールごとにファイルごと※にプルリクエスト詳細を整理
 * ※複数のプルリクエストにまたがっているファイル修正もあり、ファイルに対する修正を俯瞰したいため、ファイルごとにまとめる
 *
 * TODO リネームの考慮(リネームすると名前が変わるので、その軌跡を考慮してファイル名のグルーピンが必要)
 *
 * @param {*} pullRequestDetails プルリクエスト詳細リスト
 */
const groupingByModuleAndFile = pullRequestDetails => {
  const githubFiles = [];
  // モジュール単位でグルーピング
  pullRequestDetails.forEach(detail => {
    const repositoryInfo = githubFiles.find(f => f.repository === detail.repository);
    if (repositoryInfo) {
      // ファイル単位でグルーピング
      detail.files.forEach(detailFile => {
        // (親情報を子情報に追加)プルリク番号をdetailFileに追加
        detailFile.pullRequestNumber = detail.number;

        const file = repositoryInfo.files.find(f => f.filename === detailFile.filename);
        if (file) {
          file.pullRequests.push(detailFile);
          return;
        }

        // ファイル情報がない場合は新規登録
        repositoryInfo.files.push({
          filename: detailFile.filename,
          url_master: detailFile.url_master,
          pullRequests: [detailFile]
        });
      });
      return;
    }

    // モジュール情報がない場合は新規登録
    githubFiles.push({
      owner: detail.owner,
      repository: detail.repository,

      // １つのプルリクエストの中でファイルが重複することはありえないので、単純に1ファイル名ごとに1ファイルでまとめていく
      files: detail.files.map(detailFile => {
        // (親情報を子情報に追加)プルリク番号をdetailFileに追加
        detailFile.pullRequestNumber = detail.number;
        return {
          filename: detailFile.filename,
          url_master: detailFile.url_master,
          pullRequests: [detailFile]
        };
      })
    });
  });

  // プルリクエスト番号ごとにソート
  githubFiles.forEach(module => {
    module.files.forEach(file => {
      file.pullRequests.sort((a, b) => {
        a.pullRequestNumber - b.pullRequestNumber;
      });
    });
  });

  return githubFiles;
};

main();
