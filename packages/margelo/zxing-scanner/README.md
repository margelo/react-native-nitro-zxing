# ZxingScanner Plugin for NativePHP Mobile

A NativePHP Mobile plugin

## Installation

```bash
composer require margelo/zxing-scanner
```

## Usage

```php
use Margelo\ZxingScanner\Facades\ZxingScanner;

// Closed loop, fully native: the scanner POSTs {"value": code} to the report URL
// over one keep-alive connection and counts every reply whose "ok" is true.
// PHP runs once to start the run and once when RunCompleted arrives.
ZxingScanner::start(1000, config('services.qr_server.url').'/scan');

// Or let the app decide what counts: every decode fires CodeScanned, and the
// app confirms the ones it accepts. This costs a PHP request per code.
ZxingScanner::start(1000);
ZxingScanner::confirm();

ZxingScanner::stop();
```

The clock starts on the first confirmed scan, not when the camera opens.

## Listening for Events

```php
use Margelo\ZxingScanner\Events\RunCompleted;

class RecordRun
{
    public function handle(RunCompleted $event): void
    {
        // $event->count, $event->elapsedMs
    }
}
```

## License

MIT