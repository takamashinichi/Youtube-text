import { NextRequest, NextResponse } from "next/server";
import { YoutubeTranscript } from "youtube-transcript";
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';

// OpenAIのAPIキーが設定されている場合のみインスタンスを作成
let openai: OpenAI | null = null;
try {
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim() !== '') {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    console.log("OpenAI初期化成功");
  } else {
    console.log("OpenAI APIキーが設定されていないか空です");
  }
} catch (error) {
  console.error("OpenAI初期化エラー:", error);
}

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
  'claude-3-opus',
  'claude-3-sonnet'
];

// テキストを日本語に翻訳する関数
async function translateToJapanese(text: string, model: string = 'claude-3-sonnet'): Promise<string> {
  try {
    console.log(`${model}を使用して翻訳を開始...`);
    
    const systemPrompt = `あなたは高性能な翻訳AIです。与えられたテキストを自然で流暢な日本語に翻訳してください。
以下の点に注意してください：
1. 原文の意味を正確に保持すること
2. 自然で読みやすい日本語にすること
3. 専門用語は適切に翻訳すること
4. 文化的な文脈を考慮すること
5. 必ず日本語のみで出力すること`;

    let translatedText = '';

    // OpenAI APIの使用
    if (model.startsWith('gpt') && openai) {
      console.log("OpenAI API 翻訳リクエスト送信...");
      const completion = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: `以下のテキストを日本語に翻訳してください：\n\n${text}`
          }
        ],
        max_tokens: 4000,
        temperature: 0.3,
      });

      translatedText = completion.choices[0].message.content || '';
      
      if (!translatedText) {
        throw new Error("OpenAI APIからの翻訳応答が空です。");
      }
    }
    // Gemini APIの使用
    else if (model === 'gemini-pro') {
      console.log("Gemini API 翻訳リクエスト送信...");
      
      const geminiModel = googleAI.getGenerativeModel({ model: 'gemini-pro' });
      
      const geminiPrompt = `${systemPrompt}\n\n以下のテキストを日本語に翻訳してください：\n\n${text}`;
      
      const result = await geminiModel.generateContent(geminiPrompt);
      translatedText = result.response.text();
      
      if (!translatedText) {
        throw new Error("Gemini APIからの翻訳応答が空です。");
      }
    }
    // Claude APIの使用
    else if (model.startsWith('claude')) {
      console.log("Claude API 翻訳リクエスト送信...");
      
      // モデル名をマッピング
      const claudeModelMap: Record<string, string> = {
        'claude-3-opus': 'claude-3-opus-20240229',
        'claude-3-sonnet': 'claude-3-sonnet-20240229'
      };
      
      const actualModel = claudeModelMap[model] || model;
      
      const claudeResponse = await anthropic.messages.create({
        model: actualModel,
        max_tokens: 4000,
        system: systemPrompt,
        messages: [
          {
            role: "user", 
            content: `以下のテキストを日本語に翻訳してください。必ず日本語のみで出力し、絶対に英語や他の言語を使わないでください：\n\n${text}`
          }
        ],
        temperature: 0.3,
      });
      
      const content = claudeResponse.content[0];
      if (content.type === 'text') {
        translatedText = content.text;
      } else {
        translatedText = '';
      }
      
      if (!translatedText) {
        throw new Error("Claude APIからの翻訳応答が空です。");
      }
    } else {
      throw new Error("サポートされていないモデルが指定されました。");
    }

    console.log("翻訳完了");
    return translatedText;
  } catch (error) {
    console.error("翻訳エラー:", error);
    throw new Error(`翻訳に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const videoId = searchParams.get("videoId");
    const translateToJp = searchParams.get("translate") === "true";
    const model = searchParams.get("model") || "claude-3-sonnet";

    if (!videoId) {
      return NextResponse.json(
        { error: "動画IDが指定されていません。" },
        { status: 400 }
      );
    }

    if (!videoId.match(/^[a-zA-Z0-9_-]{11}$/)) {
      return NextResponse.json(
        { error: "無効な動画IDです。" },
        { status: 400 }
      );
    }

    if (translateToJp && !ALLOWED_MODELS.includes(model)) {
      return NextResponse.json(
        { error: "無効なAIモデルが指定されました。" },
        { status: 400 }
      );
    }

    // 字幕を取得
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);

    if (!transcript || transcript.length === 0) {
      return NextResponse.json(
        { error: "字幕が見つかりませんでした。" },
        { status: 404 }
      );
    }

    // 字幕のテキストのみを抽出
    const transcriptText = transcript
      .map(entry => entry.text.trim())
      .filter(text => text.length > 0)
      .join("\n");

    // 翻訳が要求された場合
    let finalText = transcriptText;
    if (translateToJp) {
      try {
        finalText = await translateToJapanese(transcriptText, model);
      } catch (error) {
        console.error("翻訳エラー:", error);
        return NextResponse.json(
          { error: "字幕の翻訳に失敗しました。" },
          { status: 500 }
        );
      }
    }

    const filename = encodeURIComponent(`transcript_${videoId}${translateToJp ? '_jp' : ''}.txt`);

    return new NextResponse(finalText, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });

  } catch (error) {
    console.error("字幕取得エラー:", error);
    
    // YoutubeTranscriptのエラーをより詳細に処理
    if (error instanceof Error) {
      if (error.message.includes("No transcript found")) {
        return NextResponse.json(
          { error: "この動画には字幕がありません。" },
          { status: 404 }
        );
      }
      if (error.message.includes("Video unavailable")) {
        return NextResponse.json(
          { error: "動画が見つかりません。" },
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      { error: "字幕の取得に失敗しました。" },
      { status: 500 }
    );
  }
} 