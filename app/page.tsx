'use client';

import { useState, useEffect } from 'react';

// デフォルトプロンプト
const DEFAULT_PROMPT = `この動画の内容を以下の点に注目して要約してください：
・メインメッセージ
・重要なポイント
・視聴者へのアクションアイテム

また、動画の内容に応じた適切なハッシュタグを3つ程度提案してください。
専門用語は分かりやすく言い換え、文章は簡潔に完結させてください。`;

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
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [isPromptVisible, setIsPromptVisible] = useState(false);
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([]);
  const [promptName, setPromptName] = useState('');
  const [selectedModel, setSelectedModel] = useState<typeof AI_MODELS[number]['id']>('gpt-3.5-turbo');
  const [activeTab, setActiveTab] = useState<'x' | 'blog'>('x');

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
    setError('');
    setIsLoading(true);
    setTranscriptText('');
    setSummary('');
    setBlog('');

    try {
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
      } else {
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
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setActiveTab('x')}
              className={`p-4 rounded-lg font-medium transition-all ${
                activeTab === 'x'
                  ? 'bg-blue-500 text-white ring-2 ring-blue-500 ring-offset-2'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
              onClick={() => setActiveTab('blog')}
              className={`p-4 rounded-lg font-medium transition-all ${
                activeTab === 'blog'
                  ? 'bg-blue-500 text-white ring-2 ring-blue-500 ring-offset-2'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
          </div>
        </div>

        {/* URL入力セクション */}
        <section className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">1. 動画URLを入力</h2>
            <span className="text-sm px-3 py-1 bg-blue-100 text-blue-800 rounded-full">
              {activeTab === 'x' ? 'X用投稿文モード' : 'ブログ記事モード'}
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
            <h2 className="text-lg font-semibold">3. 要約設定</h2>
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
                  <button
                    onClick={() => handleSelectPrompt(DEFAULT_PROMPT)}
                    className="text-sm text-blue-500 hover:text-blue-700 font-medium"
                  >
                    デフォルトに戻す
                  </button>
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
                <h3 className="text-sm font-medium text-gray-700 mb-2">新しいプロンプトを保存</h3>
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
                  placeholder="要約の指示を入力してください"
                  className="w-full p-3 border rounded-lg h-32 mb-3"
                />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500">
                    ※ プロンプトは要約の指示として使用されます
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
              {activeTab === 'x' ? 'X用投稿文モード' : 'ブログ記事モード'}
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
            {isLoading ? '生成中...' : `字幕を取得して${activeTab === 'x' ? 'X用投稿文' : 'ブログ記事'}を生成`}
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