<?php

const RW_SINGLE_LINE = ['name', 'email', 'phone', 'company', 'topic', 'specialty', 'portfolio'];
const RW_MAX_LENGTH = ['name' => 200, 'email' => 254, 'phone' => 60, 'company' => 200, 'topic' => 200, 'specialty' => 200, 'portfolio' => 300, 'message' => 5000];

function rw_text($value): string
{
    return is_string($value) ? trim($value) : '';
}

function rw_validate(array $d): array
{
    $errors = [];
    foreach (['name', 'email', 'message'] as $key) {
        if (rw_text($d[$key] ?? null) === '') {
            $errors[] = $key;
        }
    }
    if (!in_array('email', $errors, true) && preg_match('/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/u', rw_text($d['email'])) !== 1) {
        $errors[] = 'email';
    }
    $phone = rw_text($d['phone'] ?? null);
    if ($phone !== '' && preg_match('/^\+\d{1,4} \d[\d ]{2,18}\d$/', $phone) !== 1) {
        $errors[] = 'phone';
    }
    foreach (RW_SINGLE_LINE as $key) {
        if (preg_match('/[\r\n]/', rw_text($d[$key] ?? null)) === 1 && !in_array($key, $errors, true)) {
            $errors[] = $key;
        }
    }
    foreach (RW_MAX_LENGTH as $key => $max) {
        if (mb_strlen(rw_text($d[$key] ?? null), 'UTF-8') > $max && !in_array($key, $errors, true)) {
            $errors[] = $key;
        }
    }
    if (($d['consent'] ?? null) !== true) {
        $errors[] = 'consent';
    }
    return $errors;
}
