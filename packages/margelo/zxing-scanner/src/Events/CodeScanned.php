<?php

namespace Margelo\ZxingScanner\Events;

use Illuminate\Foundation\Events\Dispatchable;

class CodeScanned
{
    use Dispatchable;

    public function __construct(
        public string $data,
    ) {}
}
