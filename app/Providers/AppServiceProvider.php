<?php

namespace App\Providers;

use App\Services\QrThroughput;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\ServiceProvider;
use Margelo\ZxingScanner\Events\CodeScanned;
use Margelo\ZxingScanner\Events\StartRequested;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(QrThroughput::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Event::listen(StartRequested::class, fn () => app(QrThroughput::class)->start());
        Event::listen(CodeScanned::class, fn (CodeScanned $event) => app(QrThroughput::class)->scan($event->data));
    }
}
