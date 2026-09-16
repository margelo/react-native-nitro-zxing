<?php

namespace App\Listeners;

use Illuminate\Support\Facades\Cache;
use Margelo\ZxingScanner\Events\RunCompleted;

class RecordRun
{
    public function handle(RunCompleted $event): void
    {
        Cache::forever('last_run', [
            'count' => $event->count,
            'elapsedMs' => $event->elapsedMs,
            'at' => now()->toDateTimeString(),
        ]);
    }
}
