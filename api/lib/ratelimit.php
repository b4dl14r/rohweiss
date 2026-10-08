<?php

const RW_RATE_LIMIT = 5;
const RW_RATE_WINDOW = 3600;

function rw_rate_ok(string $ip, string $dir, int $now): bool
{
    $salt = defined('RW_SALT') ? RW_SALT : '';
    $file = rtrim($dir, '/\\') . DIRECTORY_SEPARATOR . 'rate_' . hash('sha256', $ip . $salt) . '.json';
    $handle = fopen($file, 'c+');
    if ($handle === false) {
        return false;
    }
    if (!flock($handle, LOCK_EX)) {
        fclose($handle);
        return false;
    }
    $stored = json_decode((string) stream_get_contents($handle), true);
    $times = [];
    foreach (is_array($stored) ? $stored : [] as $time) {
        if (is_int($time) && $now - $time < RW_RATE_WINDOW) {
            $times[] = $time;
        }
    }
    $allowed = count($times) < RW_RATE_LIMIT;
    if ($allowed) {
        $times[] = $now;
    }
    ftruncate($handle, 0);
    rewind($handle);
    fwrite($handle, json_encode($times));
    fflush($handle);
    flock($handle, LOCK_UN);
    fclose($handle);
    return $allowed;
}
