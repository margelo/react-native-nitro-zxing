<?php

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Route;
use Margelo\ZxingScanner\Facades\ZxingScanner;

const TARGET = 1000;

Route::get('/', function () {
    return view('throughput', [
        'server' => config('services.qr_server.url'),
        'target' => TARGET,
        'lastRun' => Cache::get('last_run'),
    ]);
});

Route::post('/start', function () {
    Http::timeout(2)->post(config('services.qr_server.url').'/reset');
    Cache::forget('last_run');
    ZxingScanner::start(TARGET);

    return redirect('/');
});
