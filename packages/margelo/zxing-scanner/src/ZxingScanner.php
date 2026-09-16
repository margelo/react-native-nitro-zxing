<?php

namespace Margelo\ZxingScanner;

class ZxingScanner
{
    /** Open the camera. The overlay Start button asks PHP to begin the timed run. */
    public function start(int $target = 1000): void
    {
        $this->call('ZxingScanner.Start', ['target' => $target]);
    }

    public function update(int $count, float $elapsedMs, string $phase, string $error = ''): void
    {
        $this->call('ZxingScanner.Update', [
            'count' => $count,
            'elapsed_ms' => $elapsedMs,
            'phase' => $phase,
            'error' => $error,
        ]);
    }

    public function stop(): void
    {
        $this->call('ZxingScanner.Stop');
    }

    protected function call(string $method, array $params = []): mixed
    {
        if (! function_exists('nativephp_call')) {
            return null;
        }

        $result = nativephp_call($method, json_encode($params ?: new \stdClass));

        return $result ? (json_decode($result)->data ?? null) : null;
    }
}
