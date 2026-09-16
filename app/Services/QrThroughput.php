<?php

namespace App\Services;

use Closure;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\GuzzleException;
use Illuminate\Support\Facades\Cache;
use Margelo\ZxingScanner\ZxingScanner;

/** React Native's JavaScript benchmark loop, implemented in PHP. */
class QrThroughput
{
    public const TARGET = 1000;

    public string $phase = 'idle';

    public string $lastSent = '';

    public int $count = 0;

    public ?float $startedAt = null;

    public ?float $elapsedMs = null;

    public string $error = '';

    private Client $client;

    private Closure $clock;

    public function __construct(
        private readonly ZxingScanner $scanner,
        ?Client $client = null,
        ?Closure $clock = null,
    ) {
        $this->client = $client ?? new Client([
            'connect_timeout' => 2,
            'timeout' => 2,
            'http_errors' => false,
        ]);
        $this->clock = $clock ?? fn (): float => hrtime(true) / 1e6;
    }

    /** Open the camera before the timed run, just like RN mounts its scanner before Start. */
    public function open(): void
    {
        $this->phase = 'ready';
        $this->lastSent = '';
        $this->count = 0;
        $this->startedAt = null;
        $this->elapsedMs = null;
        $this->error = '';
        Cache::forget('last_run');
        $this->scanner->start(self::TARGET);
    }

    /** RN start(): await POST /reset, then mark the run active and start the clock. */
    public function start(): void
    {
        if ($this->phase === 'running') {
            return;
        }

        try {
            $response = $this->client->post($this->server().'/reset');
            $ok = $response->getStatusCode() >= 200
                && $response->getStatusCode() < 300
                && (json_decode((string) $response->getBody(), true)['ok'] ?? false) === true;
        } catch (GuzzleException $exception) {
            $this->fail($exception->getMessage());

            return;
        }

        if (! $ok) {
            $this->fail('The QR server could not start a new run.');

            return;
        }

        $this->phase = 'running';
        $this->lastSent = '';
        $this->count = 0;
        $this->elapsedMs = null;
        $this->error = '';
        $this->startedAt = $this->now();
        $this->publish();
    }

    /** RN onCode(): dedupe, POST /scan, then count only replies whose body says ok. */
    public function scan(string $data): void
    {
        if ($this->phase !== 'running' || $data === $this->lastSent) {
            return;
        }

        $this->lastSent = $data;

        try {
            $response = $this->client->post($this->server().'/scan', ['json' => ['value' => $data]]);
            $ok = (json_decode((string) $response->getBody(), true)['ok'] ?? false) === true;
        } catch (GuzzleException $exception) {
            $this->error = $exception->getMessage();
            $this->publish();

            return;
        }

        if (! $ok || $this->phase !== 'running') {
            return;
        }

        $this->count++;
        if ($this->count >= self::TARGET) {
            $this->elapsedMs = $this->now() - $this->startedAt;
            $this->phase = 'done';
            Cache::forever('last_run', [
                'count' => $this->count,
                'elapsedMs' => $this->elapsedMs,
                'at' => now()->toDateTimeString(),
            ]);
        }
        $this->publish();
    }

    private function fail(string $message): void
    {
        $this->phase = 'ready';
        $this->startedAt = null;
        $this->error = $message;
        $this->publish();
    }

    private function publish(): void
    {
        $elapsed = $this->elapsedMs ?? ($this->startedAt !== null ? $this->now() - $this->startedAt : 0);
        $this->scanner->update($this->count, $elapsed, $this->phase, $this->error);
    }

    private function server(): string
    {
        return rtrim((string) config('services.qr_server.url'), '/');
    }

    private function now(): float
    {
        return ($this->clock)();
    }
}
