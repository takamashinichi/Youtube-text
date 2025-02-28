import { NextRequest, NextResponse } from "next/server";
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const googleAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY || '',
});

// 利用可能なAIモデル
const ALLOWED_MODELS = [
  'gpt-3.5-turbo', 
  'gpt-4', 
  'gpt-4-turbo',
  'gemini-pro',
  'claude-3-opus-20240229',
  'claude-3-sonnet-20240229',
  'claude-3-opus',  // フロントエンドから送信されるモデル名
  'claude-3-sonnet'  // フロントエンドから送信されるモデル名
];

export async function POST(req: NextRequest) {
  try {
    const { text, prompt, model = 'gpt-4' } = await req.json();

    if (!text) {
      return NextResponse.json(
        { error: "テキストが指定されていません。" },
        { status: 400 }
      );
    }

    if (!ALLOWED_MODELS.includes(model)) {
      return NextResponse.json(
        { error: "無効なAIモデルが指定されました。" },
        { status: 400 }
      );
    }

    // ブログ記事生成用のプロンプト
    const systemPrompt = `${prompt || "あなたはYouTube動画の内容をSEO最適化されたブログ記事に変換する専門家です。"}\n\n以下の制約を必ず守ってください：

1. SEO最適化
   - メインキーワードをタイトル、見出し、導入文に自然に含める
   - 関連キーワードを本文中に適度に散りばめる
   - メタディスクリプション（120-150文字）を記事冒頭に追加
   - 内部リンク用の関連記事提案を記事末尾に追加

2. 記事構成（E-E-A-T重視）
   - タイトル：検索意図に合致し、クリック率を高める魅力的な表現（40文字以内）
   - リード文：記事の価値提案と要点を簡潔に（2-3行）
   - 目次：主要セクションを明示（4-6項目）
   - 本文：
     ・導入（背景・課題提起）
     ・主要セクション（具体例や数値を含む詳細な解説）
     ・実践的なアドバイスや注意点
     ・まとめと次のアクション
   - 専門性と信頼性を示す要素を含める（データ引用、専門家の見解など）

3. 読みやすさと構造化
   - H2、H3見出しで適切に階層化
   - 1セクション2-3段落を目安に区切る
   - 箇条書きやテーブルを効果的に使用
   - 重要なポイントは太字やイタリックで強調
   - 一文は40文字程度を目安に簡潔に
   - 専門用語は分かりやすく説明

4. ユーザー体験向上
   - 実践的な情報や具体例を重視
   - FAQ形式のセクションを含める（よくある疑問に答える）
   - アクションアイテムを明確に示す
   - 参考情報やリソースを提供

出力フォーマット：
---
<!-- メタディスクリプション -->
（120-150文字の魅力的な記事概要）

# タイトル

## この記事のポイント
（リード文：価値提案と要点）

## 目次
1. 見出し1
2. 見出し2
3. 見出し3
（以下、本文）

## まとめ
（重要ポイントの整理と次のアクション）

## よくある質問
Q1: （関連する疑問）
A1: （簡潔な回答）
（2-3問程度）

## 関連キーワード
・キーワード1
・キーワード2
・キーワード3

## 関連記事
・（関連記事タイトル1）
・（関連記事タイトル2）
`;

    let blogContent = '';

    // OpenAI APIの使用
    if (model.startsWith('gpt')) {
      const completion = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: `以下の動画内容からSEO最適化されたブログ記事を生成してください。特に検索意図を意識し、ユーザーが求める情報を網羅的に提供してください：\n\n${text}`
          }
        ],
        max_tokens: 3000,
        temperature: 0.7,
      });

      blogContent = completion.choices[0].message.content?.trim() || '';
    }
    // Gemini APIの使用
    else if (model === 'gemini-pro') {
      const geminiModel = googleAI.getGenerativeModel({ model: 'gemini-pro' });
      
      const geminiPrompt = `${systemPrompt}\n\n以下のYoutube動画の内容からSEO最適化されたブログ記事を生成してください：\n\n${text}`;
      
      const result = await geminiModel.generateContent(geminiPrompt);
      blogContent = result.response.text();
    }
    // Claude APIの使用
    else if (model.startsWith('claude')) {
      // モデル名をマッピング
      const claudeModelMap: Record<string, string> = {
        'claude-3-opus': 'claude-3-opus-20240229',
        'claude-3-sonnet': 'claude-3-sonnet-20240229'
      };
      
      const actualModel = claudeModelMap[model] || model;
      
      const claudeResponse = await anthropic.messages.create({
        model: actualModel,
        max_tokens: 3000,
        system: systemPrompt,
        messages: [
          {
            role: "user", 
            content: `以下のYoutube動画の内容からSEO最適化されたブログ記事を生成してください：\n\n${text}`
          }
        ],
        temperature: 0.7,
      });
      
      const content = claudeResponse.content[0];
      if (content.type === 'text') {
        blogContent = content.text.trim();
      } else {
        blogContent = '';
      }
    }
    
    if (!blogContent) {
      throw new Error("ブログ記事の生成に失敗しました。");
    }

    // 句点の重複を防ぐ
    const cleanedBlogContent = blogContent.replace(/。+/g, '。');

    return NextResponse.json({ 
      blog: cleanedBlogContent
    });

  } catch (error) {
    console.error("ブログ記事生成エラー:", error);
    let errorMessage = "ブログ記事の生成に失敗しました。";
    
    if (error instanceof Error) {
      errorMessage = error.message;
      console.error("エラーの詳細:", {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
} 