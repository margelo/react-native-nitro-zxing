<?php

namespace Margelo\ZxingScanner\Commands;

use Native\Mobile\Plugins\Commands\NativePluginHookCommand;

/**
 * Copy assets hook command for ZxingScanner plugin.
 *
 * This hook runs during the copy_assets phase of the build process.
 * Use it to copy ML models, binary files, or other assets that need
 * to be in specific locations in the native project.
 *
 * @see \Native\Mobile\Plugins\Commands\NativePluginHookCommand
 */
class CopyAssetsCommand extends NativePluginHookCommand
{
    protected $signature = 'nativephp:zxing-scanner:copy-assets';

    protected $description = 'Copy assets for ZxingScanner plugin';

    public function handle(): int
    {
        // Example: Copy different files based on platform
        if ($this->isAndroid()) {
            $this->copyAndroidAssets();
        }

        if ($this->isIos()) {
            $this->copyIosAssets();
        }

        return self::SUCCESS;
    }

    /**
     * Copy assets for Android build
     */
    protected function copyAndroidAssets(): void
    {
        // Example: Copy a TensorFlow Lite model to Android assets
        // $this->copyToAndroidAssets('model.tflite', 'model.tflite');

        // Example: Download a model if not present locally
        // $modelPath = $this->pluginPath() . '/resources/model.tflite';
        // $this->downloadIfMissing(
        //     'https://example.com/model.tflite',
        //     $modelPath
        // );
        // $this->copyToAndroidAssets('model.tflite', 'model.tflite');

        $this->info('Android assets copied for ZxingScanner');
    }

    /**
     * Copy assets for iOS build
     */
    protected function copyIosAssets(): void
    {
        // Example: Copy a Core ML model to iOS bundle
        // $this->copyToIosBundle('model.mlmodelc', 'model.mlmodelc');

        $this->info('iOS assets copied for ZxingScanner');
    }
}