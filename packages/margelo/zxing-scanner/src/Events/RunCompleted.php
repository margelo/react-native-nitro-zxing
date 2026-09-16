<?php

namespace Margelo\ZxingScanner\Events;

use Illuminate\Foundation\Events\Dispatchable;

class RunCompleted
{
    use Dispatchable;

    public function __construct(
        public int $count,
        public float $elapsedMs,
    ) {}
}
