import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { BrowserRouter } from 'react-router-dom';

const root = ReactDOM.createRoot(document.getElementById('root'));

const app = (
  <BrowserRouter>
    <App />
  </BrowserRouter>
);

if (process.env.NODE_ENV === 'production') {
  root.render(<React.StrictMode>{app}</React.StrictMode>);
} else {
  root.render(app);
}

reportWebVitals();
