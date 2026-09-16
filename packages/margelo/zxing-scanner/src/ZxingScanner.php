<?php

namespace Margelo\ZxingScanner;

class ZxingScanner
{
    /**
     * Open the camera. RunCompleted fires once the confirmed count reaches $target.
     *
     * With a $reportUrl the scanner POSTs {"value": code} there itself, over one
     * keep-alive connection, and counts every reply whose "ok" is true. PHP is not
     * involved between the first and the last code.
     *
     * Without one, every decoded code fires a CodeScanned event and the overlay
     * counts only the scans the app confirms back with confirm().
     */
    public function start(int $target = 1000, ?string $reportUrl = null): void
    {
        $this->call('ZxingScanner.Start', array_filter([
            'target' => $target,
            'report_url' => $reportUrl,
        ]));
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
