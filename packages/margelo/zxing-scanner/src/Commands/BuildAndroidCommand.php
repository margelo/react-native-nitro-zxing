<?php

namespace Margelo\ZxingScanner\Commands;

use Native\Mobile\Plugins\Commands\NativePluginHookCommand;
use Symfony\Component\Process\Process;

/**
 * pre_compile hook: compiles zxing-cpp from the bundled submodule and publishes the AAR into a
 * Maven repository inside the Android project, where nativephp.json points the app at it.
 */
class BuildAndroidCommand extends NativePluginHookCommand
{
    protected $signature = 'nativephp:zxing-scanner:build-android';

    protected $description = 'Build the zxing-cpp Android library from source';

    public function handle(): int
    {
        if (! $this->isAndroid()) {
            return self::SUCCESS;
        }

        $repo = rtrim($this->buildPath(), '/').'/zxing-maven';
        $script = $this->pluginPath().'/scripts/build-android-aar.sh';

        $this->info('Building zxing-cpp for Android from source…');

        $process = new Process([$script, $repo]);
        $process->setTimeout(1800);
        $process->run(fn ($type, $buffer) => $this->output->write($buffer));

        if (! $process->isSuccessful()) {
            $this->error('zxing-cpp Android build failed');

            return self::FAILURE;
        }

        return self::SUCCESS;
    }
}
