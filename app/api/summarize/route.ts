import { NextRequest, NextResponse } from "next/server";
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';
import { ALLOWED_MODELS, getActualModelName } from '../../utils/ai-models';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const googleAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY || '',
});

// ログレベルの定義
type LogLevel = 'INFO' | 'WARN' | 'ERROR';

// ロガー関数
function logger(level: LogLevel, message: string, requestId?: string, metadata?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  const requestIdStr = requestId ? `[${requestId}]` : '';
  const metadataStr = metadata ? ` ${JSON.stringify(metadata)}` : '';
  
  const logMessage = `[${timestamp}] [${level}]${requestIdStr} ${message}${metadataStr}`;
  
  switch (level) {
    case 'INFO':
      console.log(logMessage);
      break;
    case 'WARN':
      console.warn(logMessage);
      break;
    case 'ERROR':
      console.error(logMessage);
      break;
  }
}

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

export async function POST(req: NextRequest) {
  // リクエストIDを生成（トレーサビリティのため）
  const requestId = uuidv4();
  const clientIp = req.headers.get('x-forwarded-for') || 'unknown';
  
  try {
    // リクエスト情報をログに記録
    logger('INFO', '要約API リクエスト受信', requestId, { ip: clientIp });
    
    // レート制限の実装
    if (!checkRateLimit(clientIp)) {
      logger('WARN', 'レート制限超過', requestId, { ip: clientIp });
      return NextResponse.json(
        { error: "リクエスト数の上限に達しました。しばらく待ってから再試行してください。" },
        { status: 429 }
      );
    }

    const { text, model = 'gpt-3.5-turbo', prompt = '' } = await req.json();
    logger('INFO', '要約リクエスト', requestId, { 
      model, 
      textLength: text?.length || 0,
      hasCustomPrompt: !!prompt
    });

    if (!text) {
      logger('WARN', '要約エラー - テキストが指定されていません', requestId);
      return NextResponse.json(
        { error: "テキストが指定されていません。" },
        { status: 400 }
      );
    }

    // 入力テキストの長さ制限
    const MAX_INPUT_LENGTH = 50000; // 約50,000文字まで
    if (text.length > MAX_INPUT_LENGTH) {
      logger('WARN', '要約エラー - テキストが長すぎます', requestId, { length: text.length });
      return NextResponse.json(
        { error: "テキストが長すぎます。50,000文字以内にしてください。" },
        { status: 400 }
      );
    }

    if (!ALLOWED_MODELS.includes(model)) {
      logger('WARN', '要約エラー - 無効なモデル', requestId, { model });
      return NextResponse.json(
        { error: "無効なAIモデルが指定されました。" },
        { status: 400 }
      );
    }

    // カスタムプロンプトがある場合はそれを使用し、なければデフォルトのプロンプトを使用
    const systemPrompt = prompt || `あなたはYouTube動画の内容をX（旧Twitter）用の投稿文に変換する専門家です。
以下の制約を必ず守ってください：

1. 必ず日本語で出力してください。英語や他の言語は使用しないでください。
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
      logger('INFO', 'OpenAI API リクエスト開始', requestId, { model });
      
      const startTime = Date.now();
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
      const duration = Date.now() - startTime;

      response = completion.choices[0].message.content || '';
      logger('INFO', 'OpenAI API レスポンス受信', requestId, { 
        responseLength: response.length,
        duration: `${duration}ms`
      });
      
      if (!response) {
        logger('ERROR', 'OpenAI API エラー - 空のレスポンス', requestId);
        throw new Error("OpenAI APIからの応答が空です。");
      }
    }
    // Gemini APIの使用
    else if (model === 'gemini-1.5-pro') {
      try {
        logger('INFO', 'Gemini API リクエスト開始', requestId);
        const startTime = Date.now();
        
        const actualModel = getActualModelName(model);
        const geminiModel = googleAI.getGenerativeModel({ 
          model: actualModel 
        }, { 
          apiVersion: 'v1beta' 
        });
        const geminiPrompt = `${systemPrompt}\n\n以下のYoutube動画の内容をX用投稿文に変換してください：\n\n${text}`;
        
        const result = await geminiModel.generateContent(geminiPrompt);
        const duration = Date.now() - startTime;
        
        response = result.response.text();
        logger('INFO', 'Gemini API レスポンス受信', requestId, { 
          responseLength: response.length,
          duration: `${duration}ms`
        });
        
        if (!response) {
          logger('ERROR', 'Gemini API エラー - 空のレスポンス', requestId);
          throw new Error("Gemini APIからの応答が空です。");
        }
      } catch (error) {
        const geminiError = error as Error;
        logger('ERROR', 'Gemini API エラー', requestId, { 
          error: geminiError.message,
          stack: geminiError.stack
        });
        throw new Error(`Gemini API エラー: ${geminiError.message}`);
      }
    }
    // Claude APIの使用
    else if (model.startsWith('claude')) {
      const actualModel = getActualModelName(model);
      logger('INFO', 'Claude API リクエスト開始', requestId, { model: actualModel });
      
      const startTime = Date.now();
      const claudeResponse = await anthropic.messages.create({
        model: actualModel,
        max_tokens: 1000,
        system: systemPrompt,
        messages: [
          {
            role: "user", 
            content: `以下のYoutube動画の内容をX用投稿文に変換してください。必ず日本語のみで出力し、絶対に英語や他の言語を使わないでください。本文と"---"のあとにハッシュタグを記載してください：\n\n${text}`
          }
        ],
        temperature: 0.7,
      });
      const duration = Date.now() - startTime;
      
      // content[0].textをcontentとして取得するように修正
      const content = claudeResponse.content[0];
      if (content.type === 'text') {
        response = content.text;
        logger('INFO', 'Claude API レスポンス受信', requestId, { 
          responseLength: response.length,
          duration: `${duration}ms`
        });
      } else {
        logger('ERROR', 'Claude API エラー - テキスト以外のコンテンツタイプ', requestId, { 
          contentType: content.type 
        });
        response = '';
      }
      
      if (!response) {
        logger('ERROR', 'Claude API エラー - 空のレスポンス', requestId);
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
    
    // summaryTextが空の場合はレスポンス全体を使用
    if (!summaryText) {
      summaryText = response.replace(/^---\s*/, '').trim();
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
      
      logger('INFO', '要約テキストを切り詰めました', requestId, {
        originalLength: totalLength,
        truncatedLength: finalSummary.length
      });
    } else {
      finalSummary = `${cleanedSummaryText}\n\n${hashtagText}`;
    }

    // セキュリティヘッダーを追加
    logger('INFO', '要約API 成功レスポンス', requestId, { 
      summaryLength: finalSummary.length 
    });
    
    return NextResponse.json(
      { summary: finalSummary },
      { 
        status: 200,
        headers: {
          "Cache-Control": "no-store, max-age=0",
          "X-Content-Type-Options": "nosniff",
          "X-Request-ID": requestId
        }
      }
    );

  } catch (error) {
    logger('ERROR', '要約API エラー発生', requestId, { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    
    let errorMessage = "テキストの要約に失敗しました。";
    
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      { error: errorMessage },
      { 
        status: 500,
        headers: {
          "X-Request-ID": requestId
        }
      }
    );
  }
} 
