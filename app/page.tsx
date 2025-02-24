'use client';

import { useState, useEffect } from 'react';

// デフォルトプロンプト
const DEFAULT_PROMPT = `この動画の内容を以下の点に注目して要約してください：
・メインメッセージ
・重要なポイント
・視聴者へのアクションアイテム

また、動画の内容に応じた適切なハッシュタグを3つ程度提案してください。
専門用語は分かりやすく言い換え、文章は簡潔に完結させてください。`;

// 台本生成用プロンプト
const SCRIPT_PROMPT = `あなたはYouTube動画の台本作成の専門家です。以下の制約を必ず守って、動画台本を生成してください。

# 視聴者プロファイル
- 年齢層: 35～54歳がメイン（特に45～54歳が最多）
- 職業: 会社員（管理職・専門職）、自営業、フリーランス
- 特徴: 未来予測、歴史、スピリチュアルに関心が高い

# 本質的欲求への対応
1. 好奇心と探求心
   - 未来予測と論理的分析への強い関心
   - 証拠に基づく考察の重視
   - 歴史的・スピリチュアルな要素の組み込み

2. 社会的つながり
   - 家族や友人との会話のネタとして活用可能な内容
   - 視聴者参加型の要素（意見募集など）

3. 不安解消
   - 未来の不確実性への対処法の提示
   - 具体的な対策や準備の方法の説明

4. エンターテインメント性
   - じっくり視聴できる論理的な展開
   - 6-15分程度の適切な長さ設計

# 台本構成
1. オープニング（30秒）
   - インパクトのある導入
   - 視聴価値の明確な提示
   - 目次の提示

2. 本編（5-7分）
   - 予言者・情報源の詳細な紹介
   - 予言内容の具体的な解説
   - 科学的・論理的な分析
   - 視聴者への実践的アドバイス

3. エンディング（30秒）
   - 重要ポイントの復習
   - 次回予告
   - 視聴者アクション（チャンネル登録等）の促し

# 演出指示
- カメラワーク（アップ、ズーム等）
- テロップ（重要キーワード、数値）
- 画面効果（図解、アニメーション）
- BGM（シーン別の雰囲気）
- B-roll（補足映像）

# 出力フォーマット
---
# タイトル
（視聴者の興味を引くタイトル）

## 動画の概要
（目的と価値提案）

## 目標再生時間
（合計時間：6-8分）

## オープニング（30秒）
（挨拶）
（導入と価値提案）
（目次）

## 本編
### セクション1: 予言者・情報源の紹介（1-2分）
（プロフィール詳細）
（実績や信頼性）
（演出指示）

### セクション2: 予言の詳細解説（2-3分）
（具体的な予言内容）
（科学的・論理的分析）
（演出指示）

### セクション3: 視聴者への提言（2-3分）
（具体的な対策）
（実践的アドバイス）
（演出指示）

## エンディング（30秒）
（まとめ）
（次回予告）
（チャンネル登録等の促し）

## 補足情報
・推奨BGM
・必要な撮影機材
・編集上の注意点
・サムネイル案`;

