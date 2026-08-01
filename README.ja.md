# EVE ESI LLM Bridge — 日本語

**各利用者が、自分のEVEアカウント、自分のEVE Developer Application、自分のVercel環境を使う**ことを前提にした、EVE Online ESI ↔ MCP/LLM連携の自己ホスト型リファレンス実装です。

[English README](README.md)

この配布物には、他人のEVE Client ID、Character ID、access token、refresh token、Vercel認証情報、秘密鍵、事前認証済みアカウントは含まれません。誰かの既存ゲートウェイを共有する方式でもありません。

## 何ができるか

EVE SSO認証後、ChatGPT、Claude Code、CodexなどのMCPクライアントから、主に次を扱えます。

- 認証したキャラクターの現在のprivate ESI情報を取得する
- 宇宙・市場・ルート・kill/jump・type等のofficial public ESIを取得する
- EVE公式resolverで名前とIDを相互変換する
- 現在のESI OpenAPIと認可済みscopeを照合して、利用可能そうなAPI面を調べる
- 明示的に有効化した場合だけ、限定されたESI write/UI actionをprepare→executeの2段階で実行する

これは**ESIをLLMから安全に使いやすくするための仕組み**です。ゲームクライアントそのものを自動操縦する仕組みではありません。戦闘操作、warp/jump実行、module/drone操作、scan、Overview/Local、通常のinventory操作など、ESIに存在しない機能は実行できません。

## 全体像

```text
ChatGPT / Claude / Codex
        |
        | MCP OAuth authorization-code + PKCE
        v
自分のVercel deployment
        |
        | EVE SSO OAuth + PKCE
        v
CCP EVE SSO ----> EVE ESI
        |
        `---- 自分が選択したcharacter + 自分が許可したESI scopesだけ
```

MCP側のOAuthとEVE SSOは別物です。LLMクライアントから来た接続を、EVE SSOで認証されたcharacterへ安全に結び付けるために二層に分けています。

詳しくは [Architecture](docs/ARCHITECTURE.md) を参照してください。

## 安全性の基本方針

- EVE認証はPKCEを利用し、この実装ではEVE client secretをruntimeに持たせない
- `MCP_AUTH_SECRET` は各自が生成し、Vercel環境変数だけに保存する
- ESIの接続先はコード内で固定し、LLMが任意URLへproxyさせることはできない
- `/characters/{id}/...` は認証済みcharacter IDと一致しなければ拒否する
- EVE JWTはsignature / issuer / audience / expiry / subjectを検証する
- ESI scopeは各利用者が必要なものだけ選ぶ
- write actionは初期状態で無効
- writeはallowlist + 10分ticketのprepare→execute方式
- 個人用deploymentでは `EVE_ALLOWED_CHARACTER_IDS` で自分のcharacterだけに制限可能

writeを有効化する前に [Security](docs/SECURITY.md) を読んでください。

---

# 最短セットアップ

## 0. 必要なもの

- EVE Onlineアカウント
- EVE Developers Portal
- GitHub等のソース置き場
- Vercelアカウント
- 対応MCPクライアント

**Web版ChatGPTについて:** 2026-08-02時点のOpenAI公式案内では、full custom MCP（write/modify含む）はBusiness / Enterprise / Edu、Proはdeveloper modeでread/fetch MCP接続が対象です。Plusはcustom MCP developer modeの対象として公式記事に記載されていません。UI・プラン条件は変化するため、利用時点の公式案内を確認してください。

## 1. 自分のリポジトリへ置く

Release ZIPまたはソース一式を、自分が管理するGitHubリポジトリ等へ置きます。他人の`.env`や認証値はコピーしません。

## 2. Vercelへ一度deployする

Vercel Dashboardから自分のリポジトリをImportします。最初のdeployはEVE認証情報が未設定でもbuild可能です。

production URLを確定します。

```text
https://YOUR-PROJECT.vercel.app
```

Preview URLではなく、安定したproduction URLをOAuth callbackに使います。

詳細: [Vercel deployment](docs/VERCEL-DEPLOY.md)

## 3. 自分のEVE Developer Applicationを作る

EVE Developers Portalでアプリを作成し、callback URLを次のように設定します。

```text
https://YOUR-PRODUCTION-DOMAIN/oauth/eve/callback
```

必要なESI scopeだけを有効にします。read中心の例は `.env.example` と [ESI scopes](docs/ESI-SCOPES.md) にあります。

Client IDを控えます。この実装のEVE SSO部分はPKCE方式なので、EVE client secretは使用しません。

詳細: [EVE Developer setup](docs/EVE-DEVELOPER-SETUP.md)

## 4. 自分の暗号化secretを生成する

Node.jsがある場合:

```bash
npm run secret
```

Node.jsを使わない場合は、配布物の `tools/generate-secret.html` をローカルで開いて生成できます。Web Cryptoだけで32byteの値を作り、外部送信はしません。

## 5. Vercel環境変数を設定する

```text
EVE_CLIENT_ID=<自分のEVE app Client ID>
MCP_AUTH_SECRET=<自分で生成したsecret>
PUBLIC_BASE_URL=https://YOUR-PRODUCTION-DOMAIN
EVE_ESI_SCOPES=<自分が有効にしたscopeをspace区切り>
EVE_ENABLE_WRITE_ACTIONS=false
MAX_ESI_PAGES=50
MCP_REFRESH_TTL_DAYS=7
```

個人用なら推奨:

```text
EVE_ALLOWED_CHARACTER_IDS=<自分のcharacter ID>
```

設定後にredeployします。

## 6. 動作確認

ブラウザで以下を確認します。

```text
https://YOUR-PRODUCTION-DOMAIN/
https://YOUR-PRODUCTION-DOMAIN/.well-known/oauth-protected-resource
https://YOUR-PRODUCTION-DOMAIN/.well-known/oauth-authorization-server
```

MCP endpoint:

```text
https://YOUR-PRODUCTION-DOMAIN/api/mcp
```

ChatGPTやClaudeの設定画面へEVE refresh tokenや`MCP_AUTH_SECRET`を貼る必要はありません。OAuthフローからEVE SSOへ進むのが正常です。

## 7A. Web版ChatGPTへ接続

対応プラン/Workspaceの場合、概ね次の手順です。

1. developer modeを有効化
2. Settings / Workspace Settings → Apps → Create
3. MCP endpointに `https://YOUR-PRODUCTION-DOMAIN/api/mcp`
4. OAuth認証を利用
5. Scan tools
6. 認証画面が開いたらEVEへログインし、characterを選択
7. ESI scopesを確認して許可
8. appを作成
9. 新しいchatでappを有効にして `eve_status` を使わせる

