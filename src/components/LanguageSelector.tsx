import React, { useState, useRef, useEffect } from 'react';
import { Language } from '../types';
import { ChevronDown } from 'lucide-react';

interface LanguageSelectorProps {
  currentLang: Language;
  onLanguageChange: (lang: Language) => void;
}

const renderFlag = (code: Language) => {
  switch (code) {
    case 'zh':
      return (
        <svg
          viewBox="0 0 30 20"
          className="w-5 h-3.5 rounded-sm object-cover shadow-sm bg-white shrink-0"
        >
          <rect width="30" height="20" fill="#FE3030" />
          <rect width="15" height="10" fill="#000095" />
          <circle cx="7.5" cy="5" r="2.3" fill="#fff" />
          <circle cx="7.5" cy="5" r="1.5" fill="#000095" />
          <circle cx="7.5" cy="5" r="1.0" fill="#fff" />
        </svg>
      );
    case 'en':
      return (
        <svg
          viewBox="0 0 19 10"
          className="w-5 h-3.5 rounded-sm object-cover shadow-sm bg-white shrink-0"
        >
          <rect width="19" height="10" fill="#B22234" />
          <rect y="1.54" width="19" height="0.77" fill="#fff" />
          <rect y="3.08" width="19" height="0.77" fill="#fff" />
          <rect y="4.62" width="19" height="0.77" fill="#fff" />
          <rect y="6.15" width="19" height="0.77" fill="#fff" />
          <rect y="7.69" width="19" height="0.77" fill="#fff" />
          <rect y="9.23" width="19" height="0.77" fill="#fff" />
          <rect width="7.6" height="5.38" fill="#3C3B6E" />
          <circle cx="1.5" cy="1" r="0.25" fill="#fff" />
          <circle cx="3.5" cy="1" r="0.25" fill="#fff" />
          <circle cx="5.5" cy="1" r="0.25" fill="#fff" />
          <circle cx="1.5" cy="2.5" r="0.25" fill="#fff" />
          <circle cx="3.5" cy="2.5" r="0.25" fill="#fff" />
          <circle cx="5.5" cy="2.5" r="0.25" fill="#fff" />
          <circle cx="1.5" cy="4" r="0.25" fill="#fff" />
          <circle cx="3.5" cy="4" r="0.25" fill="#fff" />
          <circle cx="5.5" cy="4" r="0.25" fill="#fff" />
        </svg>
      );
    case 'th':
      return (
        <svg
          viewBox="0 0 9 6"
          className="w-5 h-3.5 rounded-sm object-cover shadow-sm bg-white shrink-0"
        >
          <rect width="9" height="6" fill="#A51931" />
          <rect y="1" width="9" height="4" fill="#F4F5F8" />
          <rect y="2" width="9" height="2" fill="#2D2A4A" />
        </svg>
      );
    case 'ja':
      return (
        <svg
          viewBox="0 0 3 2"
          className="w-5 h-3.5 rounded-sm object-cover shadow-sm bg-white shrink-0 border border-white/5"
        >
          <rect width="3" height="2" fill="#fff" />
          <circle cx="1.5" cy="1" r="0.6" fill="#bc002d" />
        </svg>
      );
    case 'ko':
      return (
        <svg
          viewBox="0 0 3 2"
          className="w-5 h-3.5 rounded-sm object-cover shadow-sm bg-white shrink-0 border border-white/5"
        >
          <rect width="3" height="2" fill="#fff" />
          <path d="M 1.05 1 A 0.45 0.45 0 0 1 1.95 1 Z" fill="#cd2e3a" />
          <path d="M 1.05 1 A 0.45 0.45 0 0 0 1.95 1 Z" fill="#0047a0" />
          <circle cx="1.275" cy="1" r="0.225" fill="#cd2e3a" />
          <circle cx="1.725" cy="1" r="0.225" fill="#0047a0" />
        </svg>
      );
    case 'vi':
      return (
        <svg
          viewBox="0 0 3 2"
          className="w-5 h-3.5 rounded-sm object-cover shadow-sm bg-white shrink-0"
        >
          <rect width="3" height="2" fill="#da251d" />
          <g transform="translate(1.5, 1.0) scale(0.4)">
            <polygon
              points="0,-1 0.225,-0.309 0.951,-0.309 0.363,0.118 0.588,0.809 0,0.382 -0.588,0.809 -0.363,0.118 -0.951,-0.309 -0.225,-0.309"
              fill="#ffff00"
            />
          </g>
        </svg>
      );
    default:
      return null;
  }
};

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  currentLang,
  onLanguageChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const options: { code: Language; name: string; short: string }[] = [
    { code: 'zh', name: '繁體中文', short: 'TW' },
    { code: 'en', name: 'English', short: 'EN' },
    { code: 'th', name: 'ไทย', short: 'TH' },
    { code: 'ja', name: '日本語', short: 'JP' },
    { code: 'ko', name: '한국어', short: 'KR' },
    { code: 'vi', name: 'Tiếng Việt', short: 'VN' },
  ];

  const currentOption = options.find((opt) => opt.code === currentLang) || options[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="relative" ref={containerRef} id="lang-selector-custom-dropdown">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full px-2 py-1 transition-all shadow-md active:scale-95 cursor-pointer"
      >
        {renderFlag(currentLang)}
        <span className="text-white text-[10px] sm:text-xs font-black tracking-wider uppercase">
          {currentOption.short}
        </span>
        <ChevronDown
          size={11}
          className={`text-[#E5B453]/80 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-32 bg-[#121212]/95 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="py-1">
            {options.map((opt) => (
              <button
                key={opt.code}
                type="button"
                onClick={() => {
                  onLanguageChange(opt.code);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center space-x-2.5 px-3 py-2 text-left text-xs hover:bg-white/10 transition-colors ${
                  currentLang === opt.code ? 'text-[#E5B453] bg-white/5 font-bold' : 'text-white/80'
                }`}
              >
                {renderFlag(opt.code)}
                <span className="font-sans text-[11px] truncate uppercase flex-1">{opt.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