// ひろし式プロンプト
const HIROSHI_STYLE_PROMPT = `あなたはYouTube動画の内容を都市伝説・予言分析の形式で要約する専門家です。
以下の視聴者プロファイルと本質的欲求を理解した上で、コンテンツを作成してください。

## **視聴者プロファイルと本質的欲求**

### **1. 視聴者プロファイル**
- **年齢層:** 35～54歳がメイン（特に45～54歳が最多）
- **職業:** 会社員（特に管理職・専門職）、自営業、フリーランス
- **特徴:** 未来予測、歴史、スピリチュアルに関心が高い

### **2. ライフスタイル特性**
- 未来予測や歴史、スピリチュアル・オカルトに関心が高い
- 夜の時間帯にリラックスしながらYouTubeを視聴
- 動画をじっくり見る傾向が強い
- ネット上で議論するよりも、身近な人との話題に使う傾向

### **3. 本質的欲求**

#### **A. 好奇心と探求心**
- **未来の予測:** 現在の社会情勢や未来の出来事に関心がある
- **証拠と考察:** ただの噂話ではなく、ロジカルに分析された都市伝説を好む
- **歴史とスピリチュアル:** 過去の出来事や神秘的な話に共感しやすい

#### **B. 社会的つながり**
- **身近な人との話題に:** 家族や友人と話すネタとして視聴することが多い
- **SNS議論よりも視聴優先:** 動画をじっくり視聴する傾向が強い

#### **C. 恐怖と不安の解消**
- **未来の不確実性に備える:** 世界の動きや未来を知ることで安心感を得る
- **ストレス発散:** スリリングな都市伝説を楽しむことで刺激を得る

#### **D. エンターテインメント要素**
- **じっくり見る傾向:** 6分以上の視聴が可能な内容が求められる
- **論理的構成:** 煽りではなく、落ち着いた分析型の動画が好まれる

### **4. コンテンツへの期待**
- 論理的で深い考察
- 信頼できるソースと証拠の提示
- 落ち着いたナレーションと解説
- 視聴者の知的好奇心を満たす情報提供
- 家族や友人との会話のネタになる話題性
- 適度な長さ（6-15分程度）の動画構成

# 出力フォーマット
予言・都市伝説まとめ

1. 予言者・情報源のプロフィールと特徴
・名前：〇〇（例：ブランドン・ビッグス、ノストラダムス、ババ・ヴァンガ など）
・出身：〇〇（国・地域）
・職業・肩書：〇〇（例：牧師、占星術師、未来学者 など）
・活動：〇〇（例：YouTube、著作、講演活動 など）
・特徴：〇〇（例：神からのビジョン、霊的啓示、AIを用いた未来予測 など）
・実績：〇〇（例：過去の予言的中事例）

2. 主要な予言・都市伝説
1) 〇〇年の大規模災害
・時期：○月○日前後
・場所：〇〇（具体的な地域名）
・内容：
　・〇〇（地震・津波・火山噴火など）
　・〇〇（都市の被害状況）
　・〇〇（他国への影響）

2) テロ・攻撃関連
・内容：
　・〇〇（テロ・襲撃の手口）
　・〇〇（影響を受ける都市・施設）
　・〇〇（具体的な攻撃対象）

3) パンデミック・健康危機
・内容：
　・〇〇（感染症の種類・特徴）
　・〇〇（感染規模・被害予測）

4) 経済・社会的影響
・内容：
　・〇〇（仮想通貨・金融市場の変動）
　・〇〇（社会混乱・停電など）
　・〇〇（戦争の可能性）

5) 日本への影響
・内容：
　・〇〇（自然災害）
　・〇〇（経済・政治的な変化）

3. 予言・都市伝説の特徴
・具体的な日時や場所を示す傾向
・霊的・神秘的な要素の有無
・科学的な裏付けの状況
・過去の予言的中の記録
・警告としての性質
・予防や備えに関する提言

4. 詳細の解説
（具体的な解説を記載）`;

// 利用可能なAIモデル
const AI_MODELS = [
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: '高速で経済的' },
  { id: 'gpt-4', name: 'GPT-4', description: '高精度で詳細な分析が可能' },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: '最新のGPT-4モデル' },
] as const;

// プロンプトの型定義
interface SavedPrompt {
  id: string;
  name: string;
  content: string;
}

