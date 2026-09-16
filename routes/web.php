<?php

use App\Services\QrThroughput;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('throughput', [
        'server' => config('services.qr_server.url'),
        'target' => QrThroughput::TARGET,
        'lastRun' => Cache::get('last_run'),
    ]);
});

Route::post('/start', function () {
    app(QrThroughput::class)->open();

    return redirect('/');
});
