/**
 * Text cleanup utilities for voice transcripts and messy input
 * Converts brain-dump style capture into cleaner structured text
 */

/**
 * Remove filler words commonly from voice transcription
 */
function removeFiller(text: string): string {
  // Common filler words and patterns
  const fillerPatterns = [
    /\b(um|uh|er|ah|like|you know|basically|actually|literally)\b/gi,
    /\b(kind of|sort of|I mean|I think|I guess)\b/gi,
    // Repeated words: "the the" -> "the"
    /\b(\w+)\s+\1\b/gi,
  ];

  let cleaned = text;
  for (const pattern of fillerPatterns) {
    if (pattern.source.includes('(\\w+)\\s+\\1')) {
      // Special handling for repeated words
      cleaned = cleaned.replace(pattern, '$1');
    } else {
      cleaned = cleaned.replace(pattern, '');
    }
  }

  return cleaned;
}

/**
 * Fix common voice transcription errors
 */
function fixTranscriptionErrors(text: string): string {
  const fixes: Record<string, string> = {
    // Common homophones and mishearings
    'their are': 'there are',
    'they\'re are': 'there are',
    'your going': 'you\'re going',
    'its time': 'it\'s time',
    'cant': 'can\'t',
    'wont': 'won\'t',
    'dont': 'don\'t',
    'Im': 'I\'m',
    'Ill': 'I\'ll',
    'Id': 'I\'d',
    'youll': 'you\'ll',
    'youd': 'you\'d',
    // Common tech terms
    'get hub': 'GitHub',
    'pull request': 'PR',
    'jay son': 'JSON',
    'react jay s': 'ReactJS',
    'type script': 'TypeScript',
  };

  let fixed = text;
  for (const [wrong, right] of Object.entries(fixes)) {
    const regex = new RegExp(`\\b${wrong}\\b`, 'gi');
    fixed = fixed.replace(regex, right);
  }

  return fixed;
}

/**
 * Normalize spacing and punctuation
 */
function normalizeWhitespace(text: string): string {
  return text
    // Multiple spaces to single space
    .replace(/\s+/g, ' ')
    // Remove space before punctuation
    .replace(/\s+([,.!?;:])/g, '$1')
    // Add space after punctuation if missing
    .replace(/([,.!?;:])([A-Za-z])/g, '$1 $2')
    // Trim
    .trim();
}

/**
 * Capitalize sentences properly
 */
function capitalizeSentences(text: string): string {
  // Split on sentence boundaries
  return text.replace(/(^\w|[.!?]\s+\w)/g, (match) => match.toUpperCase());
}

/**
 * Remove trailing voice artifacts like "end of message" or "stop recording"
 */
function removeVoiceArtifacts(text: string): string {
  const artifactPatterns = [
    /\b(end of message|stop recording|end recording|that's all|that is all)\s*\.?$/i,
    /\b(period|comma|question mark|exclamation point)\s*$/i,
  ];

  let cleaned = text;
  for (const pattern of artifactPatterns) {
    cleaned = cleaned.replace(pattern, '');
  }

  return cleaned.trim();
}

/**
 * Smart quote normalization - convert "straight quotes" to proper ones if desired
 * For now, just normalize to straight quotes for consistency
 */
function normalizeQuotes(text: string): string {
  return text
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'");
}

/**
 * Full text cleanup pipeline
 * Applies all cleanup transformations in order
 */
export function cleanupText(text: string, options?: {
  removeFiller?: boolean;
  fixTranscription?: boolean;
  capitalize?: boolean;
}): string {
  const {
    removeFiller: shouldRemoveFiller = true,
    fixTranscription = true,
    capitalize = true,
  } = options || {};

  let cleaned = text;

  // Apply cleanup steps in order
  cleaned = removeVoiceArtifacts(cleaned);
  
  if (shouldRemoveFiller) {
    cleaned = removeFiller(cleaned);
  }
  
  if (fixTranscription) {
    cleaned = fixTranscriptionErrors(cleaned);
  }
  
  cleaned = normalizeQuotes(cleaned);
  cleaned = normalizeWhitespace(cleaned);
  
  if (capitalize) {
    cleaned = capitalizeSentences(cleaned);
  }

  return cleaned;
}

/**
 * Quick cleanup for simple fixes without heavy processing
 * Good for real-time input cleanup as user types
 */
export function quickCleanup(text: string): string {
  return normalizeWhitespace(normalizeQuotes(text));
}

/**
 * Detect if text looks like a raw voice transcript
 * (Has filler words, repeated words, or voice artifacts)
 */
export function looksLikeRawTranscript(text: string): boolean {
  const fillerWords = /\b(um|uh|er|like you know|basically actually|literally|kind of|sort of|I mean)\b/i;
  const repeatedWords = /\b(\w+)\s+\1\b/;
  const voiceArtifacts = /\b(end of message|stop recording|period|comma|question mark)\b/i;
  
  return fillerWords.test(text) || repeatedWords.test(text) || voiceArtifacts.test(text);
}
