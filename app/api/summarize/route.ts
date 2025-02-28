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
    const { text, prompt, model = 'gpt-3.5-turbo' } = await req.json();

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

    const systemPrompt = `あなたはYouTube動画の内容をX（旧Twitter）用の投稿文に変換する専門家です。
以下の制約を必ず守ってください：

1. 必ず日本語で書く
2. 本文は"---"の前に記述
3. ハッシュタグは"---"の後に記述
4. 本文は200文字以内

例：
すごく面白い動画でした！ためになる情報がたくさん詰まっています。ぜひチャンネル登録して、次回もお見逃しなく！

---

#YouTube #動画 #まとめ`;

    let response = '';

    // OpenAI APIの使用
    if (model.startsWith('gpt')) {
      console.log("OpenAI API リクエスト送信...");
      const completion = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: text
          }
        ],
        max_tokens: 1000,
        temperature: 0.7,
      });

      console.log("OpenAI API レスポンス受信:", completion);
      response = completion.choices[0].message.content || '';
      console.log("OpenAI API レスポンステキスト:", response);
      
      if (!response) {
        throw new Error("OpenAI APIからの応答が空です。");
      }
    }
    // Gemini APIの使用
    else if (model === 'gemini-pro') {
      console.log("Gemini API リクエスト送信...");
      const geminiModel = googleAI.getGenerativeModel({ model: 'gemini-pro' });
      
      const geminiPrompt = `${systemPrompt}\n\n以下のYoutube動画の内容をX用投稿文に変換してください：\n\n${text}`;
      
      const result = await geminiModel.generateContent(geminiPrompt);
      response = result.response.text();
      console.log("Gemini API レスポンス:", response);
      
      if (!response) {
        throw new Error("Gemini APIからの応答が空です。");
      }
    }
    // Claude APIの使用
    else if (model.startsWith('claude')) {
      console.log("Claude API リクエスト送信...");
      
      // モデル名をマッピング
      const claudeModelMap: Record<string, string> = {
        'claude-3-opus': 'claude-3-opus-20240229',
        'claude-3-sonnet': 'claude-3-sonnet-20240229'
      };
      
      const actualModel = claudeModelMap[model] || model;
      
      const claudeResponse = await anthropic.messages.create({
        model: actualModel,
        max_tokens: 1000,
        system: systemPrompt,
        messages: [
          {
            role: "user", 
            content: `以下のYoutube動画の内容をX用投稿文に変換してください。必ず日本語で出力し、本文と"---"のあとにハッシュタグを記載してください：\n\n${text}`
          }
        ],
        temperature: 0.7,
      });
      
      // content[0].textをcontentとして取得するように修正
      const content = claudeResponse.content[0];
      if (content.type === 'text') {
        response = content.text;
      } else {
        response = '';
      }
      console.log("Claude API レスポンス:", response);
      
      if (!response) {
        throw new Error("Claude APIからの応答が空です。");
      }
    }

    // 要約本文とハッシュタグを分離
    let summaryText = '';
    let hashtagText = '#YouTube #動画 #まとめ';
    
    if (response.includes('---')) {
      const parts = response.split('---').map(text => text.trim());
      
      // 先頭が空の場合（ハイフンから始まる場合）
      if (parts[0] === '' && parts.length > 1) {
        // "---" の後のテキストが本文とハッシュタグを含む
        const afterHyphen = parts[1];
        
        // ハッシュタグを検出して分離
        const hashtagMatch = afterHyphen.match(/(#\S+\s*)+$/);
        if (hashtagMatch) {
          hashtagText = hashtagMatch[0].trim();
          summaryText = afterHyphen.substring(0, hashtagMatch.index).trim();
        } else {
          summaryText = afterHyphen;
        }
      } else {
        // 通常のケース："---"の前が本文、後がハッシュタグ
        summaryText = parts[0];
        if (parts.length > 1) {
          hashtagText = parts[1];
        }
      }
    } else {
      // "---" がない場合は全文を本文として扱う
      summaryText = response.trim();
    }
    
    console.log("分離後のテキスト:", { summaryText, hashtagText });
    
    // summaryTextが空の場合はレスポンス全体を使用
    if (!summaryText) {
      summaryText = response.replace(/^---\s*/, '').trim();
      console.log("summaryTextが空のため、レスポンス全体を使用:", summaryText);
    }

    // 句点の重複を防ぐ
    const cleanedSummaryText = summaryText.replace(/。+/g, '。');

    // 文字数制限のチェック（280文字を上限とする）
    const MAX_LENGTH = 280;
    const NEWLINE_LENGTH = 2; // \n\n の長さ

    // ハッシュタグを含めた全体の長さをチェック
    const totalLength = cleanedSummaryText.length + NEWLINE_LENGTH + hashtagText.length;

    let finalSummary = '';
    if (totalLength > MAX_LENGTH) {
      // ハッシュタグ部分を確保した上で、要約本文を切り詰める
      const maxSummaryLength = MAX_LENGTH - NEWLINE_LENGTH - hashtagText.length - 3; // "..." の長さを考慮
      const truncatedSummary = cleanedSummaryText.slice(0, maxSummaryLength) + "...";
      finalSummary = `${truncatedSummary}\n\n${hashtagText}`;
    } else {
      finalSummary = `${cleanedSummaryText}\n\n${hashtagText}`;
    }

    console.log("最終的な要約:", finalSummary);
    return NextResponse.json({ summary: finalSummary });

  } catch (error) {
    console.error("要約エラー:", error);
    let errorMessage = "テキストの要約に失敗しました。";
    
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