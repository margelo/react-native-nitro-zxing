# ZxingScanner Plugin for NativePHP Mobile

A NativePHP Mobile plugin

## Installation

```bash
composer require margelo/zxing-scanner
```

## Usage

```php
use Margelo\ZxingScanner\Facades\ZxingScanner;

// Execute functionality
$result = ZxingScanner::execute(['option1' => 'value']);

// Get status
$status = ZxingScanner::getStatus();
```

## Listening for Events

```php
use Livewire\Attributes\On;

#[On('native:Margelo\ZxingScanner\Events\ZxingScannerCompleted')]
public function handleZxingScannerCompleted($result, $id = null)
{
    // Handle the event
}
```

## License

MIT