<?php

declare(strict_types=1);

use PHPMailer\PHPMailer\PHPMailer;

const RW_MAX_BYTES = 20480;
const RW_MIN_FILL_MS = 3000;
const RW_SUBJECT = 'Anfrage über rohweiss.de';

function rw_respond(int $status, array $body, bool $form): void
{
    if ($form) {
        $base = ($GLOBALS['rw_lang'] ?? '') === 'en' ? '/en/' : '/';
        $target = $base . ($status === 200 ? '#gesendet' : '#fehler');
        header('Location: ' . $target, true, 303);
        exit;
    }
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($body);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'] ?? '';
$type = strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0]));
$isForm = $type === 'application/x-www-form-urlencoded';

if ($method !== 'POST') {
    header('Allow: POST');
    rw_respond(405, ['ok' => false, 'error' => 'method'], false);
}
if ($type !== 'application/json' && !$isForm) {
    rw_respond(415, ['ok' => false, 'error' => 'type'], false);
}
if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > RW_MAX_BYTES) {
    rw_respond(413, ['ok' => false, 'error' => 'size'], $isForm);
}
$raw = file_get_contents('php://input', false, null, 0, RW_MAX_BYTES + 1);
if ($raw === false || strlen($raw) > RW_MAX_BYTES) {
    rw_respond(413, ['ok' => false, 'error' => 'size'], $isForm);
}

if ($isForm) {
    parse_str($raw, $data);
    $data['consent'] = in_array(strtolower((string) ($data['consent'] ?? '')), ['on', '1', 'true', 'yes'], true);
    $GLOBALS['rw_lang'] = ($data['lang'] ?? '') === 'en' ? 'en' : 'de';
    $number = ltrim((string) preg_replace('/\s+/', ' ', trim((string) ($data['phone'] ?? ''))), '0 ');
    preg_match('/\+\d{1,4}/', (string) ($data['phone_code'] ?? ''), $code);
    $data['phone'] = $number === '' ? '' : ($code[0] ?? '+49') . ' ' . $number;
} else {
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        rw_respond(422, ['ok' => false, 'error' => 'validation'], false);
    }
}

$trap = $data['website'] ?? '';
$filled = is_string($trap) ? trim($trap) !== '' : $trap !== null;
if (isset($data['t']) && is_numeric($data['t'])) {
    $tooFast = (float) $data['t'] < RW_MIN_FILL_MS;
} else {
    $tooFast = !$isForm;
}
if ($filled || $tooFast) {
    rw_respond(200, ['ok' => true], $isForm);
}

require __DIR__ . '/lib/validate.php';
require __DIR__ . '/lib/ratelimit.php';

if (rw_validate($data) !== []) {
    rw_respond(422, ['ok' => false, 'error' => 'validation'], $isForm);
}

$configFile = __DIR__ . '/config.php';
$config = is_file($configFile) ? require $configFile : null;
if (!is_array($config)) {
    rw_respond(500, ['ok' => false, 'error' => 'send'], $isForm);
}
define('RW_SALT', (string) ($config['salt'] ?? ''));

if (!rw_rate_ok((string) ($_SERVER['REMOTE_ADDR'] ?? ''), __DIR__ . '/data', time())) {
    rw_respond(429, ['ok' => false, 'error' => 'rate'], $isForm);
}

$name = rw_text($data['name']);
$email = rw_text($data['email']);
$partner = ($data['kind'] ?? '') === 'partner';
$lines = [
    'Art: ' . ($partner ? 'Partneranfrage' : 'Kundenanfrage'),
    'Name: ' . $name,
    'E-Mail: ' . $email,
    'Telefon: ' . rw_text($data['phone'] ?? null),
    'Unternehmen: ' . rw_text($data['company'] ?? null),
    'Thema: ' . rw_text($data['topic'] ?? null),
    'Fachgebiet: ' . rw_text($data['specialty'] ?? null),
    'Portfolio: ' . rw_text($data['portfolio'] ?? null),
    'Sprache: ' . rw_text($data['lang'] ?? null),
    '',
    rw_text($data['message']),
];

try {
    require __DIR__ . '/vendor/phpmailer/Exception.php';
    require __DIR__ . '/vendor/phpmailer/PHPMailer.php';
    require __DIR__ . '/vendor/phpmailer/SMTP.php';
    $mail = new PHPMailer(true);
    $mail->isSMTP();
    $mail->Host = (string) $config['host'];
    $mail->Port = (int) $config['port'];
    $mail->SMTPAuth = true;
    $mail->Username = (string) $config['user'];
    $mail->Password = (string) $config['pass'];
    $mail->SMTPSecure = $mail->Port === 465 ? PHPMailer::ENCRYPTION_SMTPS : PHPMailer::ENCRYPTION_STARTTLS;
    $mail->CharSet = 'UTF-8';
    $mail->setFrom((string) $config['user'], 'rohweiss Website');
    $mail->addAddress((string) $config['to']);
    $mail->addReplyTo($email, str_replace(['"', '\\'], '', $name));
    $mail->Subject = $partner ? 'Partneranfrage über rohweiss.de' : RW_SUBJECT;
    $mail->Body = implode("\n", $lines);
    $mail->send();
} catch (Throwable $e) {
    error_log('contact.php: ' . $e->getMessage());
    rw_respond(500, ['ok' => false, 'error' => 'send'], $isForm);
}

rw_respond(200, ['ok' => true], $isForm);
