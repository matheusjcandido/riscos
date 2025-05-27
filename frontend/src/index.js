import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // Arquivo CSS global (opcional)
import App from './App'; // Seu componente App principal
// import reportWebVitals from './reportWebVitals'; // Opcional, para performance

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Se você quiser começar a medir a performance no seu app, passe uma função
// para logar resultados (por exemplo: reportWebVitals(console.log))
// ou envie para um endpoint de analytics. Saiba mais: https://bit.ly/CRA-vitals
// reportWebVitals();
