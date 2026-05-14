/**
 * Check if a file is an allowed audio format
 */
export function isAllowedAudioFormat(filename: string): boolean {
    const allowedExtensions = ['.mp3', '.wav', '.ogg', '.flac', '.m4a'];
    const extension = filename.substring(filename.lastIndexOf('.')).toLowerCase();
    return allowedExtensions.includes(extension);
}

/**
 * Validate that a file is within size limits
 */
export function isFileSizeValid(fileSize: number, maxSizeMB: number = 50): boolean {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    return fileSize <= maxSizeBytes;
}

/**
 * Validate that a string is not empty
 */
export function isNotEmpty(value: string): boolean {
    return value.trim().length > 0;
}

/**
 * Validate that a number is within a range
 */
export function isInRange(value: number, min: number, max: number): boolean {
    return value >= min && value <= max;
}
