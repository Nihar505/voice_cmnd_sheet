'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface UseVoiceRecorderReturn {
  isRecording: boolean;
  isProcessing: boolean;
  audioLevel: number;
  analyserData: Uint8Array | null;
  duration: number;
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  cancelRecording: () => void;
}

export function useVoiceRecorder(): UseVoiceRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [analyserData, setAnalyserData] = useState<Uint8Array | null>(null);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resolveStopRef = useRef<((blob: Blob | null) => void) | null>(null);
  const isRecordingRef = useRef(false);

  const cleanup = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current?.state !== 'closed') {
      audioContextRef.current?.close();
    }
    audioContextRef.current = null;
    analyserRef.current = null;
    mediaRecorderRef.current = null;
    isRecordingRef.current = false;
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const updateAnalyser = useCallback(() => {
    if (!analyserRef.current || !isRecordingRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    setAnalyserData(new Uint8Array(dataArray));

    // Calculate RMS audio level
    const timeData = new Uint8Array(analyserRef.current.fftSize);
    analyserRef.current.getByteTimeDomainData(timeData);
    let sum = 0;
    for (let i = 0; i < timeData.length; i++) {
      const normalized = (timeData[i] - 128) / 128;
      sum += normalized * normalized;
    }
    const rms = Math.sqrt(sum / timeData.length);
    setAudioLevel(Math.min(1, rms * 3));

    animationFrameRef.current = requestAnimationFrame(updateAnalyser);
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setDuration(0);
      chunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/wav';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        resolveStopRef.current?.(blob);
        resolveStopRef.current = null;
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      isRecordingRef.current = true;

      durationIntervalRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);

      animationFrameRef.current = requestAnimationFrame(updateAnalyser);
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Microphone access denied. Please allow microphone permission.'
          : 'Failed to start recording. Check your microphone.';
      setError(message);
      cleanup();
    }
  }, [cleanup, updateAnalyser]);

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
      return null;
    }

    setIsProcessing(true);

    return new Promise((resolve) => {
      resolveStopRef.current = (blob) => {
        setIsRecording(false);
        setIsProcessing(false);
        setAudioLevel(0);
        setAnalyserData(null);
        cleanup();
        resolve(blob);
      };
      mediaRecorderRef.current?.stop();
    });
  }, [cleanup]);

  const cancelRecording = useCallback(() => {
    setIsRecording(false);
    setIsProcessing(false);
    setAudioLevel(0);
    setAnalyserData(null);
    setDuration(0);
    resolveStopRef.current = null;
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current?.stop();
    }
    cleanup();
  }, [cleanup]);

  return {
    isRecording,
    isProcessing,
    audioLevel,
    analyserData,
    duration,
    error,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}
