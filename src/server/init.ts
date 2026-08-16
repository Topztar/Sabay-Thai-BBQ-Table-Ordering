import express from 'express';
import { Storage } from '@google-cloud/storage';
import { GoogleGenAI } from '@google/genai';

export const app = express();
export const PORT = 3000;

export const STORAGE_BUCKET_NAME = 'sabay-bbq-order.firebasestorage.app';
export let gcsStorage: Storage | null = null;
export let gcsBucket: any = null;

export function initFirebaseStorage() {
  try {
    gcsStorage = new Storage({ projectId: 'sabay-bbq-order' });
    gcsBucket = gcsStorage.bucket(STORAGE_BUCKET_NAME);
    console.log(`[Sabay Storage] Initialized @google-cloud/storage bucket: ${STORAGE_BUCKET_NAME}`);
  } catch (err: any) {
    console.warn('[Sabay Storage] @google-cloud/storage initialization note:', err?.message);
  }
}

export function getGeminiClient(): GoogleGenAI | null {
  if (!process.env.GEMINI_API_KEY) {
    return null;
  }
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      timeout: 2000,
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}
