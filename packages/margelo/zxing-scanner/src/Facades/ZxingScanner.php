<?php

namespace Margelo\ZxingScanner\Facades;

use Illuminate\Support\Facades\Facade;

/**
 * @method static void start(int $target = 1000)
 * @method static void confirm()
 * @method static void stop()
 */
class ZxingScanner extends Facade
{
    protected static function getFacadeAccessor(): string
    {
        return \Margelo\ZxingScanner\ZxingScanner::class;
    }
}
