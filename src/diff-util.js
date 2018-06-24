const path = require('path');
const diff = require('diff');
const diff2html = require('diff2html').Diff2Html;

const FileUtil = require('./file-util.js');

/**
 * 指定した差分比較対象AとBをもとに差分比較結果をHTMLファイルで出力する
 *
 * @param {string} destDirPath 差分HTMLファイル出力先フォルダパス
 * @param {string} htmlFileName 差分HTMLファイルのファイル名
 * @param {string} filename パッチファイル名
 * @param {string} contentA 差分比較対象Aのファイル内容
 * @param {string} contentB 差分比較対象Bのファイル内容
 * @param {string} filenameA 差分比較対象Aのファイル名
 * @param {string} filenameB 差分比較対象Bのファイル名
 */
const createPatch = (
  destDirPath,
  htmlFileName,
  filename,
  contentA,
  contentB,
  filenameA,
  filenameB
) => {
  const unifiedDiff = diff.createPatch(filename, contentA, contentB, filenameA, filenameB, {
    ignoreWhitespace: true,
    newlineIsToken: false,
    context: 10000
  });

  const diffHtmlContent = diff2html.getPrettyHtml(unifiedDiff, {
    inputFormat: 'diff',
    outputFormat: 'side-by-side',
    showFiles: true,
    matching: 'lines'
  });

  const templateDiffHtml =
    `
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      #original-style-body .d2h-code-line-prefix {
        display: none;
      }
      #original-style-body .d2h-code-side-linenumber {
        -webkit-touch-callout: none; /* iOS Safari */
        -webkit-user-select: none; /* Chrome/Safari/Opera */
        -khtml-user-select: none; /* Konqueror */
        -moz-user-select: none; /* Firefox */
        -ms-user-select: none; /* Internet Explorer/Edge */
        user-select: none; /* Non-prefixed version, currently not supported by any browser */
      }
      #original-style-body #back-btn {
        position: fixed;
        top: 12px;
        right: 12px;
        background: #1c74ea;
        border-radius: 6px;
        width: 120px;
        height: 24px;
        cursor: pointer;
      }

      #original-style-body .d2h-file-wrapper {
        margin-bottom: 120px;
      }

      #original-style-body #back-btn:hover {
        opacity: 0.7;
      }
    </style>
    <link rel="stylesheet" type="text/css" href="https://cdnjs.cloudflare.com/ajax/libs/diff2html/2.4.0/diff2html.min.css">
  </head>
  <body id="original-style-body">
  <button id="back-btn" onclick="history.back()">Back</button>` +
    diffHtmlContent +
    `</body>
  </html>
  `;

  const destPath = path.join(destDirPath, htmlFileName);
  FileUtil.createDirAndWrite(destPath, templateDiffHtml);
};

module.exports = {
  createPatch
};
