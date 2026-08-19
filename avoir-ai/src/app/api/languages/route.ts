import { NextResponse } from 'next/server';

const LANGUAGES = [
  { code: 'en', name: 'English', native_name: 'English', flag: '🇺🇸' },
  { code: 'hi', name: 'Hindi', native_name: 'हिन्दी', flag: '🇮🇳' },
  { code: 'hi-en', name: 'Hinglish', native_name: 'Hinglish', flag: '🇮🇳' },
  { code: 'es', name: 'Spanish', native_name: 'Español', flag: '🇪🇸' },
  { code: 'pt', name: 'Portuguese', native_name: 'Português', flag: '🇧🇷' },
  { code: 'fr', name: 'French', native_name: 'Français', flag: '🇫🇷' },
  { code: 'ta', name: 'Tamil', native_name: 'தமிழ்', flag: '🇮🇳' },
  { code: 'bn', name: 'Bengali', native_name: 'বাংলা', flag: '🇧🇩' },
];

export async function GET() {
  return NextResponse.json({ languages: LANGUAGES });
}
