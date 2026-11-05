# 8pix Social Monitor

アプリとは独立した、X・pixiv・Instagramの状況を確認するGitHub Pagesサイト。

**公開URL：https://tsdesignltd.github.io/8pix-dashboard/**

## 表示するもの

- フォロワー総数・投稿総数・期間内投稿数
- X：過去30日に公開した投稿の累計インプレッション（30日間に発生した全インプレッションとは異なります）
- Instagram：過去30日のアカウントViews。インプレッションと別指標です
- pixiv：閲覧数・フォロワー数・投稿数の表示枠を用意。公式の自動取得方法は未確認のため、現時点でコレクターは未実装です
- 各チャンネルの取得日時とエラー状態。日々のフォロワー推移

サンプル数値は使いません。未接続・取得できない数値は`null`、画面では「—」です。APIから実際に0を取得した場合だけ0を表示します。SNSごとの数値を表示します。

## 接続方法

### 1. X

対象：https://x.com/eightpxdx

X Developer ConsoleでAPIアクセスを用意し、Bearer TokenをGitHubのSecretsに `X_BEARER_TOKEN` として登録します。APIの利用料金・残高・エンドポイント権限はX側で確認してください。X Premiumの契約とAPIの利用権限は別です。設定前はAPIを呼びません。

- GET `/2/users/by/username/eightpxdx?user.fields=public_metrics`
- GET `/2/users/{id}/tweets?tweet.fields=created_at,public_metrics&exclude=retweets&start_time=...`

期間内投稿は返信を含み、リポストを除きます。プロフィールの投稿総数はAPIの`tweet_count`をそのまま使用するため、集計対象が異なります。最大20ページを超えたときは期間集計を未取得にします。

公式資料：https://docs.x.com/x-api/fundamentals/metrics / https://docs.x.com/x-api/users/get-posts

### 2. Instagram

対象：https://www.instagram.com/eightpxdx/

InstagramのBusiness/Creatorアカウントに対するInstagram Login方式のAPI接続が必要です。Metaアプリと権限設定はアカウント所有者が行ってください。

GitHub Secrets：

- `INSTAGRAM_ACCESS_TOKEN`：認証済みのアクセストークン
- `INSTAGRAM_USER_ID`：そのトークンに対応するInstagramユーザーID

GitHub Variables：`INSTAGRAM_API_VERSION`（初期値は`v24.0`）。有効なAPIバージョンに合わせて変更してください。

要求する読み取り：プロフィール（username、followers_count、media_count）、ユーザーinsights（views、period=day、metric_type=total_value、30日）、media（id、timestamp）。Instagram Login方式の基本情報とインサイトに対応する権限を用意します。Meta側の仕様変更・権限・データ提供条件により取得できない指標は、空欄／一部取得のまま表示します。実アカウントへのAPI接続試験は未実施です。

コレクターはAPIが返す次ページURLを直接たどらず、固定ホストとカーソルを使います。トークンを公開URL・ログへ出力しません。

公式資料：https://developers.facebook.com/docs/instagram-platform/insights/ / https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api

### 3. pixiv

対象：https://www.pixiv.net/users/130668931

公式の自動取得APIが確認できていません。非公式APIやログインCookieの転用は行いません。現在は未取得です。公式連携や許可された提供元が決まり次第、コレクターを追加する必要があります。pixivの閲覧数はインプレッションとは異なります。

参考：https://www.pixiv.help/hc/ja/articles/34139670210713

### 自動更新ワークフロー

`.github/workflows/refresh-metrics.yml` を登録済みです。毎日07:00（日本時間）と手動実行で取得・公開します。`automation/refresh-metrics.yml` は同じ内容の参照用テンプレートです。GitHub Actionsのスケジュールは遅延する場合があります。

Pagesの公開元はGitHub Actionsへ設定済みです。認証情報がなければ、データは未取得のままです。

[Secretsを開く](https://github.com/tsdesignltd/8pix-dashboard/settings/secrets/actions) / [Actionsを開く](https://github.com/tsdesignltd/8pix-dashboard/actions)

## 公開範囲

GitHub Pagesの画面、配信JSON、リポジトリは公開です。APIトークンやCookieをコミットしないでください。数値は公開されるため、公開できる指標だけを収集します。クライアント側のパスワードで非公開を装う機能は設けていません。

「表示を更新」は公開済みJSONの再読み込みであり、APIの再実行ではありません。実際の収集はActionsから実行します。失敗したチャンネルの前回値・前回取得日時を保持し、取得失敗を0扱いしません。36時間以上前の値は過去データと表示します。

## ローカル

Node.js 22以降。追加パッケージ不要です。

```sh
npm test
npm run collect
npm run preview
```

HTTPサーバーから`site/`を配信してください。API接続はGitHub Secretsまたは環境変数で設定します。トークンをチャットに貼る必要はありません。
