# ZxingScanner Plugin for NativePHP Mobile

A NativePHP Mobile plugin

## Installation

```bash
composer require margelo/zxing-scanner
```

## Usage

```php
use Margelo\ZxingScanner\Facades\ZxingScanner;

// Open the camera before starting the timed run. On Android every decoded frame
// fires CodeScanned; PHP owns dedupe, network reporting, counting and timing.
ZxingScanner::start(1000);
ZxingScanner::update(count: 42, elapsedMs: 5800, phase: 'running');

ZxingScanner::stop();
```

The included benchmark starts the clock immediately after PHP's `/reset` request
succeeds, matching the React Native throughput screen.

## Listening for Events

```php
use Margelo\ZxingScanner\Events\CodeScanned;
use Margelo\ZxingScanner\Events\StartRequested;

class RunBenchmark
{
    public function start(StartRequested $event): void
    {
        // PHP resets the QR server and starts the clock.
    }

    public function scan(CodeScanned $event): void
    {
        // PHP dedupes and POSTs $event->data to /scan.
    }
}
```

## License

MIT
