<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>zxing throughput</title>
    <style>
        body { margin: 0; min-height: 100vh; display: flex; flex-direction: column; justify-content: flex-end; background: #000; color: #fff; font: 16px -apple-system, system-ui, sans-serif; padding: env(safe-area-inset-top) 16px calc(env(safe-area-inset-bottom) + 24px); box-sizing: border-box; }
        .result { text-align: center; margin-bottom: 24px; }
        .count { font-size: 96px; font-weight: 800; color: #4ade80; text-shadow: 0 0 8px #000; line-height: 1; }
        .meta { color: #9ca3af; font-size: 13px; margin-top: 8px; }
        button { width: 100%; border: 0; border-radius: 12px; padding: 14px; font-size: 16px; font-weight: 600; background: #fff; color: #000; }
    </style>
</head>
<body>
    <div class="result">
        @if ($lastRun)
            <div class="count">{{ $lastRun['count'] }}</div>
            <div>{{ number_format($lastRun['elapsedMs'] / 1000, 1) }}s</div>
        @else
            <div class="count">0</div>
        @endif
        <div class="meta">{{ $server }}</div>
    </div>
    <form method="post" action="/start">
        @csrf
        <button type="submit">Start {{ $target }} QRs (zxing)</button>
    </form>
</body>
</html>
