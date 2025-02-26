import { MantineProvider, MantineThemeOverride } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { useState, useEffect } from 'react';
import { TelegramParser } from './components/TelegramParser';
import { TokenPoolStatus } from './components/TokenPoolStatus';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';

function App() {
  // Initialize theme from localStorage or default to false (light theme)
  const [isDark, setIsDark] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    return savedTheme ? savedTheme === 'dark' : false;
  });

  const toggleTheme = () => {
    const newTheme = !isDark;
    setIsDark(newTheme);
    localStorage.setItem('theme', newTheme ? 'dark' : 'light');
  };

  // Also sync with system preference changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      const systemPrefersDark = e.matches;
      const savedTheme = localStorage.getItem('theme');
      
      // Only apply system preference if user hasn't explicitly chosen a theme
      if (!savedTheme) {
        setIsDark(systemPrefersDark);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    
    // Initial check for system preference
    if (!localStorage.getItem('theme')) {
      setIsDark(mediaQuery.matches);
    }

    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const theme: MantineThemeOverride = {
    colorScheme: isDark ? 'dark' : 'light',
    primaryColor: 'blue',
    colors: {
      dark: [
        '#FFFFFF',  // Text and foreground elements
        '#E6E8EC',  // Slightly dimmed text
        '#C1C2C5',  // Secondary text
        '#909296',  // Dimmed text
        '#5c5f66',  // Borders and separators
        '#373A40',  // UI elements background
        '#2C2E33',  // Card/Paper background
        '#25262b',  // Main background
        '#1A1B1E',  // Darker background
        '#141517',  // Darkest background
      ],
    },
    defaultRadius: 'md',
    black: '#1A1B1E',
    white: '#FFFFFF',
    components: {
      Paper: {
        defaultProps: (theme) => ({
          bg: theme.colorScheme === 'dark' ? theme.colors.dark[6] : theme.white,
          style: { 
            border: `1px solid ${theme.colorScheme === 'dark' ? theme.colors.dark[4] : theme.colors.gray[3]}`
          }
        })
      },
      Card: {
        defaultProps: (theme) => ({
          bg: theme.colorScheme === 'dark' ? theme.colors.dark[6] : theme.white,
          style: { 
            border: `1px solid ${theme.colorScheme === 'dark' ? theme.colors.dark[4] : theme.colors.gray[3]}`
          }
        })
      },
      Table: {
        defaultProps: (theme) => ({
          highlightOnHover: true,
          withBorder: true,
          borderColor: theme.colorScheme === 'dark' ? theme.colors.dark[4] : theme.colors.gray[3]
        })
      }
    }
  };

  return (
    <BrowserRouter>
      <MantineProvider theme={theme}>
        <Notifications />
        <div style={{ 
          padding: '2rem',
          minHeight: '100vh',
          background: isDark ? 'var(--mantine-color-dark-7)' : 'var(--mantine-color-gray-0)',
          color: isDark ? 'var(--mantine-color-dark-0)' : 'inherit'
        }}>
          <Routes>
            <Route 
              path="/" 
              element={<TelegramParser onToggleTheme={toggleTheme} isDark={isDark} />} 
            />
            <Route 
              path="/token-status" 
              element={<TokenPoolStatus isDark={isDark} />} 
            />
            <Route 
              path="*" 
              element={<Navigate to="/" replace />} 
            />
          </Routes>
        </div>
      </MantineProvider>
    </BrowserRouter>
  );
}

export default App;
