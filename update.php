<?php
// PRODUCTION-READY GITHUB ZIP UPDATER
// Place in web root, configure $zipUrl, run once, then secure/remove

// PASSWORD PROTECTION
session_start();
$passwordFile = __DIR__ . '/../data/password.txt';
$correctPassword = file_exists($passwordFile) ? trim(file_get_contents($passwordFile)) : 'greenfish';

// COMMON HTML HEADER & FOOTER
function renderHeader($title) {
    ?>
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title><?php echo htmlspecialchars($title); ?></title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
            }
            .content-box {
                background: white;
                padding: 40px;
                border-radius: 20px;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                max-width: 800px;
                width: 100%;
            }
            h2 {
                color: #333;
                margin-bottom: 10px;
                font-size: 1.8em;
                text-align: center;
            }
            p {
                color: #666;
                margin-bottom: 25px;
                text-align: center;
            }
            input[type="password"] {
                width: 100%;
                padding: 15px;
                border: 2px solid #e2e8f0;
                border-radius: 10px;
                font-size: 1.1em;
                text-align: center;
                margin-bottom: 15px;
                transition: border-color 0.3s ease;
            }
            input[type="password"]:focus {
                outline: none;
                border-color: #667eea;
            }
            input[type="password"].error {
                border-color: #dc2626;
                animation: shake 0.5s;
            }
            @keyframes shake {
                0%, 100% { transform: translateX(0); }
                25% { transform: translateX(-10px); }
                75% { transform: translateX(10px); }
            }
            button {
                width: 100%;
                padding: 15px;
                background: #667eea;
                color: white;
                border: none;
                border-radius: 10px;
                font-size: 1.1em;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
            }
            button:hover {
                background: #764ba2;
                transform: translateY(-2px);
                box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
            }
            .error-message {
                color: #dc2626;
                font-size: 0.9em;
                margin-top: 10px;
                text-align: center;
            }
            .output {
                background: #f8fafc;
                border: 2px solid #e2e8f0;
                border-radius: 10px;
                padding: 20px;
                margin-bottom: 20px;
                font-family: 'Courier New', monospace;
                font-size: 0.9em;
                color: #334155;
                max-height: 400px;
                overflow-y: auto;
                text-align: left;
            }
            .output br {
                margin-bottom: 5px;
            }
        </style>
    </head>
    <body>
        <div class="content-box">
    <?php
}

function renderFooter() {
    ?>
        </div>
    </body>
    </html>
    <?php
}

// Check if update was triggered
$runUpdate = false;
if (isset($_SESSION['authenticated']) && $_SESSION['authenticated'] === true && isset($_POST['run_update'])) {
    $runUpdate = true;
}

if (!isset($_SESSION['authenticated']) || $_SESSION['authenticated'] !== true) {
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['password'])) {
        if ($_POST['password'] === $correctPassword) {
            $_SESSION['authenticated'] = true;
        } else {
            $loginError = 'Incorrect password';
        }
    }
    
    if (!isset($_SESSION['authenticated']) || $_SESSION['authenticated'] !== true) {
        renderHeader('Password Required');
        ?>
        <h2>🔒 Password Required</h2>
        <p>Please enter the password to access the updater</p>
        <form method="POST">
            <input type="password" name="password" placeholder="Enter password" 
                   class="<?php echo isset($loginError) ? 'error' : ''; ?>" 
                   autocomplete="off" autofocus required>
            <button type="submit">Unlock</button>
            <?php if (isset($loginError)): ?>
                <div class="error-message"><?php echo htmlspecialchars($loginError); ?></div>
            <?php endif; ?>
        </form>
        <?php
        renderFooter();
        exit;
    }
}

// Show update button if authenticated but update not triggered yet
if (!$runUpdate) {
    renderHeader('Update App');
    ?>
    <h2>🚀 Ready to Update</h2>
    <p>Click the button below to update the app</p>
    <form method="POST">
        <input type="hidden" name="run_update" value="1">
        <button type="submit">Update Now</button>
    </form>
    <?php
    renderFooter();
    exit;
}

