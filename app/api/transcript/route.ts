import { NextRequest, NextResponse } from "next/server";
import { YoutubeTranscript } from "youtube-transcript";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const videoId = searchParams.get("videoId");

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

    const filename = encodeURIComponent(`transcript_${videoId}.txt`);

    return new NextResponse(transcriptText, {
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