// YouTube URLから動画IDを抽出する関数
function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?/]+)/,
    /youtube\.com\/shorts\/([^&?/]+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

export default function Home() {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [transcriptText, setTranscriptText] = useState('');
  const [summary, setSummary] = useState('');
  const [blog, setBlog] = useState('');
  const [script, setScript] = useState('');
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [isPromptVisible, setIsPromptVisible] = useState(false);
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([]);
  const [promptName, setPromptName] = useState('');
  const [selectedModel, setSelectedModel] = useState<typeof AI_MODELS[number]['id']>('gpt-3.5-turbo');
  const [activeTab, setActiveTab] = useState<'x' | 'blog' | 'script'>('x');

  // 保存されたプロンプトを読み込む
  useEffect(() => {
    const saved = localStorage.getItem('savedPrompts');
    if (saved) {
      setSavedPrompts(JSON.parse(saved));
    }
  }, []);

  // プロンプトを保存
  const handleSavePrompt = () => {
    if (!promptName.trim() || !prompt.trim()) {
      setError('プロンプト名と内容を入力してください。');
      return;
    }

    const newPrompt: SavedPrompt = {
      id: Date.now().toString(),
      name: promptName.trim(),
      content: prompt.trim(),
    };

    const updatedPrompts = [...savedPrompts, newPrompt];
    setSavedPrompts(updatedPrompts);
    localStorage.setItem('savedPrompts', JSON.stringify(updatedPrompts));
    setPromptName('');
    setError('');
  };

  // プロンプトを削除
  const handleDeletePrompt = (id: string) => {
    const updatedPrompts = savedPrompts.filter(p => p.id !== id);
    setSavedPrompts(updatedPrompts);
    localStorage.setItem('savedPrompts', JSON.stringify(updatedPrompts));
  };

  // プロンプトを選択
  const handleSelectPrompt = (content: string) => {
    setPrompt(content);
  };

  const handleSubmit = async () => {
    // すべての状態を初期化
    const resetState = () => {
      setError('');
      setIsLoading(true);
      setTranscriptText('');
      setSummary('');
      setBlog('');
      setScript('');
    };

    try {
      resetState();
      
      const videoId = extractVideoId(url);
      if (!videoId) {
        throw new Error('有効なYouTube URLを入力してください。');
      }

      const response = await fetch(`/api/transcript?videoId=${videoId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '字幕の取得に失敗しました。');
      }

      const text = await response.text();
      setTranscriptText(text);

      // タブに応じて適切なAPIを呼び出す
      if (activeTab === 'x') {
        const summaryResponse = await fetch('/api/summarize', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text, prompt, model: selectedModel }),
        });

        if (!summaryResponse.ok) {
          throw new Error('要約の生成に失敗しました。');
        }

        const { summary } = await summaryResponse.json();
        setSummary(summary);
      } else if (activeTab === 'blog') {
        const blogResponse = await fetch('/api/blog', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text, prompt, model: selectedModel }),
        });

        if (!blogResponse.ok) {
          throw new Error('ブログ記事の生成に失敗しました。');
        }

        const { blog } = await blogResponse.json();
        setBlog(blog);
      } else {
        const scriptResponse = await fetch('/api/script', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text, prompt, model: selectedModel }),
        });

        if (!scriptResponse.ok) {
          const errorData = await scriptResponse.json();
          throw new Error(errorData.error || '動画台本の生成に失敗しました。');
        }

        const { script } = await scriptResponse.json();
        setScript(script);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : '予期せぬエラーが発生しました。');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">YouTube字幕取得・要約</h1>
          <p className="mt-1 text-sm text-gray-600">YouTubeの動画内容をAIが要約し、X用の投稿文やブログ記事を生成します</p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* タブ切り替え */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">生成モードを選択</h2>
          <div className="grid grid-cols-3 gap-4">
            <button
              onClick={() => {
                setActiveTab('x');
                setPrompt(DEFAULT_PROMPT);
              }}
              className={`p-4 rounded-lg font-medium transition-colors ${
                activeTab === 'x'
                  ? 'bg-yellow-500 text-white ring-2 ring-yellow-500 ring-offset-2'
                  : 'bg-gray-100 text-gray-700 hover:bg-yellow-100'
              }`}
            >
              <div className="flex flex-col items-center space-y-2">
                <span className="text-xl">𝕏</span>
                <span>X用投稿文を生成</span>
                {activeTab === 'x' && (
                  <span className="text-sm">現在選択中</span>
                )}
              </div>
            </button>
            <button
              onClick={() => {
                setActiveTab('blog');
                setPrompt('');
              }}
              className={`p-4 rounded-lg font-medium transition-colors ${
                activeTab === 'blog'
                  ? 'bg-yellow-500 text-white ring-2 ring-yellow-500 ring-offset-2'
                  : 'bg-gray-100 text-gray-700 hover:bg-yellow-100'
              }`}
            >
              <div className="flex flex-col items-center space-y-2">
                <span className="text-xl">📝</span>
                <span>ブログ記事を生成</span>
                {activeTab === 'blog' && (
                  <span className="text-sm">現在選択中</span>
                )}
              </div>
            </button>
            <button
              onClick={() => {
                setActiveTab('script');
                setPrompt(SCRIPT_PROMPT);
              }}
              className={`p-4 rounded-lg font-medium transition-colors ${
                activeTab === 'script'
                  ? 'bg-yellow-500 text-white ring-2 ring-yellow-500 ring-offset-2'
                  : 'bg-gray-100 text-gray-700 hover:bg-yellow-100'
              }`}
            >
              <div className="flex flex-col items-center space-y-2">
                <span className="text-xl">🎬</span>
                <span>動画台本を生成</span>
                {activeTab === 'script' && (
                  <span className="text-sm">現在選択中</span>
                )}
              </div>
            </button>
          </div>
        </div>

        {/* URL入力セクション */}
        <section className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">1. 動画URLを入力</h2>
            <span className="text-sm px-3 py-1 bg-blue-100 text-blue-800 rounded-full">
              {activeTab === 'x' ? 'X用投稿文モード' : activeTab === 'blog' ? 'ブログ記事モード' : '動画台本モード'}
            </span>
          </div>
          <div className="space-y-4">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="YouTube URL（例：https://www.youtube.com/watch?v=xxxx）"
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <div className="text-sm text-gray-500">
              <p className="font-medium mb-1">対応フォーマット：</p>
              <ul className="list-disc list-inside space-y-1">
                <li>通常の動画: youtube.com/watch?v=xxxx</li>
                <li>短縮URL: youtu.be/xxxx</li>
                <li>ショート: youtube.com/shorts/xxxx</li>
              </ul>
            </div>
          </div>
        </section>

        {/* AIモデル選択セクション */}
        <section className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">2. AIモデルを選択</h2>
          <div className="grid gap-3">
            {AI_MODELS.map((model) => (
              <label
                key={model.id}
                className={`flex items-center p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedModel === model.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-200'
                }`}
              >
                <input
                  type="radio"
                  name="ai-model"
                  value={model.id}
                  checked={selectedModel === model.id}
                  onChange={(e) => setSelectedModel(e.target.value as typeof selectedModel)}
                  className="w-4 h-4 text-blue-500"
                />
                <div className="ml-3">
                  <div className="font-medium text-gray-900">{model.name}</div>
                  <div className="text-sm text-gray-500">{model.description}</div>
                </div>
              </label>
            ))}
          </div>
        </section>

        {/* プロンプト設定セクション */}
        <section className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">3. プロンプト設定</h2>
            <button
              onClick={() => setIsPromptVisible(!isPromptVisible)}
              className="text-blue-500 hover:text-blue-700 text-sm font-medium"
            >
              {isPromptVisible ? '設定を隠す ▼' : '設定を表示 ▶'}
            </button>
          </div>

          {isPromptVisible && (
            <div className="space-y-6">
              {/* 保存済みプロンプト */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">保存したプロンプト</h3>
                <div className="space-y-2">
                  {activeTab === 'x' && (
                    <>
                      <button
                        onClick={() => handleSelectPrompt(DEFAULT_PROMPT)}
                        className="text-sm text-blue-500 hover:text-blue-700 font-medium"
                      >
                        デフォルトに戻す
                      </button>
                      <button
                        onClick={() => handleSelectPrompt(HIROSHI_STYLE_PROMPT)}
                        className="text-sm text-blue-500 hover:text-blue-700 font-medium ml-4"
                      >
                        ひろし式
                      </button>
                    </>
                  )}
                  {savedPrompts.map((savedPrompt) => (
                    <div
                      key={savedPrompt.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-gray-50 hover:bg-gray-100"
                    >
                      <button
                        onClick={() => handleSelectPrompt(savedPrompt.content)}
                        className="text-left flex-1"
                      >
                        {savedPrompt.name}
                      </button>
                      <button
                        onClick={() => handleDeletePrompt(savedPrompt.id)}
                        className="ml-2 text-red-500 hover:text-red-700"
                      >
                        削除
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* 新規プロンプト保存 */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  {activeTab === 'x' ? 'X用投稿文のプロンプト' : 
                   activeTab === 'blog' ? 'ブログ記事のプロンプト' : 
                   '動画台本のプロンプト'}
                </h3>
                <input
                  type="text"
                  value={promptName}
                  onChange={(e) => setPromptName(e.target.value)}
                  placeholder="プロンプト名"
                  className="w-full p-3 border rounded-lg mb-3"
                />
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={`${
                    activeTab === 'x' ? 'X用投稿文の生成指示を入力' :
                    activeTab === 'blog' ? 'ブログ記事の生成指示を入力' :
                    '動画台本の生成指示を入力'
                  }`}
                  className="w-full p-3 border rounded-lg h-32 mb-3"
                />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500">
                    ※ プロンプトは{
                      activeTab === 'x' ? 'X用投稿文' :
                      activeTab === 'blog' ? 'ブログ記事' :
                      '動画台本'
                    }の生成指示として使用されます
                  </p>
                  <button
                    onClick={handleSavePrompt}
                    className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors"
                  >
                    保存
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* 実行ボタン */}
        <section className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">4. 要約を生成</h2>
            <span className="text-sm px-3 py-1 bg-blue-100 text-blue-800 rounded-full">
              {activeTab === 'x' ? 'X用投稿文モード' : activeTab === 'blog' ? 'ブログ記事モード' : '動画台本モード'}
            </span>
          </div>
          <button
            onClick={handleSubmit}
            disabled={isLoading || !url.trim()}
            className={`w-full py-4 rounded-lg font-medium transition-colors ${
              isLoading || !url.trim()
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            {isLoading ? '生成中...' : `字幕を取得して${activeTab === 'x' ? 'X用投稿文' : activeTab === 'blog' ? 'ブログ記事' : '動画台本'}を生成`}
          </button>
          {error && (
            <p className="mt-3 text-red-500 text-sm">{error}</p>
          )}
        </section>

        {/* 結果表示 */}
        {activeTab === 'x' && summary && (
          <section className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">要約結果（X用）</h2>
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <p className="whitespace-pre-wrap text-gray-900">{summary}</p>
              <p className="text-gray-500 mt-2 text-sm">{url}</p>
            </div>
            <button
              onClick={() => {
                const text = `${summary}\n\n${url}`;
                navigator.clipboard.writeText(text);
              }}
              className="w-full bg-gray-900 text-white py-3 rounded-lg hover:bg-gray-800 transition-colors"
            >
              クリップボードにコピー
            </button>
          </section>
        )}

        {activeTab === 'blog' && blog && (
          <section className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">ブログ記事</h2>
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="prose prose-sm max-w-none">
                <div className="whitespace-pre-wrap text-gray-900" dangerouslySetInnerHTML={{ __html: blog }} />
              </div>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(blog);
              }}
              className="w-full bg-gray-900 text-white py-3 rounded-lg hover:bg-gray-800 transition-colors"
            >
              クリップボードにコピー
            </button>
          </section>
        )}

        {activeTab === 'script' && script && (
          <section className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">動画台本</h2>
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="prose prose-sm max-w-none">
                <div className="whitespace-pre-wrap text-gray-900" dangerouslySetInnerHTML={{ __html: script }} />
              </div>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(script);
              }}
              className="w-full bg-gray-900 text-white py-3 rounded-lg hover:bg-gray-800 transition-colors"
            >
              クリップボードにコピー
            </button>
          </section>
        )}

        {transcriptText && (
          <section className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">元の字幕</h2>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="whitespace-pre-wrap text-sm text-gray-600">{transcriptText}</p>
            </div>
          </section>
        )}
      </main>
    </div>
  );
} 