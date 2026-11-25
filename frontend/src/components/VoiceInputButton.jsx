import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, Mic, MicOff, Square, Volume2 } from 'lucide-react';

/**
 * VoiceInputButton — Web Speech API voice input controller with live streaming transcript,
 * audio pulse animation, recording timer, and graceful browser fallbacks.
 */
export default function VoiceInputButton({
  onTranscript,
  onFinalTranscript,
  disabled = false,
  className = '',
}) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [duration, setDuration] = useState(0);

  const recognitionRef = useRef(null);
  const timerRef = useRef(null);
  const finalTranscriptAccumulator = useRef('');

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        setErrorMessage('');
        setDuration(0);
        timerRef.current = setInterval(() => {
          setDuration((prev) => prev + 1);
        }, 1000);
      };

      recognition.onresult = (event) => {
        let interimText = '';
        let currentFinal = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            currentFinal += transcript + ' ';
          } else {
            interimText += transcript;
          }
        }

        if (currentFinal) {
          finalTranscriptAccumulator.current += currentFinal;
        }

        const combined = (finalTranscriptAccumulator.current + interimText).trim();
        if (combined && onTranscript) {
          onTranscript(combined);
        }
      };

      recognition.onerror = (event) => {
        if (event.error === 'not-allowed') {
          setErrorMessage('Microphone permission denied. Please allow microphone access in your browser.');
        } else if (event.error === 'no-speech') {
          // Soft notice, no crash
        } else if (event.error !== 'aborted') {
          setErrorMessage(`Speech recognition error: ${event.error}`);
        }
        stopRecording();
      };

      recognition.onend = () => {
        stopRecording();
        if (onFinalTranscript && finalTranscriptAccumulator.current.trim()) {
          onFinalTranscript(finalTranscriptAccumulator.current.trim());
        }
      };

      recognitionRef.current = recognition;
    } catch {
      setIsSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [onTranscript, onFinalTranscript]);

  const startRecording = () => {
    if (!isSupported || disabled) return;
    setErrorMessage('');
    finalTranscriptAccumulator.current = '';
    try {
      recognitionRef.current?.start();
    } catch (err) {
      // If already started or browser state error
      try {
        recognitionRef.current?.stop();
      } catch {
        // ignore
      }
    }
  };

  const stopRecording = () => {
    setIsListening(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore
    }
  };

  const toggleRecording = () => {
    if (isListening) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const formatTimer = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (!isSupported) {
    return (
      <button
        type="button"
        disabled
        className={`rounded-xl p-2 text-slate-300 opacity-50 dark:text-slate-600 ${className}`}
        title="Voice speech recognition not supported in this browser"
      >
        <MicOff className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div className="relative inline-flex items-center">
      {/* Active Recording Pill Floating Notice */}
      {isListening && (
        <div className="absolute bottom-12 right-0 z-50 flex items-center gap-2.5 rounded-2xl border border-pink-400 bg-white/95 px-3 py-1.5 shadow-xl backdrop-blur-md dark:border-pink-500/60 dark:bg-slate-900/95 whitespace-nowrap animate-in fade-in slide-in-from-bottom-2">
          {/* Animated sound wave bars */}
          <div className="flex items-center gap-0.5">
            <span className="h-2.5 w-0.5 rounded-full bg-pink-600 animate-pulse" />
            <span className="h-4 w-0.5 rounded-full bg-pink-600 animate-pulse delay-75" />
            <span className="h-3 w-0.5 rounded-full bg-pink-600 animate-pulse delay-150" />
            <span className="h-5 w-0.5 rounded-full bg-pink-600 animate-pulse delay-100" />
            <span className="h-2 w-0.5 rounded-full bg-pink-600 animate-pulse delay-200" />
          </div>

          <span className="text-xs font-bold text-pink-700 dark:text-pink-300">
            Listening ({formatTimer(duration)})
          </span>

          <button
            type="button"
            onClick={stopRecording}
            className="flex items-center gap-1 rounded-lg bg-pink-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm transition hover:bg-pink-700 active:scale-95"
            title="Done speaking"
          >
            <Check className="h-3 w-3" />
            <span>Done</span>
          </button>
        </div>
      )}

      {/* Error tooltip */}
      {errorMessage && (
        <div className="absolute bottom-12 right-0 z-50 max-w-xs rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800 shadow-lg dark:border-rose-900 dark:bg-rose-950/90 dark:text-rose-200">
          <div className="flex items-start gap-1.5">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage('')}
            className="mt-1 text-[10px] font-semibold text-rose-600 underline hover:text-rose-800"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Microphone Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={toggleRecording}
        className={`group relative rounded-xl p-2 transition-all duration-200 ${
          isListening
            ? 'bg-pink-600 text-white shadow-md shadow-pink-500/30 animate-pulse scale-105'
            : 'text-slate-400 hover:bg-slate-200/60 hover:text-pink-600 dark:hover:bg-white/10 dark:hover:text-pink-300'
        } ${className}`}
        title={isListening ? 'Click to stop listening' : 'Voice input (Speech to Text)'}
      >
        {isListening ? (
          <Square className="h-4 w-4 fill-white" />
        ) : (
          <Mic className="h-4 w-4 transition-transform group-hover:scale-110" />
        )}
      </button>
    </div>
  );
}