ChatGPTのOAuth callback URLをEVE Developer Portalへ登録する必要はありません。EVEがredirectする相手は常に**あなたのbridge**の `/oauth/eve/callback` です。その後bridgeがChatGPTへ戻します。

詳細: [ChatGPT Web setup](docs/CHATGPT-WEB.md)

## 7B. Claude Codeへ接続

```bash
claude mcp add --transport http eve https://YOUR-PRODUCTION-DOMAIN/api/mcp
claude
```

Claude Code内で:

```text
/mcp
```

対象serverを選んでOAuth認証を進めると、ブラウザでEVE SSOが開きます。

詳細: [Claude and other MCP clients](docs/CLAUDE-AND-OTHER-CLIENTS.md)

## 最初のプロンプト例

```text
ESIを使って、現在のship、location、wallet、skillを確認してください。
会話履歴の古い値で補完せず、APIから確定した事実と推論を分けてください。
```

```text
public ESIでJitaをresolveし、取得できる公式system情報を確認してください。
ESIで取れない現行情報が必要な場合だけweb調査へ回してください。
```

```text
eve_capabilitiesを呼び、今のOAuth tokenとbridge policyで使えるread機能を整理してください。
```

## writeを有効化する場合

1. EVE Developer Application側で必要なwrite scopeを有効化
2. `EVE_ESI_SCOPES`にも追加
3. `docs/SECURITY.md` と `src/lib/action-policy.js` を確認
4. `EVE_ENABLE_WRITE_ACTIONS=true`
5. redeploy
6. EVE SSOを再認証して新しいscopeを付与

writeは `eve_prepare_action` → 10分ticket → `eve_execute_action` の2段階です。

## ファイル構成

```text
app/api/[transport]/route.js            MCP tools
app/oauth/*                             MCP OAuth + EVE SSO bridge
app/.well-known/*                       discovery metadata
src/lib/eve.js                          EVE SSO/JWT/ESI
src/lib/esi-policy.js                   ESI path / character restriction
src/lib/oauth*.js                       MCP OAuth/token/DCR
src/lib/action-policy.js                write allowlist
src/lib/actions.js                      prepare/execute
config/scopes.json                      scope samples
skills/eve-esi-assistant/SKILL.md       LLM skill用の叩き台
docs/                                   詳細資料
tools/generate-secret.html              offline secret generator
tests/                                  policy/crypto tests
```

## LLMへ渡してSkill化する場合

このrepo全体をLLMへ渡し、次のように指示できます。

```text
このリポジトリを全て読み、公開されているMCP toolsを利用するEVE Online支援Skillを作成してください。
current API-visible stateはauthenticated ESIを最優先、official public dataはpublic ESIを優先、
client-only情報はscreenshots/logs、webはAPIで埋まらないgapだけ、inferenceは最後に分離してください。
write actionはprepare -> execute境界を維持し、allowlistを勝手に拡張しないでください。
```

すぐ流用できる叩き台: [SKILL.md](skills/eve-esi-assistant/SKILL.md)

## 重要な制限

- ESIに存在しないゲーム内情報は取得できません
- scopeがあってもcorporation/fleet role不足で403になる場合があります
- marketやsystem statisticsからclient-onlyのanomaly存在を推測してはいけません
- この内蔵OAuth serverは個人/管理された自己ホスト用途向けのコンパクトなreferenceです。多数ユーザー向けSaaSとして公開するなら、成熟したIdP/authorization serviceへ置き換えるべきです
- ChatGPT/Claude/Vercel/EVEのUIや仕様は更新されるため、現行公式ドキュメントを優先してください

## 詳細資料

- [Architecture](docs/ARCHITECTURE.md)
- [Security](docs/SECURITY.md)
- [EVE Developer setup](docs/EVE-DEVELOPER-SETUP.md)
- [ESI scopes](docs/ESI-SCOPES.md)
- [Vercel deployment](docs/VERCEL-DEPLOY.md)
- [ChatGPT Web](docs/CHATGPT-WEB.md)
- [Claude / other MCP clients](docs/CLAUDE-AND-OTHER-CLIENTS.md)
- [Implementation / glossary](docs/IMPLEMENTATION-NOTES.md)
- [LLM Skill integration](docs/LLM-SKILL-INTEGRATION.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)

## 公式資料

- https://developers.eveonline.com/docs/services/sso/
- https://developers.eveonline.com/docs/services/esi/overview/
- https://developers.openai.com/plugins/build/auth
- https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt-beta
- https://vercel.com/docs/mcp/deploy-mcp-servers-to-vercel
- https://docs.anthropic.com/en/docs/claude-code/mcp
- https://modelcontextprotocol.io/

MIT License。EVE Online等の商標はCCP Gamesに帰属します。本プロジェクトはCCP Games、OpenAI、Anthropic、Vercelの公式製品または公認プロジェクトではありません。
