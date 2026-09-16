<?php

namespace Margelo\ZxingScanner;

class ZxingScanner
{
    /**
     * Open the camera. Every decoded code fires a CodeScanned event; the overlay counts
     * only the scans the app confirms back with confirm(), and RunCompleted fires once
     * the confirmed count reaches $target.
     */
    public function start(int $target = 1000): void
    {
        $this->call('ZxingScanner.Start', ['target' => $target]);
    }

    public function confirm(): void
    {
        $this->call('ZxingScanner.Confirm');
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
