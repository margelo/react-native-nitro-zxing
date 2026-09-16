<?php

namespace Margelo\ZxingScanner;

use Illuminate\Support\ServiceProvider;
use Margelo\ZxingScanner\Commands\BuildAndroidCommand;
use Margelo\ZxingScanner\Commands\CopyAssetsCommand;

class ZxingScannerServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(ZxingScanner::class, function () {
            return new ZxingScanner();
        });
    }

    public function boot(): void
    {
        // Register plugin hook commands
        if ($this->app->runningInConsole()) {
            $this->commands([
                BuildAndroidCommand::class,
                CopyAssetsCommand::class,
            ]);
        }
    }
}