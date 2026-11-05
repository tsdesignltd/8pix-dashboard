# 8pix Social Monitor

[ダッシュボードを開く](https://tsdesignltd.github.io/8pix-dashboard/)

アプリとは独立した、X・pixiv・Instagramの確認用GitHub Pagesサイトです。各SNSのフォロワー数・投稿数・表示／閲覧指標と確認日時を表示します。

## ブラウザ確認方式

API接続から、Codexがブラウザで表示を確認して数値を保存・公開する方式へ切り替えました。APIキー・開発者登録は不要です。GitHub Pages自身がSNSを巡回する仕組みではありません。実行するMacとCodexが必要です。SNSの非公開の分析画面を見る場合は、通常のSNSログインが必要です。

「表示を更新」は公開済みJSONの再読み込みです。SNSの確認を開始するボタンではありません。

### 対象

- X：https://x.com/eightpxdx
- Instagram：https://www.instagram.com/eightpxdx/
- pixiv：https://www.pixiv.net/users/130668931

### 確認のルール

1. 対象アカウントが一致することを確認し、画面に表示された正確な数値だけを記録します。省略表示の「1.2K」等は推測で1200にしません。
2. フォロワー数、投稿総数、対象30日間の投稿数、表示／閲覧数を区別します。画面にない項目は未確認です。見えている投稿の件数を投稿総数としません。
3. 表示／閲覧数を記録する場合は、画面で確認できた対象期間と対象範囲を `viewScope` に記載します。一部投稿の表示数をアカウント全体として合算しません。
4. ログイン要求、CAPTCHA、アクセス制限、安全制限があれば止めます。回避やCookieの抽出は行いません。
5. 確認した日時を記録します。今回確認できなかったチャンネルの過去値は保持し、確認できたチャンネル内で未確認の項目は空欄へ戻します。36時間以上前の確認値は過去データと表示します。
6. 公開するのは指標、確認日時、対象プロフィールURLだけです。スクリーンショット、ページ全体、個人連絡先、Cookie、トークン、パスワードはコミットしません。

現環境ではpixivへのブラウザアクセスが安全制限でブロックされています。pixivの自動確認は未対応です。別の経路を使って回避しないでください。必要な数値をユーザーが確認して提供する方法は利用できます。

### 記録と公開

確認した数値を一時JSONにまとめ、次のコマンドで取り込みます。

```sh
npm run import:browser -- /absolute/path/observations.json
npm test
git add site/data/metrics.json
git commit -m 'Update verified browser metrics'
git push
```

JSONの `observations` 配列には `platform`（x / pixiv / instagram）、`observedAt`（実際の確認日時のISO形式）、`metrics`（確認したキーのみ）を指定します。数値キーは `followers`、`totalPosts`、`periodPosts`、`views` です。`views` を含める場合は `viewScope` が必須です。未取得を0にしません。空の `metrics` は過去値を更新しません。

日ごとのフォロワー数は日本時間で保存し、同日再確認は上書きします。履歴は366日保持します。

## 公開処理

`.github/workflows/refresh-metrics.yml` は検証済みデータをGitHub Pagesへ公開する処理です。API取得とGitHub Actionsの定期実行は無効にしました。更新はブラウザ確認後のデータコミットを契機に公開します。Codexの定期確認は別途設定が必要です。

以前のAPI取得処理は `scripts/collect.mjs` と `automation/refresh-metrics.yml` に参照用として残しています。現行の公開ワークフローからは呼び出しません。

## ローカル

Node.js 22以降、追加パッケージ不要です。

```sh
npm test
npm run preview
```

GitHub Pages、配信JSON、リポジトリは公開です。
