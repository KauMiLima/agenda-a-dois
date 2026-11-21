import { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { dataLonga, hora } from '../lib/dates.js';

const IDEIAS = ['Sugira um programa a dois para o fim de semana', 'Organize minha semana', 'Onde encaixo 3 treinos?'];

export default function AIPanel({ de, ate, agendaCompartilhadaId, livres, onAdicionar }) {
  const [pedido, setPedido] = useState('');
  const [resultado, setResultado] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);

  async function pedir(texto) {
    setCarregando(true);
    setErro(null);
    setResultado(null);
    try {
      const { data, error } = await supabase.functions.invoke('sugestoes', {
        body: {
          pedido: texto || pedido || 'Sugira como aproveitar melhor esta semana.',
          de: de.toISOString(),
          ate: ate.toISOString(),
          agora: new Date().toISOString(),
          fuso: Intl.DateTimeFormat().resolvedOptions().timeZone,
          calendarId: agendaCompartilhadaId || null,
          livres: livres.slice(0, 25).map((l) => ({ inicio: l.inicio.toISOString(), fim: l.fim.toISOString() })),
        },
      });
      if (error) throw error;
      if (data?.erro) throw new Error(data.erro);
      setResultado(data);
    } catch (err) {
      setErro('Não consegui falar com a IA. Confira se a função "sugestoes" foi publicada no Supabase. (' + err.message + ')');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <section className="painel">
      <h3>Assistente</h3>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          pedir();
        }}
      >
        <textarea
          rows={2}
          value={pedido}
          onChange={(e) => setPedido(e.target.value)}
          placeholder="Peça algo: ‘sugira um programa pra gente sábado’"
        />
        <button className="btn primario pequeno largo" disabled={carregando}>
          {carregando ? 'Pensando…' : 'Pedir sugestões'}
        </button>
      </form>

      {!resultado && !carregando && (
        <div className="ideias">
          {IDEIAS.map((i) => (
            <button key={i} className="ideia" onClick={() => { setPedido(i); pedir(i); }}>{i}</button>
          ))}
        </div>
      )}

      {erro && <p className="msg erro">{erro}</p>}

      {resultado && (
        <div className="resultado-ia">
          {resultado.resumo && <p>{resultado.resumo}</p>}
          {(resultado.sugestoes || []).map((s, i) => (
            <div key={i} className="sugestao">
              <strong>{s.titulo}</strong>
              {s.inicio && (
                <span className="quando">
                  {dataLonga(s.inicio)} · {hora(s.inicio)}–{hora(s.fim)}
                </span>
              )}
              {s.motivo && <p>{s.motivo}</p>}
              {s.inicio && (
                <button
                  className="btn pequeno"
                  onClick={() => onAdicionar({ titulo: s.titulo, inicio: new Date(s.inicio), fim: new Date(s.fim), descricao: s.motivo, compartilhar: s.a_dois })}
                >
                  + Adicionar
                </button>
              )}
            </div>
          ))}
          <button className="link pequeno" onClick={() => setResultado(null)}>limpar</button>
        </div>
      )}
    </section>
  );
}
