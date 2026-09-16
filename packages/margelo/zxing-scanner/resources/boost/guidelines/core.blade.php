## margelo/zxing-scanner

A NativePHP Mobile plugin

### Installation

```bash
composer require margelo/zxing-scanner
```

### PHP Usage (Livewire/Blade)

Use the `ZxingScanner` facade:

@verbatim
<code-snippet name="Using ZxingScanner Facade" lang="php">
use Margelo\ZxingScanner\Facades\ZxingScanner;

// Execute the plugin functionality
$result = ZxingScanner::execute(['option1' => 'value']);

// Get the current status
$status = ZxingScanner::getStatus();
</code-snippet>
@endverbatim

### Available Methods

- `ZxingScanner::execute()`: Execute the plugin functionality
- `ZxingScanner::getStatus()`: Get the current status

### Events

- `ZxingScannerCompleted`: Listen with `#[OnNative(ZxingScannerCompleted::class)]`

@verbatim
<code-snippet name="Listening for ZxingScanner Events" lang="php">
use Native\Mobile\Attributes\OnNative;
use Margelo\ZxingScanner\Events\ZxingScannerCompleted;

#[OnNative(ZxingScannerCompleted::class)]
public function handleZxingScannerCompleted($result, $id = null)
{
    // Handle the event
}
</code-snippet>
@endverbatim

### JavaScript Usage (Vue/React/Inertia)

@verbatim
<code-snippet name="Using ZxingScanner in JavaScript" lang="javascript">
import { zxingScanner } from '@margelo/zxing-scanner';

// Execute the plugin functionality
const result = await zxingScanner.execute({ option1: 'value' });

// Get the current status
const status = await zxingScanner.getStatus();
</code-snippet>
@endverbatim