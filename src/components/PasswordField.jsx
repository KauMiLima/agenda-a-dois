import { useState } from 'react';

// Campo de senha com o olhinho para mostrar/esconder
export default function PasswordField({ value, onChange, autoComplete = 'current-password', autoFocus = false }) {
  const [ver, setVer] = useState(false);
  return (
    <span className="campo-senha">
      <input
        type={ver ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        required
        minLength={6}
      />
      <button
        type="button"
        className="ver-senha"
        onClick={() => setVer(!ver)}
        aria-label={ver ? 'Esconder senha' : 'Mostrar senha'}
        aria-pressed={ver}
        title={ver ? 'Esconder senha' : 'Mostrar senha'}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
          <circle cx="12" cy="12" r="3" />
          {ver && <path d="M4 20 20 4" />}
        </svg>
      </button>
    </span>
  );
}