// If we get here, authenticated and update triggered - show output in styled wrapper
renderHeader('Updating App');
?>
<h2>⚙️ Updating App</h2>
<div class="output">
<?php
flush();

set_time_limit(300);        // 5min timeout
ini_set('memory_limit', '512M');
ini_set('max_execution_time', 300);
ignore_user_abort(false);   // Stop on disconnect

// CONFIGURATION
$repoName = 'AdFreeApps';
$zipUrl = 'https://github.com/sconnellcom/' . $repoName . '/archive/refs/heads/main.zip';
$zipFile = 'update.zip';
$lockFile = 'update.lock';
$selfScript = basename(__FILE__);
$extractPath = __DIR__ . '/';

// FILE LOCKING - Prevent concurrent runs
$fp = fopen($lockFile, 'w');
if (!$fp || !flock($fp, LOCK_EX | LOCK_NB)) {
    die("Update already running or lock failed.<br />");
}
register_shutdown_function(function() use ($fp, $lockFile) {
    flock($fp, LOCK_UN);
    fclose($fp);
    unlink($lockFile);
});

function getZipFilesRecursive($zip, &$rootFolder, &$filesInZip) {
    $rootFolderDetermined = false;
    for ($i = 0; $i < $zip->numFiles; $i++) {
        $entryName = $zip->getNameIndex($i);
        if (!$rootFolderDetermined && strpos($entryName, '/') !== false) {
            $firstSlashPos = strpos($entryName, '/');
            $rootFolder = substr($entryName, 0, $firstSlashPos + 1);
            $rootFolderDetermined = true;
        }
        $relativePath = $rootFolderDetermined ? substr($entryName, strlen($rootFolder)) : $entryName;
        if ($relativePath !== '' && strpos($relativePath, '../') === false) {
            $filesInZip[] = $relativePath;
        }
    }
}

function scanDirRecursive($dir, &$currentFiles, $exclude = []) {
    $items = @scandir($dir);
    if ($items === false) return;

    foreach ($items as $item) {
        if ($item === '.' || $item === '..' || in_array($item, $exclude, true)) continue;

        $fullPath = $dir . $item;
        if (!is_readable($fullPath)) continue;

        $relPath = substr($fullPath, strlen(__DIR__) + 1);

        if (is_file($fullPath)) {
            $currentFiles[] = $relPath;
        } elseif (is_dir($fullPath)) {
            $currentFiles[] = $relPath . '/';
            scanDirRecursive($fullPath . '/', $currentFiles, $exclude);
        }
    }
}

function deleteNotInZip($filesToKeep, $exclude) {
    $currentFiles = [];
    scanDirRecursive(__DIR__ . '/', $currentFiles, $exclude);

    foreach ($currentFiles as $currentFile) {
        if (!in_array($currentFile, $filesToKeep, true)) {
            $fullPath = __DIR__ . '/' . $currentFile;
            if (strpos($fullPath, __DIR__) !== 0) continue; // Security: block path traversal

            if (is_file($fullPath)) {
                @unlink($fullPath);
            } elseif (is_dir($fullPath) && substr($currentFile, -1) === '/') {
                @rmdir($fullPath); // Only empty dirs
            }
        }
    }
}
function curlDownloadFile($url, $dest) {
    $ch = curl_init($url);
    $fp = fopen($dest, 'w');

    curl_setopt($ch, CURLOPT_FILE, $fp);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_FAILONERROR, true);
    curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
    curl_setopt($ch, CURLOPT_REFERER, 'https://github.com/');
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 120);

    $success = curl_exec($ch);
    if (!$success) {
        $error = curl_error($ch);
        curl_close($ch);
        fclose($fp);
        unlink($dest);
        die("cURL download error: $error<br />");
    }

    curl_close($ch);
    fclose($fp);
}

