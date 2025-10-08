import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { createTheme, MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';

const theme = createTheme({
  /** Put your mantine theme override here */
});

createRoot(document.getElementById('root')).render(
  <MantineProvider theme={theme}>
    <App />
  </MantineProvider>,
)
