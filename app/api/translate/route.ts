import { NextRequest, NextResponse } from "next/server";
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';
import { ALLOWED_MODELS, getActualModelName } from '../../utils/ai-models';

// レート制限のためのシンプルなメモリキャッシュ（本番環境ではRedisなどを使用）
const rateLimitCache = new Map<string, { count: number, timestamp: number }>();
const RATE_LIMIT = 10; // 1分間あたりのリクエスト数
const RATE_LIMIT_WINDOW = 60 * 1000; // 1分（ミリ秒）

// レート制限をチェックする関数
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitCache.get(ip);
  
  if (!record) {
    rateLimitCache.set(ip, { count: 1, timestamp: now });
    return true;
  }
  
  if (now - record.timestamp > RATE_LIMIT_WINDOW) {
    // ウィンドウをリセット
    rateLimitCache.set(ip, { count: 1, timestamp: now });
    return true;
  }
  
  if (record.count >= RATE_LIMIT) {
    return false; // レート制限超過
  }
  
  // カウントを増やす
  record.count += 1;
  rateLimitCache.set(ip, record);
  return true;
}

// テキストを日本語に翻訳する関数
async function translateToJapanese(text: string, model: string): Promise<string> {
  try {
    console.log(`[${new Date().toISOString()}] 翻訳処理開始 - モデル: ${model}`);
    
    // OpenAI APIの使用
    if (model.startsWith('gpt')) {
      console.log(`[${new Date().toISOString()}] OpenAI API 翻訳リクエスト開始`);
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      
      const completion = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: "system",
            content: "あなたは翻訳の専門家です。与えられたテキストを日本語に翻訳してください。元のテキストが日本語の場合はそのまま返してください。"
          },
          {
            role: "user",
            content: text
          }
        ],
        max_tokens: 4000,
        temperature: 0.3,
      });

      const translatedText = completion.choices[0].message.content || '';
      console.log(`[${new Date().toISOString()}] OpenAI API 翻訳レスポンス受信 - 文字数: ${translatedText.length}`);
      
      console.log(translatedText);

      if (!translatedText) {
        console.error(`[${new Date().toISOString()}] OpenAI API 翻訳エラー - 空のレスポンス`);
        throw new Error("OpenAI APIからの応答が空です。");
      }
      
      return translatedText;
    }
    // Gemini APIの使用
    else if (model === 'gemini-1.5-pro') {
      try {
        console.log(`[${new Date().toISOString()}] Gemini API 翻訳リクエスト開始`);
        const googleAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
        const actualModel = getActualModelName(model);
        const geminiModel = googleAI.getGenerativeModel({ 
          model: actualModel 
        }, { 
          apiVersion: 'v1beta' 
        });
        
        const geminiPrompt = `あなたは翻訳の専門家です。以下のテキストを日本語に翻訳してください。元のテキストが日本語の場合はそのまま返してください。\n\n${text}`;
        
        const result = await geminiModel.generateContent(geminiPrompt);
        const translatedText = result.response.text();
        console.log(`[${new Date().toISOString()}] Gemini API 翻訳レスポンス受信 - 文字数: ${translatedText.length}`);
        
        if (!translatedText) {
          console.error(`[${new Date().toISOString()}] Gemini API 翻訳エラー - 空のレスポンス`);
          throw new Error("Gemini APIからの応答が空です。");
        }
        
        return translatedText;
      } catch (error) {
        const geminiError = error as Error;
        console.error(`[${new Date().toISOString()}] Gemini API 翻訳エラー: ${geminiError.message}`);
        throw new Error(`Gemini API エラー: ${geminiError.message}`);
      }
    }
    // Claude APIの使用
    else if (model.startsWith('claude')) {
      const actualModel = getActualModelName(model);
      console.log(`[${new Date().toISOString()}] Claude API 翻訳リクエスト開始 - モデル: ${actualModel}`);
      
      const anthropic = new Anthropic({
        apiKey: process.env.CLAUDE_API_KEY || '',
      });
      
      const claudeResponse = await anthropic.messages.create({
        model: actualModel,
        max_tokens: 4000,
        system: "あなたは翻訳の専門家です。与えられたテキストを日本語に翻訳してください。元のテキストが日本語の場合はそのまま返してください。",
        messages: [
          {
            role: "user", 
            content: text
          }
        ],
        temperature: 0.3,
      });
      
      // content[0].textをcontentとして取得するように修正
      const content = claudeResponse.content[0];
      let translatedText = '';
      
      if (content.type === 'text') {
        translatedText = content.text;
        console.log(`[${new Date().toISOString()}] Claude API 翻訳レスポンス受信 - 文字数: ${translatedText.length}`);
      } else {
        console.error(`[${new Date().toISOString()}] Claude API 翻訳エラー - テキスト以外のコンテンツタイプ: ${content.type}`);
        throw new Error("Claude APIからテキスト以外の応答を受け取りました。");
      }
      
      if (!translatedText) {
        console.error(`[${new Date().toISOString()}] Claude API 翻訳エラー - 空のレスポンス`);
        throw new Error("Claude APIからの応答が空です。");
      }
      
      return translatedText;
    }
    
    throw new Error("サポートされていないモデルです。");
  } catch (error) {
    console.error(`[${new Date().toISOString()}] 翻訳処理エラー:`, error);
    throw error; // 上位の関数でエラーハンドリングするために再スロー
  }
}

