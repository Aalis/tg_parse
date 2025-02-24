import { MantineProvider, MantineThemeOverride } from '@mantine/core';
import { useState } from 'react';
import { TelegramParser } from './components/TelegramParser';
import '@mantine/core/styles.css';

function App() {
  const [isDark, setIsDark] = useState(false);
  const toggleTheme = () => setIsDark(!isDark);

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
    <MantineProvider theme={theme}>
      <div style={{ 
        padding: '2rem',
        minHeight: '100vh',
        background: isDark ? 'var(--mantine-color-dark-7)' : 'var(--mantine-color-gray-0)',
        color: isDark ? 'var(--mantine-color-dark-0)' : 'inherit'
      }}>
        <TelegramParser onToggleTheme={toggleTheme} isDark={isDark} />
      </div>
    </MantineProvider>
  );
}

export default App;
