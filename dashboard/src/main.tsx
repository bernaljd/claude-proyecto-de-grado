import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { DatosProvider } from './DatosContext';
import './estilos.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <DatosProvider>
        <App />
      </DatosProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