export async function POST(req: NextRequest) {
  try {
    // リクエスト情報をログに記録
    const clientIp = req.headers.get('x-forwarded-for') || 'unknown';
    console.log(`[${new Date().toISOString()}] 翻訳API リクエスト受信 - IP: ${clientIp}`);
    
    // レート制限の実装
    if (!checkRateLimit(clientIp)) {
      console.warn(`[${new Date().toISOString()}] レート制限超過 - IP: ${clientIp}`);
      return NextResponse.json(
        { error: "リクエスト数の上限に達しました。しばらく待ってから再試行してください。" },
        { status: 429 }
      );
    }

    const { text, model = 'claude-3-haiku-20240307' } = await req.json();
    console.log(`[${new Date().toISOString()}] 翻訳リクエスト - モデル: ${model}, テキスト長: ${text?.length || 0}文字`);

    if (!text) {
      console.warn(`[${new Date().toISOString()}] 翻訳エラー - テキストが指定されていません`);
      return NextResponse.json(
        { error: "テキストが指定されていません。" },
        { status: 400 }
      );
    }

    // 入力テキストの長さ制限
    const MAX_INPUT_LENGTH = 50000; // 約50,000文字まで
    if (text.length > MAX_INPUT_LENGTH) {
      console.warn(`[${new Date().toISOString()}] 翻訳エラー - テキストが長すぎます (${text.length}文字)`);
      return NextResponse.json(
        { error: "テキストが長すぎます。50,000文字以内にしてください。" },
        { status: 400 }
      );
    }

    if (!ALLOWED_MODELS.includes(model)) {
      console.warn(`[${new Date().toISOString()}] 翻訳エラー - 無効なモデル: ${model}`);
      return NextResponse.json(
        { error: "無効なAIモデルが指定されました。" },
        { status: 400 }
      );
    }

    const translatedText = await translateToJapanese(text, model);
    console.log(`[${new Date().toISOString()}] 翻訳API 成功レスポンス - 文字数: ${translatedText.length}`);
    
    // セキュリティヘッダーを追加
    return NextResponse.json(
      { translatedText },
      { 
        status: 200,
        headers: {
          "Cache-Control": "no-store, max-age=0",
          "X-Content-Type-Options": "nosniff"
        }
      }
    );

  } catch (error) {
    console.error(`[${new Date().toISOString()}] 翻訳API エラー発生:`, error);
    let errorMessage = "テキストの翻訳に失敗しました。";
    
    if (error instanceof Error) {
      errorMessage = error.message;
      console.error(`[${new Date().toISOString()}] エラーメッセージ: ${errorMessage}`);
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
} 