const rp = require('request-promise');

// 本処理の前提
// 「プルリクエストは専用ブランチをマスターブランチにマージする想定」

/*
返却する値のスキーマ
{
  owner: string, // プルリクエスト対象リポジトリの所属グループ
  repository: string, // プルリクエスト対象リポジトリ
  merged_at: date, // プルリクエストがマージされた日付 (例： 2017-03-27T01:14:22Z)
  number: number, // プルリクエストの番号
  url: string // プルリクエストのURL
  baseRef: string, // プルリクエストがマージされる前のマスターブランチのSHA

  files: [
    {
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

    }
  ]
}
*/
const getPullRequestFiles = async (token, owner, repository, pullRequestNumber) => {
  // プルリクエスト情報取得
  const pullrequest = await get(
    `https://api.github.com/repos/${owner}/${repository}/pulls/${pullRequestNumber}`,
    token
  );

  const result = {
    owner,
    repository,
    merged_at: pullrequest.merged_at,
    number: pullrequest.number,
    url: pullrequest.url,
    baseRef: pullrequest.base.sha
  };

  // プルリクエストファイル情報取得
  const files = await get(
    `https://api.github.com/repos/${owner}/${repository}/pulls/${pullRequestNumber}/files`,
    token
  );

  // 上記で取得した情報を元にファイルごとのプルリクエスト情報を取得
  result.files = await Promise.all(
    files.map(async file => {
      const mapped = {
        filename: file.filename,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
        changes: file.changes,
        patch: file.patch,

        url_master: `https://github.com/${owner}/${repository}/tree/master/${file.filename}`,
        url_after: file.raw_url
      };

      // 修正後のファイルを取得
      mapped.content_after = await get(mapped.url_after, token, false);

      // statusに応じてfile_url_beforeとprevious_filenameを追加
      if (file.status === 'added') {
        // 変更前ファイルは存在しないので何もしない
      } else if (file.status === 'renamed') {
        mapped.url_before = `https://raw.githubusercontent.com/${owner}/${repository}/${
          pullrequest.base.sha
        }/${file.previous_filename}`;
        mapped.previous_filename = file.previous_filename;
      } else {
        mapped.url_before = `https://raw.githubusercontent.com/${owner}/${repository}/${
          pullrequest.base.sha
        }/${file.filename}`;
      }

      // 修正前のファイルがある場合は取得
      if (mapped.url_before) {
        mapped.content_before = await get(mapped.url_before, token, false).catch(err => {});
      }

      return mapped;
    })
  );

  return result;
};

const get = (uri, token, isJson = true) => {
  return rp({
    uri: uri,
    method: 'GET',
    headers: {
      'User-Agent': 'request',
      Authorization: `token ${token}`
    },
    json: isJson
  });
};

module.exports = {
  getPullRequestFiles
};