// VALIDATED DOWNLOAD
echo "Downloading ZIP...<br />";
flush();
curlDownloadFile($zipUrl, $zipFile);
chmod($zipFile, 0644);
echo "Download complete. File size: " . filesize($zipFile) . " bytes<br />";
flush();

// PROCESS ZIP
echo "Opening ZIP file...<br />";
flush();

if (!class_exists('ZipArchive')) {
    die("ZipArchive class not available. Install php-zip extension.<br />");
}

if (!file_exists($zipFile)) {
    die("ZIP file disappeared after download.<br />");
}

$zip = new ZipArchive();
$openResult = $zip->open($zipFile);
if ($openResult !== TRUE) {
    $errors = [
        ZipArchive::ER_EXISTS => 'File already exists',
        ZipArchive::ER_INCONS => 'Zip archive inconsistent',
        ZipArchive::ER_INVAL => 'Invalid argument',
        ZipArchive::ER_MEMORY => 'Memory allocation failure',
        ZipArchive::ER_NOENT => 'No such file',
        ZipArchive::ER_NOZIP => 'Not a zip archive',
        ZipArchive::ER_OPEN => 'Can\'t open file',
        ZipArchive::ER_READ => 'Read error',
        ZipArchive::ER_SEEK => 'Seek error'
    ];
    $errorMsg = isset($errors[$openResult]) ? $errors[$openResult] : 'Unknown error';
    @unlink($zipFile);
    die("Failed to open ZIP file. Error code: $openResult ($errorMsg)<br />");
}
echo "ZIP opened successfully.<br />";
flush();

$filesInZip = [];
$rootFolder = $repoName . '-main';
echo "Analyzing ZIP contents...<br />";
flush();
getZipFilesRecursive($zip, $rootFolder, $filesInZip);

if (empty($filesInZip)) {
    $zip->close();
    @unlink($zipFile);
    die("No valid files found in ZIP.<br />");
}
echo "Found " . count($filesInZip) . " files in ZIP.<br />";
flush();

// EXTRACT NEW FILES
echo "Extracting " . count($filesInZip) . " files...<br />";
flush();
$extracted = 0;
for ($i = 0; $i < $zip->numFiles; $i++) {
    $entryName = $zip->getNameIndex($i);
    $relativePath = substr($entryName, strlen($rootFolder));
    if ($relativePath === '' || strpos($relativePath, '../') !== false) continue;

    $dstPath = __DIR__ . '/' . $relativePath;
    if (strpos($dstPath, __DIR__) !== 0) continue; // Security

    // Skip if it's a directory entry
    if (substr($entryName, -1) === '/') {
        if (!is_dir($dstPath)) {
            mkdir($dstPath, 0755, true);
        }
        continue;
    }

    // Create parent directory if needed
    $dirPath = dirname($dstPath);
    if (!is_dir($dirPath)) {
        mkdir($dirPath, 0755, true);
    }

    // Extract file
    // Delete existing file first to avoid permission issues
    if (file_exists($dstPath)) {
        @unlink($dstPath);
    }
    
    $zipStream = $zip->getStream($entryName);
    if ($zipStream) {
        $outFile = @fopen($dstPath, 'wb');
        if ($outFile) {
            while (!feof($zipStream)) {
                fwrite($outFile, fread($zipStream, 8192));
            }
            fclose($outFile);
            chmod($dstPath, 0644);
            $extracted++;
        } else {
            echo "Warning: Could not write to $relativePath<br />";
            flush();
        }
        fclose($zipStream);
    }
}
flush();

// CLEANUP OLD FILES
echo "Cleaning obsolete files...<br />";
deleteNotInZip($filesInZip, [$selfScript, $zipFile, $lockFile]);

$zip->close();
@unlink($zipFile);

echo "Update completed: $extracted files extracted.<br />";
echo "Lock released. Script remains for manual re-runs.<br />";
?>
</div>
<form method="POST">
    <input type="hidden" name="run_update" value="1">
    <button type="submit">Update Again</button>
</form>
<?php
renderFooter();
?>