<?php

namespace App\Listeners;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Margelo\ZxingScanner\Events\CodeScanned;
use Margelo\ZxingScanner\Facades\ZxingScanner;

/**
 * Mirrors the React Native benchmark app: every decoded code is posted to the QR server,
 * and only a scan the server accepts counts.
 */
class RelayScan
{
    public function handle(CodeScanned $event): void
    {
        $response = Http::timeout(2)->post(config('services.qr_server.url').'/scan', [
            'value' => $event->data,
        ]);

        if ($response->json('ok') === true) {
            ZxingScanner::confirm();
        }
    }
}
