<?php

namespace Tests\Feature;

use App\Services\QrThroughput;
use GuzzleHttp\Client;
use GuzzleHttp\Handler\MockHandler;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Middleware;
use GuzzleHttp\Psr7\Response;
use Margelo\ZxingScanner\ZxingScanner;
use Mockery;
use Tests\TestCase;

class QrThroughputTest extends TestCase
{
    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_camera_opens_before_the_server_and_clock_start(): void
    {
        $scanner = Mockery::mock(ZxingScanner::class);
        $scanner->shouldReceive('start')->once()->with(1000);
        $run = new QrThroughput($scanner, $this->client([]));

        $run->open();

        $this->assertSame('ready', $run->phase);
        $this->assertNull($run->startedAt);
        $this->assertSame([], $this->history);
    }

    public function test_overlay_start_resets_then_starts_the_php_clock(): void
    {
        $scanner = Mockery::mock(ZxingScanner::class);
        $scanner->shouldReceive('update')->once()->with(0, 0.0, 'running', '');
        $run = new QrThroughput($scanner, $this->client([
            new Response(200, [], '{"ok":true}'),
        ]), fn (): float => 5000.0);

        $run->start();

        $this->assertSame('running', $run->phase);
        $this->assertSame(5000.0, $run->startedAt);
        $this->assertSame('/reset', $this->history[0]['request']->getUri()->getPath());
    }

    public function test_php_dedupes_and_counts_only_server_accepted_scans(): void
    {
        $scanner = Mockery::mock(ZxingScanner::class);
        $scanner->shouldReceive('update')->twice();
        $clock = 1000.0;
        $run = new QrThroughput($scanner, $this->client([
            new Response(200, [], '{"ok":true}'),
            new Response(200, [], '{"ok":true}'),
            new Response(200, [], '{"ok":false}'),
        ]), function () use (&$clock): float {
            return $clock += 10;
        });

        $run->start();
        $run->scan('1:accepted');
        $run->scan('1:accepted');
        $run->scan('2:rejected');

        $this->assertSame(1, $run->count);
        $this->assertCount(3, $this->history);
        $this->assertSame(['/reset', '/scan', '/scan'], array_map(
            fn (array $entry): string => $entry['request']->getUri()->getPath(),
            $this->history,
        ));
    }

    public function test_one_thousand_accepted_scans_freeze_the_php_result(): void
    {
        $responses = [new Response(200, [], '{"ok":true}')];
        for ($i = 0; $i < 1000; $i++) {
            $responses[] = new Response(200, [], '{"ok":true}');
        }
        $scanner = Mockery::mock(ZxingScanner::class);
        $scanner->shouldReceive('update')->times(1001);
        $clock = 0.0;
        $run = new QrThroughput($scanner, $this->client($responses), function () use (&$clock): float {
            return $clock += 1;
        });

        $run->start();
        for ($i = 1; $i <= 1000; $i++) {
            $run->scan($i.':value');
        }

        $this->assertSame('done', $run->phase);
        $this->assertSame(1000, $run->count);
        $this->assertNotNull($run->elapsedMs);
        $this->assertSame(1000, cache('last_run')['count']);
        $this->assertCount(1001, $this->history);
    }

    /** @param array<int, Response> $responses */
    private function client(array $responses): Client
    {
        $this->history = [];
        $stack = HandlerStack::create(new MockHandler($responses));
        $stack->push(Middleware::history($this->history));

        return new Client(['handler' => $stack, 'http_errors' => false]);
    }
}
