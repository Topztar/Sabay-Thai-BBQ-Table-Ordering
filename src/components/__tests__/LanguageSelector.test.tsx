import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LanguageSelector } from '../LanguageSelector';
import { Language } from '../../types';

describe('LanguageSelector', () => {
  it('renders correctly with current language', () => {
    render(<LanguageSelector currentLang="zh-TW" onLanguageChange={vi.fn()} />);
    
    // It should have options for each language
    const button = screen.getByRole('button');
    expect(button).toBeDefined();
    
    // Check if the current value is correct
    expect(button.textContent).toContain('TW');
  });

  it('calls onLanguageChange when a new language is selected', () => {
    const handleChange = vi.fn();
    render(<LanguageSelector currentLang="zh-TW" onLanguageChange={handleChange} />);
    
    // Click the dropdown button to open menu
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    // Find the English option and click it
    const englishOption = screen.getByText('English');
    fireEvent.click(englishOption);
    
    expect(handleChange).toHaveBeenCalledWith('en');
    expect(handleChange).toHaveBeenCalledTimes(1);
  });
});
